import assert from "node:assert/strict"
import test from "node:test"

import { RoomStore } from "../src/lib/room-store"

test("cria sala, evita nomes duplicados e mantém histórico em memória", () => {
    const store = new RoomStore()
    const room = store.createRoom()

    assert.equal(store.hasRoom(room.id), true)

    const first = store.join(room.id, "socket-1", "Ana")
    const second = store.join(room.id, "socket-2", "Ana")

    assert.equal(first.name, "Ana")
    assert.equal(second.name, "Ana 2")
    assert.equal(store.members(room).length, 2)

    store.addSystem(room, "Ana entrou na sala")
    const text = store.addText(room, first, "olá")

    assert.equal(text.type, "text")
    assert.equal(store.messages(room).length, 2)
})

test("remove membros e limpa salas ociosas", () => {
    const store = new RoomStore()
    const room = store.createRoom()

    store.join(room.id, "socket-1", "Ana")
    store.join(room.id, "socket-2", "Beto")

    assert.equal(store.leave(room.id, "socket-1")?.name, "Ana")
    assert.equal(store.leave(room.id, "socket-2")?.name, "Beto")
    assert.equal(store.members(room).length, 0)

    const removed = store.cleanup(60 * 60 * 1000, Date.now() + 60 * 60 * 1000 + 1)

    assert.equal(removed, 1)
    assert.equal(store.hasRoom(room.id), false)
})

test("join em sala inexistente falha com RoomError", () => {
    const store = new RoomStore()

    assert.throws(
        () => store.join("nao-existe", "socket-1", "Ana"),
        /Sala não encontrada/,
    )
})
