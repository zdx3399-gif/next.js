"use client"

import type React from "react"

import { useFacilities } from "../hooks/useFacilities"
import { FacilityBookingForm } from "./FacilityBookingForm"

interface FacilityListProps {
  userId?: string
  userName?: string
  userRoom?: string
}

export function FacilityList({ userId, userName, userRoom }: FacilityListProps) {
  const { facilities, myBookings, loading, bookingForm, setBookingForm, handleBooking, handleCancelBooking } =
    useFacilities(userId)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await handleBooking(userName || "未知", userRoom)
    alert(result.message)
  }

  const onCancel = async (bookingId: string) => {
    if (confirm("確定要取消此預約？")) {
      const result = await handleCancelBooking(bookingId)
      alert(result.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[var(--theme-accent)]">載入中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <FacilityBookingForm
        facilities={facilities}
        bookingForm={bookingForm}
        setBookingForm={setBookingForm}
        onSubmit={onSubmit}
      />

      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
          <span className="material-icons">list</span>
          我的預約記錄
        </h2>
        <div className="space-y-3">
          {myBookings.length > 0 ? (
            myBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[var(--theme-text-primary)] font-bold">
                      {booking.facilities?.name || "設施"}
                    </div>
                    <div className="text-[var(--theme-text-muted)] text-sm">
                      日期: {new Date(booking.booking_date).toLocaleDateString("zh-TW")}
                    </div>
                    <div className="text-[var(--theme-text-muted)] text-sm">
                      時間: {booking.start_time} - {booking.end_time}
                    </div>
                    {booking.notes && (
                      <div className="text-[var(--theme-text-muted)] text-sm">備註: {booking.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        booking.status === "confirmed" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                      }`}
                    >
                      {booking.status === "confirmed" ? "已確認" : "已取消"}
                    </div>
                    {booking.status === "confirmed" && (
                      <button
                        onClick={() => onCancel(booking.id)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold border border-rose-400 text-rose-400 bg-transparent hover:bg-rose-400/15 transition-all"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[var(--theme-text-muted)] text-sm">
                  預約時間: {new Date(booking.created_at || "").toLocaleString("zh-TW")}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-8">目前沒有預約記錄</div>
          )}
        </div>
      </div>

      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
          <span className="material-icons">info</span>
          可用設施
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {facilities.map((facility) => (
            <div
              key={facility.id}
              className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg overflow-hidden hover:bg-[var(--theme-accent-light)] transition-all"
            >
              <div className="w-full h-40 bg-[var(--theme-bg-card)]">
                {facility.image_url ? (
                  <img
                    src={facility.image_url || "/placeholder.svg"}
                    alt={facility.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-icons text-6xl text-[var(--theme-text-muted)]">meeting_room</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="text-[var(--theme-text-primary)] font-bold text-lg mb-2">{facility.name}</div>
                {facility.description && (
                  <div className="text-[var(--theme-text-muted)] text-sm mb-2">{facility.description}</div>
                )}
                {facility.location && (
                  <div className="text-[var(--theme-text-muted)] text-sm flex items-center gap-1">
                    <span className="material-icons text-sm">place</span>
                    {facility.location}
                  </div>
                )}
                {facility.capacity && (
                  <div className="text-[var(--theme-text-muted)] text-sm flex items-center gap-1">
                    <span className="material-icons text-sm">people</span>
                    容納人數: {facility.capacity}
                  </div>
                )}
              </div>
            </div>
          ))}
          {facilities.length === 0 && (
            <div className="col-span-2 text-center text-[var(--theme-text-muted)] py-8">目前沒有可用設施</div>
          )}
        </div>
      </div>
    </div>
  )
}
