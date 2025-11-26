"use client"

import { useState } from "react"
import { getAIResponse } from "../api/support"

interface Message {
  type: "user" | "bot"
  text: string
}

export function useAiChat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"functions" | "resident" | "emergency">("functions")

  const sendMessage = () => {
    if (!input.trim()) return

    setMessages((prev) => [...prev, { type: "user", text: input }])

    setTimeout(() => {
      const response = getAIResponse(input)
      setMessages((prev) => [...prev, { type: "bot", text: response }])
    }, 500)

    setInput("")
  }

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen((prev) => !prev)

  return {
    input,
    setInput,
    messages,
    isOpen,
    activeTab,
    setActiveTab,
    sendMessage,
    open,
    close,
    toggle,
  }
}
