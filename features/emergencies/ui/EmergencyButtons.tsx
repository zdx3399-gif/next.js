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
  { type: "火災",     note: "發生火災，請立即撤離",     emoji: "🔥", icon: "local_fire_department", color: "#e53935" },
  { type: "水災",     note: "發生淹水或漏水緊急狀況",    emoji: "💧", icon: "water_damage",          color: "#1e88e5" },
  { type: "停電",     note: "發生停電或電力異常",        emoji: "⚡", icon: "power_off",             color: "#fb8c00" },
  { type: "設備故障", note: "重要設備發生故障需緊急處理", emoji: "🔧", icon: "build",                 color: "#8e24aa" },
  { type: "可疑人員", note: "陌生人員闖入或可疑行為",    emoji: "🕵️", icon: "person_search",         color: "#e53935" },
  { type: "其他",     note: "其他緊急狀況",              emoji: "⚠️", icon: "warning",              color: "#757575" },
]

export function EmergencyButtons({ userId, userName, onTrigger, variant = "full" }: EmergencyButtonsProps) {
  const { triggerEmergency, emergencies, reload } = useEmergencies(false)
  const [selectedType, setSelectedType] = useState("")
  const [selectedNote, setSelectedNote] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sendModeDialogOpen, setSendModeDialogOpen] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

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
    setSendModeDialogOpen(true)
  }

  const doSubmit = async (sendMode: "test" | "official") => {
    setSendModeDialogOpen(false)
    setSubmitting(true)
    try {
      let uploadedImageUrl: string | undefined
      if (imageFile) {
        const fd = new FormData()
        fd.append("file", imageFile)
        fd.append("folder", "emergencies")
        const uploadRes = await fetch("/api/upload-file", { method: "POST", body: fd })
        const uploadData = await uploadRes.json().catch(() => null)
        if (uploadData?.url) uploadedImageUrl = uploadData.url
      }
      await triggerEmergency(
        selectedType,
        selectedNote,
        userId,
        userName || "未知",
        location.trim(),
        description.trim(),
        sendMode,
        uploadedImageUrl,
      )
      onTrigger?.()
      setSelectedType("")
      setSelectedNote("")
      setLocation("")
      setDescription("")
      setImageFile(null)
      setImagePreview(null)
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
            onClick={() => openForm(emergency.type, emergency.note)}
            className="p-2 bg-[var(--theme-bg-secondary)] rounded-lg cursor-pointer transition-all text-center hover:opacity-80"
            style={{ borderLeft: `3px solid ${emergency.color}` }}
          >
            <div className="material-icons text-2xl mb-1" style={{ color: emergency.color }}>{emergency.icon}</div>
            <h3 className="font-bold text-xs" style={{ color: emergency.color }}>{emergency.type}</h3>
          </div>
        ))}
      </div>
    )
  }

  // Dashboard 版本 - AI Chat 內的按鈕
  if (variant === "dashboard") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {emergencyTypes.map((emergency) => (
          <button
            key={emergency.type}
            onClick={() => openForm(emergency.type, emergency.note)}
            disabled={submitting}
            className="py-2 px-3 rounded-lg font-bold transition-colors disabled:opacity-60 text-white"
            style={{ backgroundColor: emergency.color }}
          >
            {emergency.emoji} {emergency.type}
          </button>
        ))}
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
          <button
            key={emergency.type}
            onClick={() => openForm(emergency.type, emergency.note)}
            className="flex items-center gap-3 p-4 bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-xl cursor-pointer hover:bg-[var(--theme-bg-card)] hover:border-[var(--theme-accent)] transition-all text-left group"
            style={{ borderLeftWidth: 4, borderLeftColor: emergency.color }}
          >
            <span className="material-icons text-2xl flex-shrink-0" style={{ color: emergency.color }}>{emergency.icon}</span>
            <div>
              <div className="font-semibold text-[var(--theme-text-primary)] group-hover:text-[var(--theme-accent)]">{emergency.type}</div>
              <div className="text-xs text-[var(--theme-text-muted)] mt-0.5">{emergency.note}</div>
            </div>
          </button>
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
            </div>            <div>
              <label className="block text-sm mb-1 text-[var(--theme-text-primary)]">附圖（可選）</label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--theme-border)] hover:border-[var(--theme-accent)] transition-colors text-sm text-[var(--theme-text-muted)]">
                  <span className="material-icons text-base">📷</span>
                  {imageFile ? imageFile.name : "點擊上傳圖片"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setImageFile(file)
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (ev) => setImagePreview(ev.target?.result as string)
                        reader.readAsDataURL(file)
                      } else {
                        setImagePreview(null)
                      }
                    }}
                  />
                </label>
                {imageFile && (
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    移除
                  </button>
                )}
              </div>
              {imagePreview && (
                <img src={imagePreview} alt="preview" className="mt-2 rounded-lg max-h-32 object-cover border border-[var(--theme-border)]" />
              )}
            </div>            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setSelectedType("")
                  setSelectedNote("")
                }}
                className="px-3 py-2 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-card)] transition-all"
              >
                取消
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] font-semibold hover:opacity-90 transition-all disabled:opacity-60"
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

      {/* sendMode Dialog */}
      {sendModeDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="border-b border-[var(--theme-border)] p-5">
              <h3 className="text-lg font-bold text-[var(--theme-accent)]">🚨 選擇發送模式</h3>
              <p className="text-sm text-[var(--theme-text-secondary)] mt-3">請選擇要使用測試或正式模式發送緊急通報</p>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => doSubmit("test")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-amber-500/20 border border-amber-500 text-amber-600 hover:bg-amber-500/30 transition-colors"
              >
                🧪 測試傳送
                <div className="text-xs font-normal mt-1 opacity-80">僅通知管委會 + 管理員，加 [測試] 標記</div>
              </button>
              <button
                type="button"
                onClick={() => doSubmit("official")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-red-500/20 border border-red-500 text-red-600 hover:bg-red-500/30 transition-colors"
              >
                🚨 正式發布
                <div className="text-xs font-normal mt-1 opacity-80">審核通過後廣播給所有住戶</div>
              </button>
            </div>
            <div className="border-t border-[var(--theme-border)] p-3 bg-[var(--theme-bg-secondary)]">
              <button
                type="button"
                onClick={() => setSendModeDialogOpen(false)}
                className="w-full px-4 py-2 rounded-lg text-[var(--theme-text-secondary)] border border-[var(--theme-border)] hover:bg-[var(--theme-bg-primary)] transition-colors text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
