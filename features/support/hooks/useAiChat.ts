"use client"

import { useState } from "react"
import { getAIResponse } from "../api/support"

interface Message {
  type: "user" | "bot"
  text: string
  images?: string[]
}

export function useAiChat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"functions" | "resident" | "emergency">("functions")

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input
    setMessages((prev) => [...prev, { type: "user", text: userMessage }])
    setInput("")
    setIsLoading(true)

    try {
      const data = await getAIResponse(userMessage)
      // 如果 data 是物件且有 answer 和 images
      if (typeof data === 'object' && 'answer' in data) {
        setMessages((prev) => [...prev, { 
          type: "bot", 
          text: data.answer,
          images: data.images || []
        }])
      } else {
        // 如果是字串
        setMessages((prev) => [...prev, { type: "bot", text: String(data) }])
      }
    } catch (error) {
      setMessages((prev) => [...prev, { type: "bot", text: "抱歉，發生錯誤，請稍後再試。" }])
    } finally {
      setIsLoading(false)
    }
  }

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen((prev) => !prev)

  return {
    input,
    setInput,
    messages,
    isLoading,
    isOpen,
    activeTab,
    setActiveTab,
    sendMessage,
    open,
    close,
    toggle,
  }
}
