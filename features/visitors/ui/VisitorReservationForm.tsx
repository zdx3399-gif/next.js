"use client"

import type React from "react"

import { useState } from "react"
import type { VisitorReservation } from "../api/visitors"

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
    <div className="bg-white/5 border-2 border-[#ffd700]/30 rounded-xl p-5">
      <h3 className="flex gap-2 items-center text-[#ffd700] font-bold text-lg mb-4">
        <span className="material-icons">person_add</span>
        預約訪客
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white mb-2">訪客姓名</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
            required
          />
        </div>
        <div>
          <label className="block text-white mb-2">訪客電話</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
          />
        </div>
        <div>
          <label className="block text-white mb-2">來訪目的</label>
          <input
            type="text"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
            placeholder="例如：親友拜訪、送貨等"
          />
        </div>
        <div>
          <label className="block text-white mb-2">預約時間</label>
          <input
            type="datetime-local"
            value={form.reservation_time}
            onChange={(e) => setForm({ ...form, reservation_time: e.target.value })}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
            required
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg font-bold hover:bg-white/20 transition-all"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
          >
            確認預約
          </button>
        </div>
      </form>
    </div>
  )
}
