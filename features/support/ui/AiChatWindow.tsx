"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { EmergencyButtons } from "@/features/emergencies/ui/EmergencyButtons"
import { HelpHint } from "@/components/ui/help-hint"

interface User {
  id?: string
  name?: string
  room?: string
  phone?: string
  email?: string
}

interface Message {
  type: "user" | "bot"
  text: string
}

interface AiChatWindowProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  input: string
  setInput: (value: string) => void
  sendMessage: () => void
  activeTab: "functions" | "resident" | "emergency"
  setActiveTab: (tab: "functions" | "resident" | "emergency") => void
  currentUser?: User | null
  position: { x: number; y: number }
  onDrag: (position: { x: number; y: number }) => void
}

export function AiChatWindow({
  isOpen,
  onClose,
  messages,
  input,
  setInput,
  sendMessage,
  activeTab,
  setActiveTab,
  currentUser,
  position,
  onDrag,
}: AiChatWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // 限制在視窗範圍內
      const maxX = window.innerWidth - 384 // w-96 = 384px
      const maxY = window.innerHeight - 100

      const boundedX = Math.max(0, Math.min(newX, maxX))
      const boundedY = Math.max(0, Math.min(newY, maxY))

      onDrag({ x: boundedX, y: boundedY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return
      const touch = e.touches[0]

      const newX = touch.clientX - dragStart.x
      const newY = touch.clientY - dragStart.y

      const maxX = window.innerWidth - 384
      const maxY = window.innerHeight - 100

      const boundedX = Math.max(0, Math.min(newX, maxX))
      const boundedY = Math.max(0, Math.min(newY, maxY))

      onDrag({ x: boundedX, y: boundedY })
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      window.addEventListener("touchmove", handleTouchMove)
      window.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, dragStart, onDrag])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
  }

  if (!isOpen) return null

  return (
    <div
      ref={windowRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        maxHeight: "calc(100vh - 40px)",
      }}
      className="w-96 bg-[var(--theme-bg-card)] border-2 border-[var(--theme-border-accent)] rounded-xl shadow-2xl flex flex-col z-[999] transition-shadow"
    >
      {/* 可拖曳的標題列 */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="flex items-center justify-between p-4 bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border)] rounded-t-xl select-none"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <div className="flex gap-2 items-center text-[var(--theme-accent)] font-bold pointer-events-none">
          <span className="material-icons">smart_toy</span>
          AI 助理
          <HelpHint title="住戶端 AI 助理" description="可詢問常見流程、快速帶入常用問題，協助你找到功能入口。" align="center" />
          <span className="text-xs text-[var(--theme-text-muted)] font-normal ml-2">(可拖曳移動)</span>
        </div>
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="material-icons text-[var(--theme-text-primary)] cursor-pointer hover:text-[var(--theme-accent)] transition-colors"
        >
          close
        </button>
      </div>

      {/* 訊息區域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[300px]">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs p-3 rounded-lg ${
                msg.type === "user"
                  ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
                  : "bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)]"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* 輸入區域 */}
      <div className="p-4 bg-[var(--theme-bg-primary)] border-t border-[var(--theme-border)] rounded-b-xl">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") sendMessage()
            }}
            placeholder="輸入訊息..."
            className="theme-input flex-1 p-2 rounded-lg"
          />
          <HelpHint title="住戶端訊息輸入" description="輸入問題後送出；也可點下方快捷按鈕自動帶入文字。" align="center" />
          <button
            onClick={sendMessage}
            className="p-2 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-500 disabled:cursor-not-allowed"
          >
            <span className="material-icons">send</span>
          </button>
        </div>
        <div className="flex justify-center gap-4 mt-3">
          <HelpHint title="住戶端分頁" description="常用功能：快捷提問；住戶資訊：查看目前帳號資料。" align="center" />
          <button
            onClick={() => setActiveTab("functions")}
            className={`text-sm font-medium transition-colors ${
              activeTab === "functions"
                ? "text-[var(--theme-accent)]"
                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            常用功能
          </button>
          <button
            onClick={() => setActiveTab("resident")}
            className={`text-sm font-medium transition-colors ${
              activeTab === "resident"
                ? "text-[var(--theme-accent)]"
                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            住戶資訊
          </button>
{/*           <button
            onClick={() => setActiveTab("emergency")}
            className={`text-sm font-medium transition-colors ${
              activeTab === "emergency"
                ? "text-[var(--theme-accent)]"
                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            緊急協助
          </button> */}
        </div>
        {activeTab === "functions" && (
          <div className="flex items-center gap-2 mt-3 text-xs text-[var(--theme-text-muted)]">
            <span>常用問題快捷鍵</span>
            <HelpHint title="住戶端快捷提問" description="點擊按鈕會把問題填入輸入框，可再送出。" align="center" />
          </div>
        )}
        {activeTab === "functions" && (
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <button
              onClick={() => setInput("查詢公告")}
              className="p-2 rounded-md bg-[var(--theme-bg-secondary)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-accent-light)] hover:text-[var(--theme-text-primary)]"
            >
              查詢公告
            </button>
            <button
              onClick={() => setInput("我要報修")}
              className="p-2 rounded-md bg-[var(--theme-bg-secondary)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-accent-light)] hover:text-[var(--theme-text-primary)]"
            >
              我要報修
            </button>
            <button
              onClick={() => setInput("我的包裹在哪裡？")}
              className="p-2 rounded-md bg-[var(--theme-bg-secondary)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-accent-light)] hover:text-[var(--theme-text-primary)]"
            >
              我的包裹在哪裡？
            </button>
            <button
              onClick={() => setInput("查詢管理費")}
              className="p-2 rounded-md bg-[var(--theme-bg-secondary)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-accent-light)] hover:text-[var(--theme-text-primary)]"
            >
              查詢管理費
            </button>
            <button
              onClick={() => setInput("預約設施")}
              className="p-2 rounded-md bg-[var(--theme-bg-secondary)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-accent-light)] hover:text-[var(--theme-text-primary)]"
            >
              預約設施
            </button>
            <button
              onClick={() => setInput("修改個人資料")}
              className="p-2 rounded-md bg-[var(--theme-bg-secondary)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-accent-light)] hover:text-[var(--theme-text-primary)]"
            >
              修改個人資料
            </button>
          </div>
        )}
        {activeTab === "resident" && (
          <div className="mt-3 text-xs text-[var(--theme-text-muted)]">
            <p>您的姓名：{currentUser?.name}</p>
            <p>您的房號：{currentUser?.room}</p>
            <p>您的電話：{currentUser?.phone}</p>
            <p>您的Email：{currentUser?.email}</p>
          </div>
        )}
        {activeTab === "emergency" && (
          <div className="grid grid-cols-1 gap-2 mt-3 text-xs">
            <EmergencyButtons userName={currentUser?.name} onTrigger={onClose} variant="dashboard" />
          </div>
        )}
      </div>
    </div>
  )
}
