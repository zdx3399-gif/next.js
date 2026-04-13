"use client"

import { useEffect } from "react"

const DEFAULT_LOCK_MS = 2500

function lockButton(button: HTMLButtonElement, lockMs: number) {
  if (button.dataset.softLocking === "1") return

  const now = Date.now()
  const until = now + lockMs
  const previous = Number(button.dataset.softLockUntil || 0)

  if (previous > now) return

  button.dataset.softLockUntil = String(until)
  button.dataset.softLocking = "1"
  button.setAttribute("aria-busy", "true")
  button.classList.add("is-soft-locking")

  window.setTimeout(() => {
    const currentUntil = Number(button.dataset.softLockUntil || 0)

    if (Date.now() < currentUntil) return

    delete button.dataset.softLockUntil
    delete button.dataset.softLocking
    if (!button.isConnected) return
    button.removeAttribute("aria-busy")
    button.classList.remove("is-soft-locking")
  }, lockMs + 30)
}

export default function GlobalButtonSoftLock() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const button = target.closest("button") as HTMLButtonElement | null
      if (!button) return

      if (button.dataset.softLock === "off") return

      const now = Date.now()
      const until = Number(button.dataset.softLockUntil || 0)

      if (until > now) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const customMs = Number(button.dataset.softLockMs || DEFAULT_LOCK_MS)
      const lockMs = Number.isFinite(customMs) && customMs > 0 ? customMs : DEFAULT_LOCK_MS

      // Lock after the current event cycle so the first click/submit can proceed normally.
      window.setTimeout(() => lockButton(button, lockMs), 0)
    }

    document.addEventListener("click", onClick)
    return () => {
      document.removeEventListener("click", onClick)
    }
  }, [])

  return null
}
