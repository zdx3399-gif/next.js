"use client"

import type React from "react"

import { useState } from "react"
import type { VisitorReservation } from "../api/visitors"
import { HelpHint } from "@/components/ui/help-hint"

function toLocalDateTimeInputValue(value: string | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${d}T${hh}:${mm}`
}

function nowLocalDateTimeInputValue(): string {
  return toLocalDateTimeInputValue(new Date().toISOString())
}

interface VisitorReservationFormProps {
  onSubmit: (reservation: VisitorReservation, sendMode: "test" | "official") => Promise<boolean>
  onCancel: () => void
  initialData?: VisitorReservation
  submitLabel?: string
  title?: string
}

export function VisitorReservationForm({
  onSubmit,
  onCancel,
  initialData,
  submitLabel = "確認預約",
  title = "預約訪客",
}: VisitorReservationFormProps) {
  const [form, setForm] = useState<VisitorReservation>({
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    purpose: initialData?.purpose || "",
    reservation_time: toLocalDateTimeInputValue(initialData?.reservation_time),
  })
  const [sendModeDialogOpen, setSendModeDialogOpen] = useState(false)

  const submitWithMode = async (sendMode: "test" | "official") => {
    const success = await onSubmit(form, sendMode)
    if (success) {
      setForm({ name: "", phone: "", purpose: "", reservation_time: "" })
      setSendModeDialogOpen(false)
      onCancel()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendModeDialogOpen(true)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--theme-border)]">
          <h3 className="flex gap-2 items-center text-[var(--theme-accent)] font-bold text-lg">
            <span className="material-icons">person_add</span>
            {title}
            <HelpHint
              title="住戶端預約表單"
              description="填寫訪客基本資料與來訪時間，提交後管理端可提前掌握訪客資訊。"
              workflow={[
                "依序填寫姓名、電話、來訪目的與預約時間。",
                "確認資料正確後點確認預約送出。",
                "送出後回到列表檢查是否出現在預約訪客區。",
              ]}
              logic={[
                "表單資料會提供給管理端作現場核對與門禁作業。",
              ]}
            />
          </h3>
          <button onClick={onCancel} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <form id="visitor-reservation-form" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">
                  訪客姓名
                  <HelpHint
                    title="住戶端訪客姓名"
                    description="請填寫實際來訪者姓名，避免警衛現場核對困難。"
                    workflow={["輸入訪客真實姓名。","與證件或常用稱呼比對後再送出。","避免使用暱稱造成查驗困難。"]}
                    logic={["姓名是管理端核對訪客身份的主要欄位。"]}
                    align="center"
                  />
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full p-3 rounded-xl theme-input outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">
                  訪客電話
                  <HelpHint
                    title="住戶端訪客電話"
                    description="建議填寫可聯絡電話，若現場有狀況可快速通知。"
                    workflow={["填寫可即時聯絡的電話。","確認號碼格式與位數正確。","異動時重新建立正確預約。"]}
                    logic={["電話可用於到場異常或臨時聯繫。"]}
                    align="center"
                  />
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full p-3 rounded-xl theme-input outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">
                  來訪目的
                  <HelpHint
                    title="住戶端來訪目的"
                    description="簡述拜訪原因（如親友、維修、送件），有助於管理端快速判斷。"
                    workflow={["簡短描述來訪目的。","若為維修或送件可補充重點資訊。","避免空白或過於模糊敘述。"]}
                    logic={["來訪目的可協助警衛快速判斷放行流程。"]}
                    align="center"
                  />
                </label>
                <input
                  type="text"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder="例如：親友拜訪、送貨等"
                  className="w-full p-3 rounded-xl theme-input outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">
                  預約時間
                  <HelpHint
                    title="住戶端預約時間"
                    description="請填預計到訪時間，系統限制為當前時間之後，避免填入過期資料。"
                    workflow={["選擇訪客預計到達的日期時間。","確認時間為未來時段。","送出前再次核對避免填錯日期。"]}
                    logic={["時間欄限制為現在之後，避免建立過期預約。"]}
                    align="center"
                  />
                </label>
                <input
                  type="datetime-local"
                  value={form.reservation_time}
                  onChange={(e) => setForm({ ...form, reservation_time: e.target.value })}
                  min={nowLocalDateTimeInputValue()}
                  required
                  className="w-full p-3 rounded-xl theme-input outline-none"
                />
              </div>
            </div>
          </form>
        </div>
        <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all">取消</button>
          <button type="submit" form="visitor-reservation-form" className="flex-1 px-4 py-3 rounded-xl font-semibold bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all">{submitLabel}</button>
        </div>
      </div>

      {sendModeDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="border-b border-[var(--theme-border)] p-5">
              <h3 className="text-lg font-bold text-[var(--theme-accent)]">🤖 選擇訪客通知頻道</h3>
              <p className="text-sm text-[var(--theme-text-secondary)] mt-3">請選擇要使用測試或正式 LINE BOT 發送訪客預約通知</p>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => submitWithMode("test")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-amber-500/20 border border-amber-500 text-amber-600 hover:bg-amber-500/30 transition-colors"
              >
                🧪 測試 BOT
              </button>
              <button
                type="button"
                onClick={() => submitWithMode("official")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-blue-500/20 border border-blue-500 text-blue-600 hover:bg-blue-500/30 transition-colors"
              >
                ✓ 正式 BOT
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
