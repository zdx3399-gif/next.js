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
    <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
        <span className="material-icons">meeting_room</span>
        預約設施
      </h2>
      <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-white mb-2">選擇設施</label>
          <select
            value={bookingForm.facilityId}
            onChange={(e) => setBookingForm({ ...bookingForm, facilityId: e.target.value })}
            className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] [&>option]:bg-[#2a2a2a] [&>option]:text-white [&>option]:py-2"
            required
          >
            <option value="" className="bg-[#2a2a2a] text-[#b0b0b0]">
              請選擇設施
            </option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id} className="bg-[#2a2a2a] text-white py-2">
                {facility.name} - {facility.location || "無位置資訊"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-white mb-2">預約日期</label>
          <input
            type="date"
            value={bookingForm.bookingDate}
            onChange={(e) => setBookingForm({ ...bookingForm, bookingDate: e.target.value })}
            min={new Date().toISOString().split("T")[0]}
            className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white mb-2">開始時間</label>
            <input
              type="time"
              value={bookingForm.startTime}
              onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
              className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
              required
            />
          </div>
          <div>
            <label className="block text-white mb-2">結束時間</label>
            <input
              type="time"
              value={bookingForm.endTime}
              onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
              className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-white mb-2">備註（選填）</label>
          <textarea
            value={bookingForm.notes}
            onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
            className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] min-h-[80px]"
            placeholder="請輸入備註事項"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
        >
          提交預約
        </button>
      </form>
    </div>
  )
}
