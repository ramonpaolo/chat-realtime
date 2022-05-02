import express from "express"
import compression from "compression"
import cors from "cors"
import path from "path"
import http from "http"
import { Server } from "socket.io"
import os from "os"

// const { Server } = require("socket.io")

const app = express()

const server = http.createServer(app)

const io = new Server(server, {
    maxHttpBufferSize: 1e8
});

app.use(compression({ level: 9 }))
app.use(cors())
app.set("view engine", "ejs")

app.get("/", async (req, res) => {
    res.status(200).render("index.ejs")
})

app.get("/room", (req, res) => {
    res.status(200).render("room.ejs")
})

app.get("/scripts/:file", (req, res) => {
    let p = path.join(__dirname, "..", "node_modules", "socket.io", "client-dist", req.params.file)
    res.status(200).sendFile(p)
})

const listRooms = new Array()

io.on("connection", (socket: any) => {
    console.log("Conexão")
    listRooms.map((v) => {
        socket.on(`data-${v}`, (data: any) => {
            console.log("Sala:", v, " mandou a seguinte mensagem:", data)
            socket.broadcast.emit(`data-${v}`, data)
            // socket.emit(`data-${v}`, data)
        })
    })
    socket.on("room", (data: any) => {
        console.log("Sala:", data.uid, "criada com sucesso")
        console.log(listRooms.length + 1, "salas no total.")
        listRooms.push(data.uid)
    })
})

app.get("/verify-room/:codeRoom", async (req, res) => {
    if (listRooms.length === 0) return res.status(200).json({ message: "not exists", numberRooms: 0 })
    let x = 0;
    await Promise.all(listRooms.map((v) => {
        console.log(v, parseInt(req.params.codeRoom))
        console.log(v == parseInt(req.params.codeRoom))
        if (parseInt(req.params.codeRoom) == v) {
            console.log("Existe")
            return res.status(200).json({ message: "exists" })
        }
        x++
    }))
    if (x === listRooms.length)
        res.status(200).json({ message: "not exists", numberRooms: listRooms.length })
})

app.get("/info", (_, res) => {
    let totalMem = (((os.totalmem() / 1024) / 1024) / 1024).toFixed(2) + "GB"
    let freeMem = (((os.freemem() / 1024) / 1024) / 1024).toFixed(2) + "GB"
    let cores = os.cpus().length
    let OS = os.type()
    let platform = os.platform()

    res.status(200).json({
        totalMem, freeMem, cores, OS, platform
    })
})

server.listen(process.env.PORT || 3000)