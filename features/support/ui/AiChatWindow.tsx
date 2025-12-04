"use client"

import { EmergencyButtons } from "@/features/emergencies/ui/EmergencyButtons"

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
}: AiChatWindowProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[var(--theme-bg-card)] border-l-2 border-[var(--theme-border-accent)] shadow-2xl flex flex-col z-[999] transition-all duration-500">
      <div className="flex items-center justify-between p-4 bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border)]">
        <div className="flex gap-2 items-center text-[var(--theme-accent)] font-bold">
          <span className="material-icons">smart_toy</span>
          AI 助理
        </div>
        <button onClick={onClose} className="material-icons text-[var(--theme-text-primary)] cursor-pointer">
          close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
      <div className="p-4 bg-[var(--theme-bg-primary)] border-t border-[var(--theme-border)]">
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
          <button
            onClick={sendMessage}
            className="p-2 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-500 disabled:cursor-not-allowed"
          >
            <span className="material-icons">send</span>
          </button>
        </div>
        <div className="flex justify-center gap-4 mt-3">
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
          <button
            onClick={() => setActiveTab("emergency")}
            className={`text-sm font-medium transition-colors ${
              activeTab === "emergency"
                ? "text-[var(--theme-accent)]"
                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            緊急協助
          </button>
        </div>
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
