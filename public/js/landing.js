(() => {
  "use strict"

  const NAME_KEY = "chat-realtime:name"
  const form = document.getElementById("entry-form")
  const nameInput = document.getElementById("name-input")
  const codeInput = document.getElementById("code-input")
  const codeField = document.getElementById("code-field")
  const errorEl = document.getElementById("form-error")
  const submitButton = document.getElementById("entry-submit")
  const submitLabel = document.getElementById("entry-submit-label")
  const spinner = submitButton.querySelector(".btn-spinner")
  const eyebrowEl = document.getElementById("entry-eyebrow")
  const titleEl = document.getElementById("entry-title")
  const subtitleEl = document.getElementById("entry-subtitle")

  let mode = "create"
  let loading = false

  const modes = {
    create: {
      eyebrow: "sala nova",
      title: "Cria uma sala",
      subtitle: "Escolhe um nome e começa.",
      label: "Criar sala",
      placeholder: "Como te chamam?",
    },
    join: {
      eyebrow: "entrar",
      title: "Entrar numa sala",
      subtitle: "Cola o código ou o link que te mandaram.",
      label: "Entrar",
      placeholder: "Como te chamam?",
    },
  }

  const codeFromInput = (raw) => {
    const value = String(raw || "").trim().toLowerCase()
    if (!value) return null

    const withoutQuery = value.split(/[?#]/)[0]
    const parts = withoutQuery.split("/").filter(Boolean)
    const candidate = parts[parts.length - 1] || ""
    return /^[a-z0-9]{6,12}$/.test(candidate) ? candidate : null
  }

  const setName = (name) => {
    try {
      sessionStorage.setItem(NAME_KEY, name)
    } catch {
      // sessionStorage pode estar bloqueado; o fluxo ainda funciona na página.
    }
  }

  const showError = (message) => {
    errorEl.textContent = message
    errorEl.classList.remove("is-hidden")
  }

  const clearError = () => {
    errorEl.textContent = ""
    errorEl.classList.add("is-hidden")
  }

  const setLoading = (value) => {
    loading = value
    submitButton.disabled = value
    spinner.classList.toggle("is-hidden", !value)
    submitLabel.textContent = value
      ? mode === "create"
        ? "criando..."
        : "entrando..."
      : modes[mode].label
  }

  const setMode = (nextMode) => {
    if (!modes[nextMode]) return

    mode = nextMode
    clearError()

    document.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode
      button.classList.toggle("is-active", active)
      button.setAttribute("aria-selected", String(active))
    })

    const config = modes[mode]
    eyebrowEl.textContent = config.eyebrow
    titleEl.textContent = config.title
    subtitleEl.textContent = config.subtitle
    submitLabel.textContent = config.label
    nameInput.placeholder = config.placeholder
    codeField.classList.toggle("is-hidden", mode !== "join")
    codeInput.disabled = mode !== "join"

    if (mode === "join") {
      codeInput.focus()
    } else {
      nameInput.focus()
    }
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode))
  })

  nameInput.addEventListener("input", clearError)
  codeInput.addEventListener("input", clearError)

  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    if (loading) return
    clearError()

    const name = nameInput.value.trim()
    if (Array.from(name).length < 2 || Array.from(name).length > 24) {
      showError("Escolhe um nome com 2 a 24 caracteres.")
      nameInput.focus()
      return
    }

    let roomCode = null
    if (mode === "join") {
      roomCode = codeFromInput(codeInput.value)
      if (!roomCode) {
        showError("Código inválido. Cola o código da sala ou o link completo.")
        codeInput.focus()
        return
      }
    }

    setName(name)
    setLoading(true)
    let navigating = false

    try {
      if (mode === "create") {
        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: { Accept: "application/json" },
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok || !payload?.data?.id) {
          throw new Error(payload?.message || "Não deu pra criar a sala agora.")
        }

        navigating = true
        window.location.assign("/room/" + encodeURIComponent(payload.data.id))
        return
      }

      const response = await fetch("/api/rooms/" + encodeURIComponent(roomCode), {
        headers: { Accept: "application/json" },
      })

      if (response.status === 404) {
        throw new Error("Sala não encontrada. Confere o código.")
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Não deu pra entrar na sala agora.")
      }

      navigating = true
      window.location.assign("/room/" + encodeURIComponent(roomCode))
    } catch (error) {
      showError(error instanceof Error ? error.message : "Algo deu errado. Tenta de novo.")
    } finally {
      if (!navigating) setLoading(false)
    }
  })

  try {
    const storedName = sessionStorage.getItem(NAME_KEY)
    if (storedName) nameInput.value = storedName
  } catch {
    // sem sessionStorage, o campo começa vazio
  }

  setMode("create")
})()
