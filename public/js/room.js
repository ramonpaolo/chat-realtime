(() => {
  "use strict"

  const NAME_KEY = "chat-realtime:name"
  const MAX_TEXT = 1000
  const MAX_FILES = 3
  const MAX_FILE_BYTES = 4 * 1024 * 1024
  const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "application/pdf",
    "text/plain",
  ])

  const roomId = document.body.dataset.room || ""
  const $ = (id) => document.getElementById(id)

  const refs = {
    sidebar: $("sidebar"),
    sidebarBackdrop: $("sidebar-backdrop"),
    openSidebar: $("open-sidebar"),
    closeSidebar: $("close-sidebar"),
    leaveRoom: $("leave-room"),
    copyRoom: $("copy-room"),
    copyLink: $("copy-link"),
    emptyCopy: $("empty-copy"),
    memberList: $("member-list"),
    memberCount: $("member-count"),
    connectionPill: $("connection-pill"),
    connectionLabel: $("connection-label"),
    connectionBanner: $("connection-banner"),
    connectionBannerText: $("connection-banner-text"),
    reconnectButton: $("reconnect-button"),
    messages: $("messages"),
    messagesList: $("messages-list"),
    emptyState: $("empty-state"),
    typingIndicator: $("typing-indicator"),
    scrollBottom: $("scroll-bottom"),
    composerForm: $("composer-form"),
    messageInput: $("message-input"),
    sendButton: $("send-button"),
    fileInput: $("file-input"),
    fileChips: $("file-chips"),
    charCount: $("char-count"),
    joinOverlay: $("join-overlay"),
    joinForm: $("join-form"),
    joinName: $("join-name"),
    joinError: $("join-error"),
    joinSubmit: $("join-submit"),
    joinSubmitLabel: $("join-submit-label"),
    joinSubtitle: $("join-subtitle"),
    toastStack: $("toast-stack"),
  }

  const state = {
    socket: null,
    joined: false,
    joining: false,
    leaving: false,
    self: null,
    members: [],
    messages: [],
    pending: new Map(),
    typing: new Map(),
    selectedFiles: [],
    atBottom: true,
    lastTypingSentAt: 0,
    typingStopTimer: null,
    autoJoinName: "",
    lastRendered: null,
  }

  const socket = io({ autoConnect: false })
  state.socket = socket

  function createIcon(name, className = "icon") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("class", className)
    svg.setAttribute("aria-hidden", "true")
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use")
    use.setAttribute("href", "#icon-" + name)
    svg.append(use)
    return svg
  }

  function safeColor(color) {
    return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#13f4b0"
  }

  function initials(name) {
    const chars = Array.from(String(name || "").trim()).slice(0, 2)
    return chars.length ? chars.join("").toUpperCase() : "?"
  }

  function formatTime(timestamp) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestamp))
    } catch {
      return ""
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1).replace(".", ",") + " KB"
    return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB"
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID()
    }
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
  }

  function createAvatar(name, color, extraClass = "") {
    const avatar = document.createElement("span")
    avatar.className = "avatar " + extraClass
    avatar.style.background = safeColor(color)
    avatar.textContent = initials(name)
    return avatar
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div")
    toast.className = "toast is-" + type
    toast.append(createIcon(type === "error" || type === "warning" ? "alert" : "check"))

    const text = document.createElement("span")
    text.textContent = message
    toast.append(text)
    refs.toastStack.append(toast)

    while (refs.toastStack.children.length > 3) {
      refs.toastStack.firstElementChild?.remove()
    }

    setTimeout(() => {
      toast.classList.add("is-leaving")
      setTimeout(() => toast.remove(), 190)
    }, 4200)
  }

  function setConnection(kind, label) {
    refs.connectionPill.className = "connection-pill is-" + kind
    refs.connectionLabel.textContent = label
  }

  function showBanner(message) {
    refs.connectionBannerText.textContent = message
    refs.connectionBanner.classList.remove("is-hidden")
  }

  function hideBanner() {
    refs.connectionBanner.classList.add("is-hidden")
  }

  function setComposerEnabled(enabled) {
    refs.messageInput.disabled = !enabled
    refs.fileInput.disabled = !enabled
    updateSendButton()
  }

  function updateSendButton() {
    const connected = state.socket.connected
    const hasContent = refs.messageInput.value.trim().length > 0 || state.selectedFiles.length > 0
    refs.sendButton.disabled = !(state.joined && connected && hasContent)
  }

  function updateCharCount() {
    const length = Array.from(refs.messageInput.value).length
    refs.charCount.textContent = length + " / " + MAX_TEXT
  }

  function resizeTextarea() {
    refs.messageInput.style.height = "auto"
    refs.messageInput.style.height = Math.min(refs.messageInput.scrollHeight, 150) + "px"
  }

  function isNearBottom() {
    const el = refs.messages
    return el.scrollHeight - el.scrollTop - el.clientHeight < 90
  }

  function scrollToBottom(behavior = "smooth") {
    refs.messages.scrollTo({ top: refs.messages.scrollHeight, behavior })
  }

  function updateScrollButton() {
    refs.scrollBottom.classList.toggle("is-visible", !state.atBottom)
  }

  function renderMembers() {
    refs.memberList.textContent = ""
    refs.memberCount.textContent = String(state.members.length)

    for (const member of state.members) {
      const item = document.createElement("li")
      item.className = "member"
      item.append(createAvatar(member.name, member.color))
      const name = document.createElement("span")
      name.className = "member-name"
      name.textContent = member.name
      item.append(name)
      if (state.self && member.id === state.self.id) {
        const you = document.createElement("span")
        you.className = "member-you"
        you.textContent = "você"
        item.append(you)
      }
      refs.memberList.append(item)
    }
  }

  function renderTyping() {
    refs.typingIndicator.textContent = ""

    const entries = Array.from(state.typing.values())
    if (!entries.length) return

    const names = entries.map((entry) => entry.name)
    let text = ""
    if (names.length === 1) text = names[0] + " tá digitando"
    else if (names.length === 2) text = names[0] + " e " + names[1] + " tão digitando"
    else text = names[0] + ", " + names[1] + " e mais " + (names.length - 2) + " tão digitando"

    const label = document.createElement("span")
    label.textContent = text
    refs.typingIndicator.append(label)

    const dots = document.createElement("span")
    dots.className = "typing-dots"
    dots.setAttribute("aria-hidden", "true")
    for (let i = 0; i < 3; i += 1) dots.append(document.createElement("span"))
    refs.typingIndicator.append(dots)
  }

  function clearTyping() {
    for (const entry of state.typing.values()) {
      if (entry.timer) clearTimeout(entry.timer)
    }
    state.typing.clear()
    renderTyping()
  }

  function createFileContent(message) {
    const bubble = document.createElement("div")
    bubble.className = "file-bubble"

    let url = message.localUrl || message.objectUrl
    if (!url && message.data) {
      url = URL.createObjectURL(new Blob([message.data], { type: message.mime }))
      message.objectUrl = url
    }

    if (!url) return bubble

    if (message.mime.startsWith("image/")) {
      const image = document.createElement("img")
      image.className = "file-image"
      image.src = url
      image.alt = message.name
      image.loading = "lazy"
      bubble.append(image)
      return bubble
    }

    if (message.mime.startsWith("video/")) {
      const video = document.createElement("video")
      video.className = "file-video"
      video.src = url
      video.controls = true
      video.preload = "metadata"
      bubble.append(video)
      return bubble
    }

    const card = document.createElement("div")
    card.className = "file-card"

    const icon = document.createElement("span")
    icon.className = "file-icon"
    icon.append(createIcon("file"))
    card.append(icon)

    const info = document.createElement("span")
    info.className = "file-info"
    const name = document.createElement("span")
    name.className = "file-name"
    name.textContent = message.name
    const size = document.createElement("span")
    size.className = "file-size"
    size.textContent = formatBytes(message.size)
    info.append(name, size)
    card.append(info)

    const download = document.createElement("a")
    download.className = "file-download"
    download.href = url
    download.download = message.name
    download.title = "Baixar arquivo"
    download.setAttribute("aria-label", "Baixar " + message.name)
    download.append(createIcon("download", "icon icon-sm"))
    card.append(download)

    bubble.append(card)
    return bubble
  }

  function appendMessage(message, options = {}) {
    const own = message.type !== "system" && state.self && message.user && message.user.id === state.self.id
    const element = document.createElement("div")

    if (message.type === "system") {
      element.className = "message is-system"
      const pill = document.createElement("span")
      pill.className = "message-system-pill"
      pill.append(createIcon("chat"))
      const label = document.createElement("span")
      label.textContent = message.text
      pill.append(label)
      element.append(pill)
      state.lastRendered = null
    } else {
      const grouped = Boolean(
        state.lastRendered &&
          state.lastRendered.userId === message.user.id &&
          message.createdAt - state.lastRendered.createdAt < 5 * 60 * 1000,
      )

      element.className = "message" + (own ? " is-own" : "") + (grouped ? " is-grouped" : "")
      if (message.id) element.dataset.messageId = message.id

      element.append(createAvatar(message.user.name, message.user.color, "message-avatar"))

      const body = document.createElement("div")
      body.className = "message-body"

      const meta = document.createElement("div")
      meta.className = "message-meta"
      const author = document.createElement("span")
      author.className = "message-author"
      author.textContent = own ? "você" : message.user.name
      const time = document.createElement("span")
      time.className = "message-time"
      time.textContent = formatTime(message.createdAt)
      meta.append(author, time)

      body.append(meta)
      body.append(message.type === "file" ? createFileContent(message) : (() => {
        const bubble = document.createElement("div")
        bubble.className = "message-bubble"
        bubble.textContent = message.text || ""
        return bubble
      })())

      if (message.status === "sending") addMessageStatus(body, message, "sending")
      if (message.status === "failed") addMessageStatus(body, message, "failed")

      element.append(body)
      state.lastRendered = { userId: message.user.id, createdAt: message.createdAt }
    }

    refs.messagesList.append(element)
    refs.emptyState.classList.toggle("is-hidden", state.messages.length > 0)

    if (options.scroll !== false) {
      if (own || state.atBottom) {
        scrollToBottom("smooth")
        state.atBottom = true
        updateScrollButton()
      } else {
        updateScrollButton()
      }
    }
  }

  function addMessageStatus(body, message, status) {
    const row = document.createElement("div")
    row.className = "message-status" + (status === "failed" ? " is-failed" : "")
    row.dataset.statusFor = message.id || ""

    if (status === "sending") {
      row.textContent = "enviando..."
    } else {
      row.textContent = "falhou"
      if (message.type === "text" && message.id) {
        const retry = document.createElement("button")
        retry.type = "button"
        retry.className = "retry-btn"
        retry.dataset.retry = message.id
        retry.textContent = "tentar novamente"
        row.append(" · ", retry)
      }
    }

    body.append(row)
  }

  function updateMessageStatus(messageId, status) {
    if (!messageId) return
    const selector = `[data-message-id="${window.CSS && CSS.escape ? CSS.escape(messageId) : messageId}"]`
    const element = refs.messagesList.querySelector(selector)
    if (!element) return

    const body = element.querySelector(".message-body")
    if (!body) return

    const current = body.querySelector(".message-status")
    if (status === "sent") {
      current?.remove()
      return
    }

    const message = state.messages.find((item) => item.id === messageId)
    if (current) {
      current.textContent = status === "failed" ? "" : "enviando..."
      current.classList.toggle("is-failed", status === "failed")
      if (status === "failed" && message?.type === "text") {
        current.textContent = "falhou · "
        const retry = document.createElement("button")
        retry.type = "button"
        retry.className = "retry-btn"
        retry.dataset.retry = messageId
        retry.textContent = "tentar novamente"
        current.append(retry)
      }
      return
    }

    if (message) addMessageStatus(body, message, status)
  }

  function renderAllMessages() {
    refs.messagesList.textContent = ""
    state.lastRendered = null

    for (const message of state.messages) {
      appendMessage(message, { scroll: false })
    }

    refs.emptyState.classList.toggle("is-hidden", state.messages.length > 0)
    state.atBottom = true
    updateScrollButton()
    requestAnimationFrame(() => scrollToBottom("auto"))
  }

  function clearPending() {
    for (const pending of state.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer)
    }
    state.pending.clear()
  }

  function markFailed(clientId, message) {
    const pending = state.pending.get(clientId)
    if (!pending) return
    if (pending.timer) clearTimeout(pending.timer)
    pending.status = "failed"
    updateMessageStatus(clientId, "failed")
    showToast(message, "error")
  }

  function schedulePendingTimeout(clientId) {
    const pending = state.pending.get(clientId)
    if (!pending) return
    if (pending.timer) clearTimeout(pending.timer)
    pending.timer = setTimeout(() => {
      if (!state.pending.has(clientId)) return
      markFailed(clientId, "o servidor não confirmou o envio. tenta de novo.")
    }, 12000)
  }

  function sendText(text) {
    if (!state.self || !state.socket.connected) return

    const clientId = uuid()
    const message = {
      id: clientId,
      type: "text",
      user: { ...state.self },
      text,
      createdAt: Date.now(),
      status: "sending",
    }

    state.messages.push(message)
    appendMessage(message)
    state.pending.set(clientId, message)
    schedulePendingTimeout(clientId)
    socket.emit("message:send", { text, clientId })
  }

  function sendFile(file) {
    if (!state.self || !state.socket.connected) return

    const clientId = uuid()
    const localUrl = URL.createObjectURL(file)
    const message = {
      id: clientId,
      type: "file",
      user: { ...state.self },
      name: file.name,
      mime: file.type,
      size: file.size,
      localUrl,
      createdAt: Date.now(),
      status: "sending",
    }

    state.messages.push(message)
    appendMessage(message)
    state.pending.set(clientId, message)
    schedulePendingTimeout(clientId)

    file
      .arrayBuffer()
      .then((buffer) => {
        if (!state.pending.has(clientId)) return
        socket.emit("file:send", {
          name: file.name,
          mime: file.type,
          data: buffer,
          clientId,
        })
      })
      .catch(() => {
        markFailed(clientId, "não deu pra ler o arquivo.")
      })
  }

  function sendCurrent() {
    if (!state.joined || !state.socket.connected) {
      showToast("espera a conexão com a sala.", "warning")
      return
    }

    const text = refs.messageInput.value.trim()
    const files = state.selectedFiles.slice()

    if (!text && !files.length) return
    if (Array.from(text).length > MAX_TEXT) {
      showToast("a mensagem passou de 1.000 caracteres.", "error")
      return
    }

    if (text) sendText(text)
    for (const file of files) sendFile(file)

    refs.messageInput.value = ""
    state.selectedFiles = []
    refs.fileChips.textContent = ""
    refs.fileInput.value = ""
    resizeTextarea()
    updateCharCount()
    updateSendButton()
    stopTyping()
    refs.messageInput.focus()
  }

  function isAllowedFile(file) {
    return ALLOWED_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_FILE_BYTES
  }

  function renderFileChips() {
    refs.fileChips.textContent = ""

    state.selectedFiles.forEach((file, index) => {
      const chip = document.createElement("span")
      chip.className = "file-chip"

      const name = document.createElement("span")
      name.className = "file-chip-name"
      name.textContent = file.name
      const size = document.createElement("span")
      size.className = "file-chip-size"
      size.textContent = formatBytes(file.size)

      const remove = document.createElement("button")
      remove.type = "button"
      remove.className = "file-chip-remove"
      remove.dataset.removeFile = String(index)
      remove.setAttribute("aria-label", "Remover " + file.name)
      remove.append(createIcon("close", "icon icon-xs"))

      chip.append(name, size, remove)
      refs.fileChips.append(chip)
    })

    updateSendButton()
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || [])
    for (const file of files) {
      if (state.selectedFiles.length >= MAX_FILES) {
        showToast("no máximo 3 arquivos por vez.", "warning")
        break
      }
      if (!isAllowedFile(file)) {
        showToast(
          "manda imagem, MP4/WebM, PDF ou texto de até 4 MB.",
          "error",
        )
        continue
      }
      state.selectedFiles.push(file)
    }
    renderFileChips()
  }

  function emitTyping() {
    if (!state.joined || !state.socket.connected) return
    const now = Date.now()
    if (now - state.lastTypingSentAt > 1500) {
      socket.emit("typing:start")
      state.lastTypingSentAt = now
    }
    if (state.typingStopTimer) clearTimeout(state.typingStopTimer)
    state.typingStopTimer = setTimeout(stopTyping, 1800)
  }

  function stopTyping() {
    if (state.typingStopTimer) {
      clearTimeout(state.typingStopTimer)
      state.typingStopTimer = null
    }
    if (state.lastTypingSentAt) {
      socket.emit("typing:stop")
      state.lastTypingSentAt = 0
    }
  }

  function setJoinLoading(loading) {
    refs.joinSubmit.disabled = loading
    const spinner = refs.joinSubmit.querySelector(".btn-spinner")
    if (spinner) spinner.classList.toggle("is-hidden", !loading)
    refs.joinSubmitLabel.textContent = loading ? "entrando..." : "Entrar"
  }

  function showJoinError(message) {
    refs.joinError.textContent = message
    refs.joinError.classList.remove("is-hidden")
  }

  function clearJoinError() {
    refs.joinError.textContent = ""
    refs.joinError.classList.add("is-hidden")
  }

  function showJoinOverlay() {
    refs.joinOverlay.classList.remove("is-hidden")
  }

  function hideJoinOverlay() {
    refs.joinOverlay.classList.add("is-hidden")
  }

  function attemptJoin(name, silent = false) {
    if (state.joining) return
    if (!socket.connected) {
      state.autoJoinName = name
      setJoinLoading(true)
      refs.joinSubtitle.textContent = "conectando..."
      return
    }

    state.joining = true
    setJoinLoading(true)
    clearJoinError()

    if (!silent) {
      showJoinOverlay()
      refs.joinSubtitle.textContent = "entrando..."
    } else {
      setConnection("connecting", "reconectando...")
    }

    socket.emit("room:join", { roomId, name })
  }

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value)
      showToast(successMessage)
      return
    } catch {
      try {
        const textarea = document.createElement("textarea")
        textarea.value = value
        textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0"
        document.body.append(textarea)
        textarea.focus()
        textarea.select()
        const copied = document.execCommand("copy")
        textarea.remove()
        if (copied) {
          showToast(successMessage)
          return
        }
      } catch {
        // fallback abaixo
      }
      showToast("não deu pra copiar. seleciona manualmente.", "error")
    }
  }

  function copyRoomLink() {
    copyText(window.location.origin + "/room/" + roomId, "link copiado.")
  }

  function closeSidebar() {
    refs.sidebar.classList.remove("is-open")
    refs.sidebarBackdrop.classList.add("is-hidden")
  }

  function openSidebar() {
    refs.sidebar.classList.add("is-open")
    refs.sidebarBackdrop.classList.remove("is-hidden")
  }

  function leaveRoom() {
    state.leaving = true
    state.joined = false
    socket.disconnect()
    window.location.assign("/")
  }

  function handleRoomState(payload) {
    state.joined = true
    state.joining = false
    state.self = payload.self
    state.members = payload.members
    state.messages = payload.messages
    state.autoJoinName = payload.self.name

    try {
      sessionStorage.setItem(NAME_KEY, payload.self.name)
    } catch {
      // sem sessionStorage, o nome ainda vale nesta página
    }

    hideJoinOverlay()
    setJoinLoading(false)
    hideBanner()
    setConnection("online", "online")
    clearTyping()
    clearPending()
    renderAllMessages()
    renderMembers()
    setComposerEnabled(true)
    updateSendButton()

    if (window.matchMedia("(min-width: 861px)").matches) {
      refs.messageInput.focus()
    }
  }

  function handleJoinError(payload) {
    state.joining = false
    setJoinLoading(false)
    showJoinOverlay()
    refs.joinSubtitle.textContent = "Como você quer aparecer?"
    showJoinError(payload?.message || "Não foi possível entrar na sala.")
    refs.joinName.focus()
  }

  function handleIncomingMessage(message) {
    if (!state.joined || !message) return
    state.messages.push(message)
    appendMessage(message)
  }

  function handleIncomingFile(message) {
    if (!state.joined || !message) return
    state.messages.push(message)
    appendMessage(message)
  }

  /* ── Socket lifecycle ─────────────────────────────────────────── */

  socket.on("connect", () => {
    setConnection("online", "online")
    hideBanner()

    if (state.joined && state.self) {
      attemptJoin(state.self.name, true)
      return
    }

    if (state.autoJoinName) {
      attemptJoin(state.autoJoinName)
    }
  })

  socket.on("disconnect", (reason) => {
    if (state.leaving) return

    setConnection("offline", "offline")
    setComposerEnabled(false)
    clearTyping()

    if (reason === "io server disconnect") {
      showBanner("o servidor encerrou a conexão. clica em reconectar.")
    } else {
      showBanner("a conexão caiu. tentando de novo...")
    }
  })

  socket.on("connect_error", () => {
    setConnection("offline", "offline")
    showBanner("não deu pra conectar. confere sua internet.")

    if (!state.joined) {
      setJoinLoading(false)
      refs.joinSubtitle.textContent = "conectando..."
    }
  })

  socket.io.on("reconnect_attempt", () => {
    setConnection("connecting", "reconectando...")
    showBanner("reconectando...")
  })

  socket.on("room:state", handleRoomState)
  socket.on("join:error", handleJoinError)
  socket.on("members:update", (members) => {
    state.members = members
    renderMembers()
  })
  socket.on("message:new", handleIncomingMessage)
  socket.on("file:new", handleIncomingFile)

  socket.on("message:sent", (payload) => {
    const pending = state.pending.get(payload.clientId)
    if (!pending) return
    if (pending.timer) clearTimeout(pending.timer)
    pending.status = "sent"
    pending.id = payload.message.id
    state.pending.delete(payload.clientId)
    updateMessageStatus(payload.clientId, "sent")
  })

  socket.on("file:sent", (payload) => {
    const pending = state.pending.get(payload.clientId)
    if (!pending) return
    if (pending.timer) clearTimeout(pending.timer)
    pending.status = "sent"
    pending.id = payload.message.id
    state.pending.delete(payload.clientId)
    updateMessageStatus(payload.clientId, "sent")
  })

  socket.on("send:error", (payload) => {
    markFailed(payload.clientId, payload.message || "Não foi possível enviar.")
  })

  socket.on("typing:show", (payload) => {
    if (!payload?.id) return
    const existing = state.typing.get(payload.id)
    if (existing?.timer) clearTimeout(existing.timer)
    const timer = setTimeout(() => {
      state.typing.delete(payload.id)
      renderTyping()
    }, 4000)
    state.typing.set(payload.id, { name: payload.name, timer })
    renderTyping()
  })

  socket.on("typing:hide", (payload) => {
    const existing = state.typing.get(payload.id)
    if (existing?.timer) clearTimeout(existing.timer)
    state.typing.delete(payload.id)
    renderTyping()
  })

  /* ── DOM events ───────────────────────────────────────────────── */

  refs.joinForm.addEventListener("submit", (event) => {
    event.preventDefault()
    if (state.joining) return

    const name = refs.joinName.value.trim()
    if (Array.from(name).length < 2 || Array.from(name).length > 24) {
      showJoinError("Escolha um nome com 2 a 24 caracteres.")
      refs.joinName.focus()
      return
    }

    try {
      sessionStorage.setItem(NAME_KEY, name)
    } catch {
      // sem sessionStorage, o nome ainda vale nesta página
    }

    state.autoJoinName = name
    attemptJoin(name)
  })

  refs.joinName.addEventListener("input", clearJoinError)

  refs.composerForm.addEventListener("submit", (event) => {
    event.preventDefault()
    sendCurrent()
  })

  refs.messageInput.addEventListener("input", () => {
    updateCharCount()
    resizeTextarea()
    updateSendButton()
    if (refs.messageInput.value.trim()) emitTyping()
    else stopTyping()
  })

  refs.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      sendCurrent()
    }
  })

  refs.messageInput.addEventListener("blur", stopTyping)

  refs.fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files)
    event.target.value = ""
  })

  refs.fileChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-file]")
    if (!button) return
    const index = Number(button.dataset.removeFile)
    if (!Number.isInteger(index)) return
    state.selectedFiles.splice(index, 1)
    renderFileChips()
  })

  refs.messagesList.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-retry]")
    if (!retry) return

    const id = retry.dataset.retry
    const message = state.messages.find((item) => item.id === id)
    if (!message || message.type !== "text" || message.status !== "failed") return

    message.status = "sending"
    state.pending.set(id, message)
    updateMessageStatus(id, "sending")
    schedulePendingTimeout(id)
    socket.emit("message:send", { text: message.text, clientId: id })
  })

  refs.messages.addEventListener("scroll", () => {
    state.atBottom = isNearBottom()
    updateScrollButton()
  })

  refs.scrollBottom.addEventListener("click", () => {
    state.atBottom = true
    updateScrollButton()
    scrollToBottom("smooth")
  })

  refs.copyRoom.addEventListener("click", () => {
    copyText(roomId, "código copiado.")
  })

  refs.copyLink.addEventListener("click", copyRoomLink)
  refs.emptyCopy.addEventListener("click", copyRoomLink)

  refs.leaveRoom.addEventListener("click", leaveRoom)

  refs.openSidebar.addEventListener("click", openSidebar)
  refs.closeSidebar.addEventListener("click", closeSidebar)
  refs.sidebarBackdrop.addEventListener("click", closeSidebar)

  refs.reconnectButton.addEventListener("click", () => {
    setConnection("connecting", "reconectando...")
    showBanner("tentando de novo...")
    if (!socket.connected) socket.connect()
    else if (!state.joined && state.autoJoinName) attemptJoin(state.autoJoinName, true)
  })

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar()
  })

  /* ── Boot ─────────────────────────────────────────────────────── */

  updateCharCount()
  resizeTextarea()
  setComposerEnabled(false)
  setJoinLoading(false)
  setConnection("connecting", "conectando...")

  try {
    const storedName = sessionStorage.getItem(NAME_KEY)
    if (storedName) {
      refs.joinName.value = storedName
      state.autoJoinName = storedName
      setJoinLoading(true)
      refs.joinSubtitle.textContent = "conectando..."
    }
  } catch {
    // sem sessionStorage; o formulário começa vazio
  }

  if (!state.autoJoinName) {
    refs.joinName.focus()
  }

  socket.connect()
})()
