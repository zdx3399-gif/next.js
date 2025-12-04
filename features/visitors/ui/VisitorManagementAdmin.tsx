"use client"

import { useVisitors } from "../hooks/useVisitors"
import { VisitorCard } from "./VisitorCard"

interface VisitorManagementAdminProps {
  currentUser?: any
}

export function VisitorManagementAdmin({ currentUser }: VisitorManagementAdminProps) {
  const {
    reservedVisitors,
    checkedInVisitors,
    historyVisitors,
    loading,
    searchTerm,
    setSearchTerm,
    handleCheckIn,
    handleCheckOut,
  } = useVisitors({ currentUser, isAdmin: true })

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
          <span className="material-icons">how_to_reg</span>
          訪客管理 (警衛)
        </h2>
      </div>

      {/* 搜尋欄 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="搜尋訪客姓名、房號或電話..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-3 rounded-lg theme-input outline-none"
        />
      </div>

      <div className="space-y-6">
        {/* 預約訪客 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-blue-500/30 rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-blue-500 font-bold text-lg mb-4">
            <span className="material-icons">event</span>
            預約訪客 ({reservedVisitors.length})
          </h3>
          <div className="space-y-3">
            {reservedVisitors.length > 0 ? (
              reservedVisitors.map((visitor) => (
                <VisitorCard key={visitor.id} visitor={visitor} isAdmin={true} onCheckIn={handleCheckIn} />
              ))
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的預約訪客" : "目前沒有預約訪客"}
              </div>
            )}
          </div>
        </div>

        {/* 訪客中 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-yellow-500/30 rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-yellow-500 font-bold text-lg mb-4">
            <span className="material-icons">how_to_reg</span>
            訪客中 ({checkedInVisitors.length})
          </h3>
          <div className="space-y-3">
            {checkedInVisitors.length > 0 ? (
              checkedInVisitors.map((visitor) => (
                <VisitorCard key={visitor.id} visitor={visitor} isAdmin={true} onCheckOut={handleCheckOut} />
              ))
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的訪客" : "目前沒有訪客"}
              </div>
            )}
          </div>
        </div>

        {/* 訪客歷史 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-green-500/30 rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-green-500 font-bold text-lg mb-4">
            <span className="material-icons">history</span>
            訪客歷史 ({historyVisitors.length})
          </h3>
          <div className="space-y-3">
            {historyVisitors.length > 0 ? (
              historyVisitors.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的訪客歷史" : "目前沒有訪客歷史"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
