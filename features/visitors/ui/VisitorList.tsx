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
  const [searchTerm, setSearchTerm] = useState("")

  const { reservedVisitors, checkedInVisitors, historyVisitors, loading, handleReservation } = useVisitors({
    userRoom,
    currentUser,
    isAdmin: false,
  })

  const filterVisitors = (visitors: any[]) => {
    if (!searchTerm) return visitors
    const term = searchTerm.toLowerCase()
    return visitors.filter(
      (visitor) =>
        visitor.name?.toLowerCase().includes(term) ||
        visitor.phone?.toLowerCase().includes(term) ||
        visitor.purpose?.toLowerCase().includes(term),
    )
  }

  const filteredReserved = filterVisitors(reservedVisitors)
  const filteredCheckedIn = filterVisitors(checkedInVisitors)
  const filteredHistory = filterVisitors(historyVisitors)

  if (loading) {
    return <div className="text-center text-[var(--theme-text-muted)] py-8">載入中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 預約按鈕 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowReservationForm(!showReservationForm)}
          className="px-4 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all"
        >
          {showReservationForm ? "取消預約" : "預約訪客"}
        </button>
      </div>

      {/* 搜尋輸入 */}
      <div>
        <input
          type="text"
          placeholder="搜尋訪客姓名、電話或事由..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-xl theme-input outline-none"
        />
      </div>

      {/* 預約表單 */}
      {showReservationForm && (
        <VisitorReservationForm onSubmit={handleReservation} onCancel={() => setShowReservationForm(false)} />
      )}

      {/* 預約訪客 */}
      <div className="bg-[var(--theme-bg-secondary)] border-2 border-blue-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-blue-500 font-bold text-lg mb-4">
          <span className="material-icons">event</span>
          預約訪客 ({filteredReserved.length})
        </h3>
        <div className="space-y-3">
          {filteredReserved.length > 0 ? (
            filteredReserved.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-6">
              {searchTerm ? "沒有符合條件的預約訪客" : "目前沒有預約訪客"}
            </div>
          )}
        </div>
      </div>

      {/* 訪客中 */}
      <div className="bg-[var(--theme-bg-secondary)] border-2 border-yellow-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-yellow-500 font-bold text-lg mb-4">
          <span className="material-icons">how_to_reg</span>
          訪客中 ({filteredCheckedIn.length})
        </h3>
        <div className="space-y-3">
          {filteredCheckedIn.length > 0 ? (
            filteredCheckedIn.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-6">
              {searchTerm ? "沒有符合條件的訪客" : "目前沒有訪客"}
            </div>
          )}
        </div>
      </div>

      {/* 訪客歷史 */}
      <div className="bg-[var(--theme-bg-secondary)] border-2 border-green-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-green-500 font-bold text-lg mb-4">
          <span className="material-icons">history</span>
          訪客歷史 ({filteredHistory.length})
        </h3>
        <div className="space-y-3">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-6">
              {searchTerm ? "沒有符合條件的訪客歷史" : "目前沒有訪客歷史"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
