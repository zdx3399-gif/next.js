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
  onSubmit: (reservation: VisitorReservation) => Promise<boolean>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await onSubmit(form)
    if (success) {
      setForm({ name: "", phone: "", purpose: "", reservation_time: "" })
      onCancel()
    }
  }

  return (
    <div className="bg-[var(--theme-bg-secondary)] border-2 border-[var(--theme-border-accent)] rounded-xl p-5">
      <h3 className="flex gap-2 items-center text-[var(--theme-accent)] font-bold text-lg mb-4">
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-[var(--theme-text-primary)]">訪客姓名</label>
            <HelpHint
              title="住戶端訪客姓名"
              description="請填寫實際來訪者姓名，避免警衛現場核對困難。"
              workflow={["輸入訪客真實姓名。","與證件或常用稱呼比對後再送出。","避免使用暱稱造成查驗困難。"]}
              logic={["姓名是管理端核對訪客身份的主要欄位。"]}
              align="center"
            />
          </div>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="theme-input w-full px-4 py-3 rounded-lg"
            required
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-[var(--theme-text-primary)]">訪客電話</label>
            <HelpHint
              title="住戶端訪客電話"
              description="建議填寫可聯絡電話，若現場有狀況可快速通知。"
              workflow={["填寫可即時聯絡的電話。","確認號碼格式與位數正確。","異動時重新建立正確預約。"]}
              logic={["電話可用於到場異常或臨時聯繫。"]}
              align="center"
            />
          </div>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="theme-input w-full px-4 py-3 rounded-lg"
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-[var(--theme-text-primary)]">來訪目的</label>
            <HelpHint
              title="住戶端來訪目的"
              description="簡述拜訪原因（如親友、維修、送件），有助於管理端快速判斷。"
              workflow={["簡短描述來訪目的。","若為維修或送件可補充重點資訊。","避免空白或過於模糊敘述。"]}
              logic={["來訪目的可協助警衛快速判斷放行流程。"]}
              align="center"
            />
          </div>
          <input
            type="text"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="theme-input w-full px-4 py-3 rounded-lg"
            placeholder="例如：親友拜訪、送貨等"
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-[var(--theme-text-primary)]">預約時間</label>
            <HelpHint
              title="住戶端預約時間"
              description="請填預計到訪時間，系統限制為當前時間之後，避免填入過期資料。"
              workflow={["選擇訪客預計到達的日期時間。","確認時間為未來時段。","送出前再次核對避免填錯日期。"]}
              logic={["時間欄限制為現在之後，避免建立過期預約。"]}
              align="center"
            />
          </div>
          <input
            type="datetime-local"
            value={form.reservation_time}
            onChange={(e) => setForm({ ...form, reservation_time: e.target.value })}
            min={nowLocalDateTimeInputValue()}
            className="theme-input w-full px-4 py-3 rounded-lg"
            required
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] rounded-lg font-bold hover:bg-[var(--theme-accent-light)] transition-all"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
