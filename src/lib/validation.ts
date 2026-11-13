import { randomBytes } from "node:crypto"

export const LIMITS = {
    nameMin: 2,
    nameMax: 24,
    messageMax: 1000,
    fileMaxBytes: 4 * 1024 * 1024,
    fileMaxNameLength: 120,
    roomMaxMembers: 30,
    roomMaxRooms: 500,
    historyMaxMessages: 100,
    messageRateLimit: 15,
    messageRateWindowMs: 10_000,
    fileRateLimit: 4,
    fileRateWindowMs: 30_000,
} as const

export const ROOM_ID_PATTERN = /^[a-z0-9]{6,12}$/
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const WHITESPACE = /\s+/g

const COLORS = [
    "#13f4b0",
    "#a78bfa",
    "#67e8f9",
    "#fbbf24",
    "#f472b6",
    "#a3e635",
    "#fb7185",
    "#c084fc",
]

const ALLOWED_FILE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "application/pdf",
    "text/plain",
])

export function normalizeName(raw: unknown): string | null {
    if (typeof raw !== "string") return null

    const value = raw
        .normalize("NFKC")
        .replace(CONTROL_CHARS, " ")
        .replace(WHITESPACE, " ")
        .trim()

    const length = Array.from(value).length
    if (length < LIMITS.nameMin || length > LIMITS.nameMax) return null
    return value
}

export function normalizeMessage(raw: unknown): string | null {
    if (typeof raw !== "string") return null

    const value = raw
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(CONTROL_CHARS, "")
        .trim()

    if (!value) return null
    if (Array.from(value).length > LIMITS.messageMax) return null
    return value
}

export function normalizeRoomId(raw: unknown): string | null {
    if (typeof raw !== "string") return null
    const value = raw.trim().toLowerCase()
    return ROOM_ID_PATTERN.test(value) ? value : null
}

export function normalizeClientId(raw: unknown): string {
    if (typeof raw !== "string") return ""
    const value = raw.trim()
    return /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : ""
}

export function createRoomId(): string {
    // 40 bits of entropy in a URL-safe, lowercase code (10 hex chars).
    return randomBytes(5).toString("hex")
}

export function colorForName(name: string): string {
    let hash = 0
    for (const char of name) {
        hash = (hash * 31 + char.codePointAt(0)!) | 0
    }
    return COLORS[Math.abs(hash) % COLORS.length]!
}

export interface ValidatedFile {
    name: string
    mime: string
    data: Buffer
    size: number
}

export type FileValidationResult =
    | { ok: true; file: ValidatedFile }
    | { ok: false; error: string }

function toBuffer(data: unknown): Buffer | null {
    if (Buffer.isBuffer(data)) return data
    if (data instanceof ArrayBuffer) return Buffer.from(data)
    if (ArrayBuffer.isView(data)) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    }
    return null
}

export function validateFileInput(input: unknown): FileValidationResult {
    if (!input || typeof input !== "object") {
        return { ok: false, error: "Arquivo inválido." }
    }

    const candidate = input as {
        name?: unknown
        mime?: unknown
        data?: unknown
    }

    if (typeof candidate.name !== "string") {
        return { ok: false, error: "O arquivo precisa ter um nome." }
    }

    const name = candidate.name
        .normalize("NFKC")
        .replace(CONTROL_CHARS, "")
        .replace(/[\\/]/g, "-")
        .trim()
        .slice(0, LIMITS.fileMaxNameLength)

    if (!name) {
        return { ok: false, error: "O arquivo precisa ter um nome." }
    }

    if (typeof candidate.mime !== "string" || !ALLOWED_FILE_TYPES.has(candidate.mime)) {
        return {
            ok: false,
            error: "Tipo de arquivo não permitido. Envie imagem, vídeo MP4/WebM, PDF ou texto.",
        }
    }

    const data = toBuffer(candidate.data)
    if (!data || data.length === 0) {
        return { ok: false, error: "O arquivo chegou vazio ou em um formato inválido." }
    }

    if (data.length > LIMITS.fileMaxBytes) {
        return { ok: false, error: "O arquivo passou do limite de 4 MB." }
    }

    return {
        ok: true,
        file: {
            name,
            mime: candidate.mime,
            data,
            size: data.length,
        },
    }
}
