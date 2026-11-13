import type { SlidingWindow } from "./lib/rate-limit"

export interface Member {
    id: string
    name: string
    color: string
    joinedAt: number
}

export interface TextMessage {
    id: string
    type: "text"
    user: Member
    text: string
    createdAt: number
}

export interface SystemMessage {
    id: string
    type: "system"
    text: string
    createdAt: number
}

export type HistoryMessage = TextMessage | SystemMessage

export interface FileMessage {
    id: string
    type: "file"
    user: Member
    name: string
    mime: string
    size: number
    createdAt: number
}

export interface FilePayload extends FileMessage {
    data: ArrayBuffer | Uint8Array
}

export interface RoomState {
    room: {
        id: string
        createdAt: number
    }
    self: Member
    members: Member[]
    messages: HistoryMessage[]
}

export interface ClientToServerEvents {
    "room:join": (payload: { roomId: string; name: string }) => void
    "message:send": (payload: { text: string; clientId: string }) => void
    "file:send": (payload: {
        name: string
        mime: string
        data: ArrayBuffer | Uint8Array
        clientId: string
    }) => void
    "typing:start": () => void
    "typing:stop": () => void
}

export interface ServerToClientEvents {
    "room:state": (state: RoomState) => void
    "members:update": (members: Member[]) => void
    "message:new": (message: HistoryMessage) => void
    "message:sent": (payload: { clientId: string; message: TextMessage }) => void
    "file:new": (message: FilePayload) => void
    "file:sent": (payload: { clientId: string; message: FileMessage }) => void
    "typing:show": (payload: { id: string; name: string }) => void
    "typing:hide": (payload: { id: string }) => void
    "join:error": (payload: { code: string; message: string }) => void
    "send:error": (payload: { clientId: string; message: string }) => void
}

export interface InterServerEvents {}

export interface SocketData {
    roomId?: string
    member?: Member
    messageLimiter?: SlidingWindow
    fileLimiter?: SlidingWindow
}
