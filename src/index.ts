import compression from "compression"
import express, { type NextFunction, type Request, type Response } from "express"
import http from "node:http"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { Server } from "socket.io"

import { IpRateLimiter, SlidingWindow } from "./lib/rate-limit"
import { RoomError, RoomStore } from "./lib/room-store"
import {
    LIMITS,
    normalizeClientId,
    normalizeMessage,
    normalizeName,
    normalizeRoomId,
    validateFileInput,
} from "./lib/validation"
import type {
    ClientToServerEvents,
    FileMessage,
    FilePayload,
    InterServerEvents,
    RoomState,
    ServerToClientEvents,
    SocketData,
} from "./types"

const app = express()
const server = http.createServer(app)

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(server, {
    maxHttpBufferSize: 8 * 1024 * 1024,
    pingInterval: 25_000,
    pingTimeout: 20_000,
})

const rooms = new RoomStore()
const createRoomLimiter = new IpRateLimiter(10, 10 * 60 * 1000)
const roomLookupLimiter = new IpRateLimiter(120, 60 * 1000)

const appRoot = path.resolve(__dirname, "..")
const publicDir = path.join(appRoot, "public")
const viewsDir = path.join(appRoot, "views")

const CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self' ws: wss:",
].join("; ")

app.set("views", viewsDir)
app.set("view engine", "ejs")
app.disable("x-powered-by")
app.set("trust proxy", 1)

app.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy", CSP)
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    res.setHeader("Strict-Transport-Security", "max-age=15552000")
    next()
})

app.use(compression())
app.use(
    express.static(publicDir, {
        index: false,
        maxAge: "1h",
    }),
)
app.use(express.json({ limit: "16kb" }))

app.get("/", (_req, res) => {
    return res.status(200).render("index")
})

app.get("/healthz", (_req, res) => {
    return res.status(200).json({ status: "ok" })
})

app.get("/room/:id", (req, res) => {
    const roomId = normalizeRoomId(req.params.id)

    if (!roomId || !rooms.hasRoom(roomId)) {
        return res.status(404).render("not-found", {
            title: "Sala não encontrada",
            message: "Essa sala expirou ou nunca existiu. Crie uma nova para começar.",
            cta: "Criar uma sala",
            ctaHref: "/",
        })
    }

    return res.status(200).render("room", { roomId })
})

app.post("/api/rooms", (req, res) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown"

    if (!createRoomLimiter.take(key)) {
        return res.status(429).json({
            status: "error",
            error: "rate_limited",
            message: "Você criou muitas salas em pouco tempo. Aguarde alguns minutos.",
        })
    }

    try {
        const room = rooms.createRoom()
        return res.status(201).json({
            status: "success",
            data: { id: room.id },
        })
    } catch (error) {
        if (error instanceof RoomError) {
            return res.status(503).json({
                status: "error",
                error: error.code,
                message: error.message,
            })
        }

        console.error("room creation failed", error)
        return res.status(500).json({
            status: "error",
            error: "internal_error",
            message: "Não foi possível criar a sala agora.",
        })
    }
})

app.get("/api/rooms/:id", (req, res) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown"

    if (!roomLookupLimiter.take(key)) {
        return res.status(429).json({
            status: "error",
            error: "rate_limited",
            message: "Muitas consultas em pouco tempo. Aguarde um instante.",
        })
    }

    const roomId = normalizeRoomId(req.params.id)
    if (!roomId) {
        return res.status(400).json({
            status: "error",
            error: "invalid_room",
            message: "Código de sala inválido.",
        })
    }

    const room = rooms.getRoom(roomId)
    if (!room) {
        return res.status(404).json({
            status: "error",
            error: "room_not_found",
            message: "Sala não encontrada.",
        })
    }

    return res.status(200).json({
        status: "success",
        data: {
            id: room.id,
            members: room.members.size,
            createdAt: room.createdAt,
        },
    })
})

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            status: "error",
            error: "not_found",
            message: "Rota não encontrada.",
        })
    }

    return res.status(404).render("not-found", {
        title: "Página não encontrada",
        message: "O endereço que você abriu não existe.",
        cta: "Voltar para o início",
        ctaHref: "/",
    })
})

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error)

    console.error("request failed", error instanceof Error ? error.message : error)

    if (req.path.startsWith("/api/")) {
        return res.status(500).json({
            status: "error",
            error: "internal_error",
            message: "Algo deu errado no servidor.",
        })
    }

    return res.status(500).render("not-found", {
        title: "Algo deu errado",
        message: "Não foi possível concluir esta ação. Tente novamente.",
        cta: "Voltar para o início",
        ctaHref: "/",
    })
})

io.on("connection", (socket) => {
    socket.data.messageLimiter = new SlidingWindow(
        LIMITS.messageRateLimit,
        LIMITS.messageRateWindowMs,
    )
    socket.data.fileLimiter = new SlidingWindow(
        LIMITS.fileRateLimit,
        LIMITS.fileRateWindowMs,
    )

    const joinError = (code: string, message: string) => {
        socket.emit("join:error", { code, message })
    }

    const sendError = (clientId: string, message: string) => {
        socket.emit("send:error", { clientId, message })
    }

    socket.on("room:join", (payload) => {
        if (socket.data.roomId) {
            if (socket.data.roomId === payload?.roomId) {
                const room = rooms.getRoom(socket.data.roomId)
                const self = socket.data.member
                if (room && self) {
                    const state: RoomState = {
                        room: { id: room.id, createdAt: room.createdAt },
                        self,
                        members: rooms.members(room),
                        messages: rooms.messages(room),
                    }
                    socket.emit("room:state", state)
                }
            }
            return
        }

        const roomId = normalizeRoomId(payload?.roomId)
        if (!roomId) return joinError("INVALID_ROOM", "Código de sala inválido.")

        const name = normalizeName(payload?.name)
        if (!name) {
            return joinError(
                "INVALID_NAME",
                "Escolha um nome com 2 a 24 caracteres.",
            )
        }

        const room = rooms.getRoom(roomId)
        if (!room) {
            return joinError(
                "ROOM_NOT_FOUND",
                "Sala não encontrada. Confira o código e tente novamente.",
            )
        }

        try {
            const member = rooms.join(roomId, socket.id, name)
            socket.join(roomId)
            socket.data.roomId = roomId
            socket.data.member = member

            const systemMessage = rooms.addSystem(room, `${member.name} entrou`)
            const state: RoomState = {
                room: { id: room.id, createdAt: room.createdAt },
                self: member,
                members: rooms.members(room),
                messages: rooms.messages(room),
            }

            socket.emit("room:state", state)
            socket.to(roomId).emit("message:new", systemMessage)
            io.to(roomId).emit("members:update", rooms.members(room))
        } catch (error) {
            if (error instanceof RoomError) {
                return joinError(error.code, error.message)
            }

            console.error("room join failed", error)
            return joinError(
                "JOIN_FAILED",
                "Não foi possível entrar na sala agora. Tente novamente.",
            )
        }
    })

    socket.on("message:send", (payload) => {
        const clientId = normalizeClientId(payload?.clientId)

        if (!socket.data.roomId || !socket.data.member) {
            return sendError(clientId, "Você ainda não entrou na sala.")
        }

        if (!socket.data.messageLimiter?.take()) {
            return sendError(clientId, "Muitas mensagens em pouco tempo. Aguarde alguns segundos.")
        }

        const text = normalizeMessage(payload?.text)
        if (!text) {
            return sendError(
                clientId,
                "A mensagem está vazia ou passou do limite de 1.000 caracteres.",
            )
        }

        const room = rooms.getRoom(socket.data.roomId)
        const member = room?.members.get(socket.id)

        if (!room || !member) {
            return sendError(clientId, "Sua sessão na sala expirou. Entre novamente.")
        }

        const message = rooms.addText(room, member, text)
        socket.to(room.id).emit("message:new", message)
        socket.emit("message:sent", { clientId, message })
    })

    socket.on("file:send", (payload) => {
        const clientId = normalizeClientId(payload?.clientId)

        if (!socket.data.roomId || !socket.data.member) {
            return sendError(clientId, "Você ainda não entrou na sala.")
        }

        if (!socket.data.fileLimiter?.take()) {
            return sendError(clientId, "Muitos arquivos em pouco tempo. Aguarde alguns segundos.")
        }

        const result = validateFileInput(payload)
        if (!result.ok) {
            return sendError(clientId, result.error)
        }

        const room = rooms.getRoom(socket.data.roomId)
        const member = room?.members.get(socket.id)

        if (!room || !member) {
            return sendError(clientId, "Sua sessão na sala expirou. Entre novamente.")
        }

        const createdAt = Date.now()
        const fileMessage: FileMessage = {
            id: randomUUID(),
            type: "file",
            user: { ...member },
            name: result.file.name,
            mime: result.file.mime,
            size: result.file.size,
            createdAt,
        }

        const message: FilePayload = {
            ...fileMessage,
            data: result.file.data,
        }

        socket.to(room.id).emit("file:new", message)
        socket.emit("file:sent", { clientId, message: fileMessage })
    })

    socket.on("typing:start", () => {
        if (!socket.data.roomId || !socket.data.member) return

        socket.to(socket.data.roomId).emit("typing:show", {
            id: socket.id,
            name: socket.data.member.name,
        })
    })

    socket.on("typing:stop", () => {
        if (!socket.data.roomId) return
        socket.to(socket.data.roomId).emit("typing:hide", { id: socket.id })
    })

    socket.on("disconnect", () => {
        const roomId = socket.data.roomId
        if (!roomId) return

        const member = rooms.leave(roomId, socket.id)
        socket.data.roomId = undefined
        socket.data.member = undefined

        if (!member) return

        const room = rooms.getRoom(roomId)
        if (!room) return

        const systemMessage = rooms.addSystem(room, `${member.name} saiu`)
        io.to(roomId).emit("message:new", systemMessage)
        io.to(roomId).emit("members:update", rooms.members(room))
    })
})

const cleanupTimer = setInterval(() => {
    rooms.cleanup(60 * 60 * 1000)
}, 5 * 60 * 1000)
cleanupTimer.unref()

const port = Number(process.env.PORT) || 3000

server.listen(port, "0.0.0.0", () => {
    console.log(`Chat Realtime listening on http://0.0.0.0:${port}`)
})

let shuttingDown = false

function shutdown(signal: string): void {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`Shutting down (${signal})...`)

    io.close()
    server.close(() => process.exit(0))

    setTimeout(() => process.exit(1), 8_000).unref()
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
