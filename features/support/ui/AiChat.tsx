"use client"

import { useState, useCallback, useEffect } from "react"
import { useAiChat } from "../hooks/useAiChat"
import { AiChatButton } from "./AiChatButton"
import { AiChatWindow } from "./AiChatWindow"

interface User {
  id?: string
  name?: string
  room?: string
  phone?: string
  email?: string
}

interface AiChatProps {
  currentUser?: User | null
}

export function AiChat({ currentUser }: AiChatProps) {
  const { input, setInput, messages, isOpen, activeTab, setActiveTab, sendMessage, open, close } = useAiChat()

  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 })
  const [windowPosition, setWindowPosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const updatePositions = () => {
      setButtonPosition({
        x: window.innerWidth - 100,
        y: window.innerHeight - 100,
      })
      setWindowPosition({
        x: Math.max(20, window.innerWidth - 420),
        y: 80,
      })
    }

    updatePositions()
    setMounted(true)

    // 監聽視窗大小變化
    window.addEventListener("resize", updatePositions)
    return () => window.removeEventListener("resize", updatePositions)
  }, [])

  const handleButtonDrag = useCallback((newPosition: { x: number; y: number }) => {
    setButtonPosition(newPosition)
  }, [])

  const handleWindowDrag = useCallback((newPosition: { x: number; y: number }) => {
    setWindowPosition(newPosition)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <>
      <AiChatButton onClick={open} isOpen={isOpen} position={buttonPosition} onDrag={handleButtonDrag} />
      <AiChatWindow
        isOpen={isOpen}
        onClose={close}
        messages={messages}
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        position={windowPosition}
        onDrag={handleWindowDrag}
      />
    </>
  )
}
