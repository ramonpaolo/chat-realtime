import express from "express"
import cors from "cors"
import path from "path"
import http from "http"
import { Server } from "socket.io"
import os from "os"

const app = express()

const server = http.createServer(app)

const io = new Server(server, {
    maxHttpBufferSize: 1e8
});

app.use(cors())
app.set("view engine", "ejs")

app.get("/", async (_, res) => {
    return res.status(200).render("index.ejs")
})

app.get("/room", (req, res) => {
    return res.status(200).render("room.ejs")
})

app.get("/scripts/:file", (req, res) => {
    const rootDir = path.resolve(__dirname, "..", "node_modules", "socket.io", "client-dist");
    const requestedFile = path.resolve(rootDir, req.params.file);

    if(!requestedFile.startsWith(rootDir)) {
        return res.status(401).json({
            status: 'failed',
            message: 'cannot access another files from server',
        })
    }

    return res.status(200).sendFile(requestedFile)
})

const listRooms = new Array()

io.on("connection", (socket: any) => {
    listRooms.map((v) => {
        socket.on(`data-${v}`, (data: any) => {
            socket.broadcast.emit(`data-${v}`, data)
        })
    })

    socket.on("room", (data: any) => {
        listRooms.push(data.uid)
    })
})

app.get("/verify-room/:codeRoom", async (req, res) => {
    if (listRooms.length === 0) return res.status(200).json({ message: "not exists", numberRooms: 0 })
    let x = 0;
    
    await Promise.all(listRooms.map((v) => {
        if (req.params.codeRoom == v) {
            return res.status(200).json({ message: "exists" })
        }

        x++
    }))

    if (x === listRooms.length)
        return res.status(200).json({ message: "not exists", numberRooms: listRooms.length })
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