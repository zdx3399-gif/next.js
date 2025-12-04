"use client"

import type React from "react"

import type { Facility } from "../api/facilities"

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
      </h2>
      <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">選擇設施</label>
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
          <label className="block text-[var(--theme-text-primary)] mb-2">預約日期</label>
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
            <label className="block text-[var(--theme-text-primary)] mb-2">開始時間</label>
            <input
              type="time"
              value={bookingForm.startTime}
              onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
              className="theme-input w-full p-3 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] mb-2">結束時間</label>
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
          <label className="block text-[var(--theme-text-primary)] mb-2">備註（選填）</label>
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
