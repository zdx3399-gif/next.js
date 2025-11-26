"use client"

import { useEmergencies } from "../hooks/useEmergencies"

interface EmergencyButtonsProps {
  userName?: string
  onTrigger?: () => void
  variant?: "dashboard" | "sidebar" | "full"
}

const emergencyTypes = [
  { type: "救護車119", note: "醫療緊急狀況", emoji: "🚑", icon: "local_hospital" },
  { type: "報警110", note: "治安緊急狀況", emoji: "🚨", icon: "report_problem" },
  { type: "AED", note: "需要AED急救設備", emoji: "❤️", icon: "favorite" },
  { type: "可疑人員", note: "陌生人員闖入警告", emoji: "⚠️", icon: "warning" },
]

export function EmergencyButtons({ userName, onTrigger, variant = "full" }: EmergencyButtonsProps) {
  const { confirmAndTrigger } = useEmergencies(false)

  const handleClick = (type: string, note: string) => {
    confirmAndTrigger(type, note, userName || "未知")
    onTrigger?.()
  }

  // Sidebar 版本 - 簡潔的小按鈕
  if (variant === "sidebar") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {emergencyTypes.map((emergency) => (
          <div
            key={emergency.type}
            onClick={() => handleClick(emergency.type, emergency.note)}
            className="p-2 bg-white/5 border border-[#f44336]/30 rounded-lg cursor-pointer hover:bg-[rgba(244,67,54,0.1)] transition-all text-center"
          >
            <div className="material-icons text-[#f44336] text-2xl mb-1">{emergency.icon}</div>
            <h3 className="text-[#f44336] font-bold text-xs">{emergency.type}</h3>
          </div>
        ))}
      </div>
    )
  }

  // Dashboard 版本 - AI Chat 內的按鈕
  if (variant === "dashboard") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleClick("救護車119", "醫療緊急狀況")}
          className="flex-1 bg-[#f44336] text-white py-2 px-3 rounded-lg font-bold hover:bg-[#d32f2f] transition-colors"
        >
          緊急救護 (119)
        </button>
        <button
          onClick={() => handleClick("報警110", "治安緊急狀況")}
          className="flex-1 bg-[#ff9800] text-white py-2 px-3 rounded-lg font-bold hover:bg-[#f57c00] transition-colors"
        >
          緊急報警 (110)
        </button>
      </div>
    )
  }

  // Full 版本 - 完整的緊急事件頁面
  return (
    <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[#f44336] mb-5 text-xl">
        <span className="material-icons">emergency</span>
        緊急事件
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {emergencyTypes.map((emergency) => (
          <div
            key={emergency.type}
            onClick={() => handleClick(emergency.type, emergency.note)}
            className="p-4 bg-white/5 border-l-4 border-[#ffd700] rounded-lg cursor-pointer hover:bg-[rgba(255,215,0,0.1)] hover:translate-x-1 transition-all"
          >
            {emergency.emoji} {emergency.type}
          </div>
        ))}
      </div>
      <div className="text-[#b0b0b0] text-sm text-center">點擊上方按鈕可立即通知管理員和相關單位</div>
    </div>
  )
}
