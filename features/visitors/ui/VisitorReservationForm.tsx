"use client"

import type React from "react"

import { useState } from "react"
import type { VisitorReservation } from "../api/visitors"
import { HelpHint } from "@/components/ui/help-hint"

interface VisitorReservationFormProps {
  onSubmit: (reservation: VisitorReservation) => Promise<boolean>
  onCancel: () => void
}

export function VisitorReservationForm({ onSubmit, onCancel }: VisitorReservationFormProps) {
  const [form, setForm] = useState<VisitorReservation>({
    name: "",
    phone: "",
    purpose: "",
    reservation_time: "",
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
        預約訪客
        <HelpHint
          title="住戶端預約表單"
          description="填寫訪客基本資料與來訪時間，提交後管理端可提前掌握訪客資訊。"
        />
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-[var(--theme-text-primary)]">訪客姓名</label>
            <HelpHint
              title="住戶端訪客姓名"
              description="請填寫實際來訪者姓名，避免警衛現場核對困難。"
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
              align="center"
            />
          </div>
          <input
            type="datetime-local"
            value={form.reservation_time}
            onChange={(e) => setForm({ ...form, reservation_time: e.target.value })}
            min={new Date().toISOString().slice(0, 16)}
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
            確認預約
          </button>
        </div>
      </form>
    </div>
  )
}
