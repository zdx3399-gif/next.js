"use client"

import { useMaintenance } from "../hooks/useMaintenance"
import { MaintenanceForm } from "./MaintenanceForm"

interface MaintenanceListProps {
  userId?: string
  userName?: string
}

export function MaintenanceList({ userId, userName }: MaintenanceListProps) {
  const { maintenance, loading, reload } = useMaintenance(userId, true)

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd700]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MaintenanceForm userId={userId} userName={userName} onSuccess={reload} />

      <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
        <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
          <span className="material-icons">list</span>
          我的維修申請
        </h2>
        <div className="space-y-3">
          {maintenance.length > 0 ? (
            maintenance.map((item) => (
              <div
                key={item.id}
                className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-white font-bold">{item.equipment || "維修申請"}</div>
                    <div className="text-[#b0b0b0] text-sm">位置: {item.item || "未指定"}</div>
                    <div className="text-[#b0b0b0] text-sm">申請人: {item.reported_by || "未知"}</div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
                      item.status === "open"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : item.status === "progress"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {item.status === "open" ? "待處理" : item.status === "progress" ? "處理中" : "已完成"}
                  </div>
                </div>
                {item.description && <div className="text-white mb-2">{item.description}</div>}
                {item.photo_url && (
                  <div className="mb-2">
                    <img
                      src={item.photo_url || "/placeholder.svg"}
                      alt="維修照片"
                      className="max-w-full h-auto rounded-lg max-h-[200px]"
                    />
                  </div>
                )}
                <div className="text-[#b0b0b0] text-sm">
                  申請時間: {item.created_at ? new Date(item.created_at).toLocaleString("zh-TW") : "未知"}
                </div>
                {item.handler && <div className="text-[#b0b0b0] text-sm">處理人員: {item.handler}</div>}
              </div>
            ))
          ) : (
            <div className="text-center text-[#b0b0b0] py-8">目前沒有維修申請</div>
          )}
        </div>
      </div>
    </div>
  )
}
