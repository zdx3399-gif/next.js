"use client"

import type React from "react"

import type { Facility } from "../api/facilities"
import { HelpHint } from "@/components/ui/help-hint"

interface BookingForm {
  facilityId: string
  bookingDate: string
  startTime: string
  endTime: string
  notes: string
}

interface FacilityBookingFormProps {
  facilities: Facility[]
  bookingForm: BookingForm
  setBookingForm: (form: BookingForm) => void
  onSubmit: (e: React.FormEvent) => void
}

export function FacilityBookingForm({ facilities, bookingForm, setBookingForm, onSubmit }: FacilityBookingFormProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
        <span className="material-icons">meeting_room</span>
        預約設施
        <HelpHint title="住戶端預約表單" description="填寫設施、日期與時段後送出，系統會建立預約申請。" />
      </h2>
      <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">選擇設施<HelpHint title="住戶端選擇設施" description="先選設施再安排可用時段。" align="center" /></label>
          <select
            value={bookingForm.facilityId}
            onChange={(e) => setBookingForm({ ...bookingForm, facilityId: e.target.value })}
            className="theme-select w-full p-3 rounded-lg"
            required
          >
            <option value="">請選擇設施</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name} - {facility.location || "無位置資訊"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">預約日期<HelpHint title="住戶端預約日期" description="僅能選擇今天之後可開放預約的日期。" align="center" /></label>
          <input
            type="date"
            value={bookingForm.bookingDate}
            onChange={(e) => setBookingForm({ ...bookingForm, bookingDate: e.target.value })}
            min={new Date().toISOString().split("T")[0]}
            className="theme-input w-full p-3 rounded-lg"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">開始時間<HelpHint title="住戶端開始時間" description="請確認與結束時間順序正確。" align="center" /></label>
            <input
              type="time"
              value={bookingForm.startTime}
              onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
              className="theme-input w-full p-3 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">結束時間<HelpHint title="住戶端結束時間" description="請留意不可早於開始時間。" align="center" /></label>
            <input
              type="time"
              value={bookingForm.endTime}
              onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
              className="theme-input w-full p-3 rounded-lg"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">備註（選填）<HelpHint title="住戶端備註" description="可填寫用途或特殊需求，供管理端參考。" align="center" /></label>
          <textarea
            value={bookingForm.notes}
            onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
            className="theme-input w-full p-3 rounded-lg min-h-[80px]"
            placeholder="請輸入備註事項"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all"
        >
          提交預約
        </button>
      </form>
    </div>
  )
}
