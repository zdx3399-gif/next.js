"use client"

import { useState } from "react"
import { useVisitors } from "../hooks/useVisitors"
import { VisitorReservationForm } from "./VisitorReservationForm"
import { VisitorCard } from "./VisitorCard"

interface VisitorListProps {
  userRoom?: string | null
  currentUser?: any
}

export function VisitorList({ userRoom, currentUser }: VisitorListProps) {
  const [showReservationForm, setShowReservationForm] = useState(false)

  const { reservedVisitors, checkedInVisitors, historyVisitors, loading, handleReservation } = useVisitors({
    userRoom,
    currentUser,
    isAdmin: false,
  })

  if (loading) {
    return <div className="text-center text-[#b0b0b0] py-8">載入中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 預約按鈕 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowReservationForm(!showReservationForm)}
          className="px-4 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
        >
          {showReservationForm ? "取消預約" : "預約訪客"}
        </button>
      </div>

      {/* 預約表單 */}
      {showReservationForm && (
        <VisitorReservationForm onSubmit={handleReservation} onCancel={() => setShowReservationForm(false)} />
      )}

      {/* 預約訪客 */}
      <div className="bg-white/5 border-2 border-blue-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-blue-400 font-bold text-lg mb-4">
          <span className="material-icons">event</span>
          預約訪客 ({reservedVisitors.length})
        </h3>
        <div className="space-y-3">
          {reservedVisitors.length > 0 ? (
            reservedVisitors.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[#b0b0b0] py-6">目前沒有預約訪客</div>
          )}
        </div>
      </div>

      {/* 訪客中 */}
      <div className="bg-white/5 border-2 border-yellow-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-yellow-400 font-bold text-lg mb-4">
          <span className="material-icons">how_to_reg</span>
          訪客中 ({checkedInVisitors.length})
        </h3>
        <div className="space-y-3">
          {checkedInVisitors.length > 0 ? (
            checkedInVisitors.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[#b0b0b0] py-6">目前沒有訪客</div>
          )}
        </div>
      </div>

      {/* 訪客歷史 */}
      <div className="bg-white/5 border-2 border-green-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-green-400 font-bold text-lg mb-4">
          <span className="material-icons">history</span>
          訪客歷史 ({historyVisitors.length})
        </h3>
        <div className="space-y-3">
          {historyVisitors.length > 0 ? (
            historyVisitors.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[#b0b0b0] py-6">目前沒有訪客歷史</div>
          )}
        </div>
      </div>
    </div>
  )
}
