import { randomUUID } from "node:crypto"

import type { HistoryMessage, Member, SystemMessage, TextMessage } from "../types"
import { LIMITS, colorForName, createRoomId } from "./validation"

export type RoomErrorCode = "ROOM_NOT_FOUND" | "ROOM_FULL" | "ROOM_LIMIT"

export class RoomError extends Error {
    constructor(
        public readonly code: RoomErrorCode,
        message: string,
    ) {
        super(message)
        this.name = "RoomError"
    }
}

export interface RoomRecord {
    id: string
    createdAt: number
    lastActivity: number
    members: Map<string, Member>
    messages: HistoryMessage[]
}

export class RoomStore {
    private readonly rooms = new Map<string, RoomRecord>()

    get size(): number {
        return this.rooms.size
    }

    createRoom(): RoomRecord {
        if (this.rooms.size >= LIMITS.roomMaxRooms) {
            this.cleanup(60 * 60 * 1000)
            if (this.rooms.size >= LIMITS.roomMaxRooms) {
                throw new RoomError(
                    "ROOM_LIMIT",
                    "O servidor atingiu o limite de salas ativas. Tente novamente mais tarde.",
                )
            }
        }

        let id = createRoomId()
        while (this.rooms.has(id)) id = createRoomId()

        const now = Date.now()
        const room: RoomRecord = {
            id,
            createdAt: now,
            lastActivity: now,
            members: new Map(),
            messages: [],
        }

        this.rooms.set(id, room)
        return room
    }

    getRoom(id: string): RoomRecord | undefined {
        return this.rooms.get(id)
    }

    hasRoom(id: string): boolean {
        return this.rooms.has(id)
    }

    join(roomId: string, socketId: string, requestedName: string): Member {
        const room = this.rooms.get(roomId)
        if (!room) throw new RoomError("ROOM_NOT_FOUND", "Sala não encontrada. Confira o código.")

        if (room.members.size >= LIMITS.roomMaxMembers) {
            throw new RoomError("ROOM_FULL", "Esta sala está cheia. Tente outra ou crie uma nova.")
        }

        const name = this.uniqueName(room, requestedName)
        const member: Member = {
            id: socketId,
            name,
            color: colorForName(name),
            joinedAt: Date.now(),
        }

        room.members.set(socketId, member)
        room.lastActivity = member.joinedAt
        return member
    }

    leave(roomId: string, socketId: string): Member | null {
        const room = this.rooms.get(roomId)
        if (!room) return null

        const member = room.members.get(socketId) ?? null
        if (!member) return null

        room.members.delete(socketId)
        room.lastActivity = Date.now()
        return member
    }

    addSystem(room: RoomRecord, text: string): SystemMessage {
        const message: SystemMessage = {
            id: randomUUID(),
            type: "system",
            text,
            createdAt: Date.now(),
        }

        this.pushMessage(room, message)
        return message
    }

    addText(room: RoomRecord, member: Member, text: string): TextMessage {
        const message: TextMessage = {
            id: randomUUID(),
            type: "text",
            user: { ...member },
            text,
            createdAt: Date.now(),
        }

        this.pushMessage(room, message)
        return message
    }

    members(room: RoomRecord): Member[] {
        return Array.from(room.members.values())
            .sort((a, b) => a.joinedAt - b.joinedAt)
            .map((member) => ({ ...member }))
    }

    messages(room: RoomRecord): HistoryMessage[] {
        return room.messages.slice()
    }

    cleanup(maxIdleMs: number, now = Date.now()): number {
        let removed = 0

        for (const [id, room] of this.rooms) {
            const isIdle = room.members.size === 0 && now - room.lastActivity > maxIdleMs
            if (isIdle) {
                this.rooms.delete(id)
                removed += 1
            }
        }

        return removed
    }

    private pushMessage(room: RoomRecord, message: HistoryMessage): void {
        room.messages.push(message)
        if (room.messages.length > LIMITS.historyMaxMessages) {
            room.messages.splice(0, room.messages.length - LIMITS.historyMaxMessages)
        }
        room.lastActivity = message.createdAt
    }

    private uniqueName(room: RoomRecord, baseName: string): string {
        const used = new Set(
            Array.from(room.members.values(), (member) => member.name.toLowerCase()),
        )

        if (!used.has(baseName.toLowerCase())) return baseName

        const characters = Array.from(baseName)
        for (let suffixNumber = 2; suffixNumber < 100; suffixNumber += 1) {
            const suffix = ` ${suffixNumber}`
            const available = Math.max(1, LIMITS.nameMax - Array.from(suffix).length)
            const candidate = characters.slice(0, available).join("").trimEnd() + suffix
            if (!used.has(candidate.toLowerCase())) return candidate
        }

        return characters.slice(0, 20).join("") + " " + Math.floor(Math.random() * 1000)
    }
}
