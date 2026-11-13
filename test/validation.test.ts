import assert from "node:assert/strict"
import test from "node:test"

import {
    LIMITS,
    normalizeMessage,
    normalizeName,
    normalizeRoomId,
    validateFileInput,
} from "../src/lib/validation"

test("normalizeName normaliza, remove caracteres de controle e aplica limites", () => {
    assert.equal(normalizeName("  Ana\nMaria  "), "Ana Maria")
    assert.equal(normalizeName("A"), null)
    assert.equal(normalizeName("x".repeat(LIMITS.nameMax + 1)), null)
    assert.equal(normalizeName(42), null)
    assert.equal(normalizeName("   "), null)
})

test("normalizeMessage preserva quebras de linha e limita o tamanho", () => {
    assert.equal(normalizeMessage("  oi\r\nmundo  "), "oi\nmundo")
    assert.equal(normalizeMessage("a\u0000b"), "ab")
    assert.equal(normalizeMessage(""), null)
    assert.equal(normalizeMessage("x".repeat(LIMITS.messageMax + 1)), null)
    assert.equal(normalizeMessage(10), null)
})

test("normalizeRoomId aceita apenas códigos seguros", () => {
    assert.equal(normalizeRoomId("ABC123"), "abc123")
    assert.equal(normalizeRoomId("abc"), null)
    assert.equal(normalizeRoomId("../../etc/passwd"), null)
    assert.equal(normalizeRoomId("1234567890123"), null)
    assert.equal(normalizeRoomId(null), null)
})

test("validateFileInput aceita mídia permitida e limpa o nome", () => {
    const result = validateFileInput({
        name: "../foto.png",
        mime: "image/png",
        data: Buffer.from([1, 2, 3, 4]),
    })

    assert.equal(result.ok, true)
    if (result.ok) {
        assert.equal(result.file.name, "..-foto.png")
        assert.equal(result.file.mime, "image/png")
        assert.equal(result.file.size, 4)
    }
})

test("validateFileInput rejeita tipos, vazio e arquivos grandes", () => {
    assert.equal(
        validateFileInput({
            name: "script.html",
            mime: "text/html",
            data: Buffer.from("<script>alert(1)</script>"),
        }).ok,
        false,
    )

    assert.equal(
        validateFileInput({
            name: "vazio.png",
            mime: "image/png",
            data: Buffer.alloc(0),
        }).ok,
        false,
    )

    assert.equal(
        validateFileInput({
            name: "grande.png",
            mime: "image/png",
            data: Buffer.alloc(LIMITS.fileMaxBytes + 1),
        }).ok,
        false,
    )
})
