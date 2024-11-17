import express from "express"
import cors from "cors"
import path from "path"
import http from "http"
import { Server } from "socket.io"
import os from "os"

const app = express()

const server = http.createServer(app)

const io = new Server(server, {
    maxHttpBufferSize: 1e10
});

const listRooms = new Array();

app.use(cors())
app.set("view engine", "ejs")

app.get("/", async (_, res) => {
    return res.status(200).render("index.ejs")
})

app.get("/room/:id", (req, res) => {
    return res.status(200).render("room.ejs")
})

app.post("/create-room", (req, res) => {
    console.log('Creating room...')

    const idRoom = crypto.randomUUID()

    listRooms.push(idRoom)

    console.log('Created room with success!')

    return res.status(201).json({
        status: 'success',
        message: 'create room with success',
        data: {
            id: idRoom,
        },
    })
})

app.get("/scripts/:file", (req, res) => {
    const rootDir = path.resolve(__dirname, "..", "node_modules", "socket.io", "client-dist");
    const requestedFile = path.resolve(rootDir, req.params.file);

    if (!requestedFile.startsWith(rootDir)) {
        return res.status(401).json({
            status: 'failed',
            message: 'cannot access another files from server',
        })
    }

    return res.status(200).sendFile(requestedFile)
})

app.get("/assets/:file", (req, res) => {
    const rootDir = path.resolve(__dirname, "..", "views", "assets");
    const requestedFile = path.resolve(rootDir, req.params.file);

    if (!requestedFile.startsWith(rootDir)) {
        return res.status(401).json({
            status: 'failed',
            message: 'cannot access another files from server',
        })
    }

    return res.status(200).sendFile(requestedFile)
})

io.on("connection", (socket) => {
    listRooms.map((v) => {
        socket.on(`room-${v}`, (data: { message: string, type: string, name?: string, }) => {
            console.log('Data received: ', data)

            socket.broadcast.emit(`data-${v}`, data)
        })
    })

    socket.on("room", (data: { id: string; }) => {
        listRooms.push(data.id)
        console.log('Created room')
    })
})

app.get("/verify-room/:id", async (req, res) => {
    const idRoom = req.params.id

    await Promise.all(listRooms.map(_idRoom => {
        if (idRoom === _idRoom)
            return res.status(200).json({ message: "exists" })
    }))

    return res.status(200).json({ message: "not exists" })
})

app.get("/info", (_, res) => {
    let totalMem = (((os.totalmem() / 1024) / 1024) / 1024).toFixed(2) + "GB"
    let freeMem = (((os.freemem() / 1024) / 1024) / 1024).toFixed(2) + "GB"
    let cores = os.cpus().length
    let OS = os.type()
    let platform = os.platform()

    return res.status(200).json({
        totalMem, freeMem, cores, OS, platform
    })
})

server.listen(process.env.PORT || 3000)