"use client"

import { useState } from "react"
import { useMaintenance } from "../hooks/useMaintenance"
import { MaintenanceForm } from "./MaintenanceForm"

interface MaintenanceListProps {
  userId?: string
  userName?: string
}

export function MaintenanceList({ userId, userName }: MaintenanceListProps) {
  const { maintenance, loading, reload } = useMaintenance(userId, true)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredMaintenance = maintenance.filter((item) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      item.equipment?.toLowerCase().includes(term) ||
      false ||
      item.item?.toLowerCase().includes(term) ||
      false ||
      item.description?.toLowerCase().includes(term) ||
      false ||
      item.reported_by_name?.toLowerCase().includes(term) ||
      false
    )
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MaintenanceForm userId={userId} userName={userName} onSuccess={reload} />

      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
          <span className="material-icons">list</span>
          我的維修申請
        </h2>

        <div className="mb-4">
          <input
            type="text"
            placeholder="搜尋設備、項目、描述或報修人..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 rounded-xl theme-input outline-none"
          />
        </div>

        <div className="space-y-3">
          {filteredMaintenance.length > 0 ? (
            filteredMaintenance.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[var(--theme-text-primary)] font-bold">{item.equipment || "維修申請"}</div>
                    <div className="text-[var(--theme-text-muted)] text-sm">位置: {item.item || "未指定"}</div>
                    <div className="text-[var(--theme-text-muted)] text-sm">
                      申請人: {item.reported_by_name || "未知"}
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
                      item.status === "open"
                        ? "bg-yellow-500/20 text-yellow-500"
                        : item.status === "progress"
                          ? "bg-blue-500/20 text-blue-500"
                          : "bg-green-500/20 text-green-500"
                    }`}
                  >
                    {item.status === "open" ? "待處理" : item.status === "progress" ? "處理中" : "已完成"}
                  </div>
                </div>
                {item.description && <div className="text-[var(--theme-text-primary)] mb-2">{item.description}</div>}
                {item.image_url && (
                  <div className="mb-2">
                    <img
                      src={item.image_url || "/placeholder.svg"}
                      alt="維修照片"
                      className="max-w-full h-auto rounded-lg max-h-[200px]"
                    />
                  </div>
                )}
                <div className="text-[var(--theme-text-muted)] text-sm">
                  申請時間: {item.created_at ? new Date(item.created_at).toLocaleString("zh-TW") : "未知"}
                </div>
                {item.handler_name && item.handler_name !== "未指派" && (
                  <div className="text-[var(--theme-text-muted)] text-sm">處理人員: {item.handler_name}</div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-8">
              {searchTerm ? "沒有符合條件的維修申請" : "目前沒有維修申請"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
