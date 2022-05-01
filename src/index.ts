import express from "express"
import compression from "compression"
import cors from "cors"
import path from "path"
import http from "http"

const { Server } = require("socket.io")

const app = express()

const server = http.createServer(app)

const io = new Server(server);

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

server.listen(process.env.PORT)