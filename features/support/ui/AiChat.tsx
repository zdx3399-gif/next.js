"use client"

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

  return (
    <>
      <AiChatButton onClick={open} isOpen={isOpen} />
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
      />
    </>
  )
}
