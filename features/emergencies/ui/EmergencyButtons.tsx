"use client"

import { useEffect, useMemo, useState } from "react"
import { useEmergencies } from "../hooks/useEmergencies"
import { HelpHint } from "@/components/ui/help-hint"

interface EmergencyButtonsProps {
  userId?: string
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

export function EmergencyButtons({ userId, userName, onTrigger, variant = "full" }: EmergencyButtonsProps) {
  const { triggerEmergency, emergencies, reload } = useEmergencies(false)
  const [selectedType, setSelectedType] = useState("")
  const [selectedNote, setSelectedNote] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const myRecords = useMemo(() => {
    if (!userId) return []
    return emergencies.filter((item) => item.reported_by_id === userId)
  }, [emergencies, userId])

  useEffect(() => {
    if (userId) {
      reload(userId)
    }
  }, [userId, reload])

  const openForm = (type: string, note: string) => {
    setSelectedType(type)
    setSelectedNote(note)
    setLocation("")
    setDescription("")
  }

  const submitForm = async () => {
    if (!selectedType) return
    if (!location.trim() || !description.trim()) {
      alert("請填寫地點與事件描述")
      return
    }

    if (!confirm(`確定送出「${selectedType}」通報嗎？`)) return

    setSubmitting(true)
    try {
      await triggerEmergency(
        selectedType,
        selectedNote,
        userId,
        userName || "未知",
        location.trim(),
        description.trim(),
      )
      onTrigger?.()
      setSelectedType("")
      setSelectedNote("")
      setLocation("")
      setDescription("")
      if (userId) {
        await reload(userId)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const quickTrigger = async (type: string, note: string) => {
    if (!confirm(`確定送出「${type}」通報嗎？`)) return

    setSubmitting(true)
    try {
      await triggerEmergency(type, note, userId, userName || "未知", "管理室/社區入口", `${note}（快速通報）`)
      onTrigger?.()
      if (userId) {
        await reload(userId)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Sidebar 版本 - 簡潔的小��鈕
  if (variant === "sidebar") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {emergencyTypes.map((emergency) => (
          <div
            key={emergency.type}
            onClick={() => quickTrigger(emergency.type, emergency.note)}
            className="p-2 bg-[var(--theme-bg-secondary)] border border-[#f44336]/30 rounded-lg cursor-pointer hover:bg-[rgba(244,67,54,0.1)] transition-all text-center"
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
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => quickTrigger("救護車119", "醫療緊急狀況")}
          disabled={submitting}
          className="bg-[#f44336] text-white py-2 px-3 rounded-lg font-bold hover:bg-[#d32f2f] transition-colors disabled:opacity-60"
        >
          緊急救護 (119)
        </button>
        <button
          onClick={() => quickTrigger("報警110", "治安緊急狀況")}
          disabled={submitting}
          className="bg-[#ff9800] text-white py-2 px-3 rounded-lg font-bold hover:bg-[#f57c00] transition-colors disabled:opacity-60"
        >
          緊急報警 (110)
        </button>
        <button
          onClick={() => quickTrigger("訪客通知", "訪客到達通知")}
          disabled={submitting}
          className="bg-[#0284c7] text-white py-2 px-3 rounded-lg font-bold hover:bg-[#0369a1] transition-colors disabled:opacity-60"
        >
          訪客通知
        </button>
        <button
          onClick={() => quickTrigger("包裹通知", "包裹到件通知")}
          disabled={submitting}
          className="bg-[#0f766e] text-white py-2 px-3 rounded-lg font-bold hover:bg-[#115e59] transition-colors disabled:opacity-60"
        >
          包裹通知
        </button>
      </div>
    )
  }

  // Full 版本 - 完整的緊急事件頁面
  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[#f44336] mb-5 text-xl">
        <span className="material-icons">emergency</span>
        緊急事件
        <HelpHint
          title="住戶端緊急事件"
          description="遇到緊急狀況可立即通報管理端。請依實際情境點選最接近的類別，避免誤報。"
          workflow={[
            "先判斷現場狀況並點選最接近的通報類別。",
            "確認送出後立即同步進行現場處置或聯繫 110/119。",
            "事後可向管理端補充細節以利追蹤。",
          ]}
          logic={[
            "通報會留下事件時間與發起人，作為後續追溯依據。",
            "正確分類有助管理端快速派遣對應支援。",
          ]}
        />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {emergencyTypes.map((emergency) => (
          <div
            key={emergency.type}
            onClick={() => openForm(emergency.type, emergency.note)}
            className="p-4 bg-[var(--theme-bg-secondary)] border-l-4 border-[var(--theme-accent)] rounded-lg cursor-pointer hover:bg-[var(--theme-accent-light)] hover:translate-x-1 transition-all text-[var(--theme-text-primary)]"
          >
            {emergency.emoji} {emergency.type}
          </div>
        ))}
      </div>

      {selectedType && (
        <div className="mt-4 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)]">
          <h3 className="font-bold text-[var(--theme-accent)] mb-3">通報表單：{selectedType}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1 text-[var(--theme-text-primary)]">地點</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例如：A棟 1F 大廳"
                className="w-full px-3 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-[var(--theme-text-primary)]">發生什麼事</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="請描述目前狀況，例如有人昏倒、現場人數、是否已聯絡 119/110"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setSelectedType("")
                  setSelectedNote("")
                }}
                className="px-3 py-2 rounded-lg border border-[var(--theme-border)]"
              >
                取消
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="px-3 py-2 rounded-lg bg-[#f44336] text-white font-semibold disabled:opacity-60"
              >
                {submitting ? "送出中..." : "送出通報"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-[var(--theme-border)] pt-4">
        <h3 className="font-bold text-[var(--theme-accent)] mb-2">我的報緊紀錄</h3>
        <div className="space-y-2 max-h-72 overflow-auto">
          {myRecords.length === 0 ? (
            <div className="text-sm text-[var(--theme-text-muted)]">目前沒有通報紀錄</div>
          ) : (
            myRecords.map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)]">
                <div className="font-semibold text-[var(--theme-text-primary)]">{item.type}</div>
                <div className="text-sm text-[var(--theme-text-muted)] whitespace-pre-line">{item.note}</div>
                <div className="text-xs text-[var(--theme-text-muted)] mt-1">
                  {item.created_at ? new Date(item.created_at).toLocaleString("zh-TW", { hour12: false }) : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-[var(--theme-text-muted)] text-sm text-center flex items-center justify-center gap-2">
        點擊上方按鈕可立即通知管理員和相關單位
        <HelpHint title="住戶端通報提醒" description="系統會保留通報時間與發起人。若為誤觸，請盡快聯繫管理室說明。" workflow={["送出後先確認是否為正確通報。","若誤觸請立即聯繫管理室更正。"]} logic={["通報紀錄屬安全事件資料，需保留可追溯性。"]} align="center" />
      </div>
    </div>
  )
}
