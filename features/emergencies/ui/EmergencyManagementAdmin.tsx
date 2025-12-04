"use client"

import { useEmergencies } from "../hooks/useEmergencies"

interface EmergencyManagementAdminProps {
  currentUserName?: string
}

const emergencyTypes = [
  { icon: "local_hospital", title: "救護車 119", type: "救護車119", note: "醫療緊急狀況" },
  { icon: "report_problem", title: "報警 110", type: "報警110", note: "治安緊急狀況" },
  { icon: "favorite", title: "AED", type: "AED", note: "需要AED急救設備" },
  { icon: "warning", title: "可疑人員", type: "可疑人員", note: "陌生人員闘入警告" },
]

export function EmergencyManagementAdmin({ currentUserName }: EmergencyManagementAdminProps) {
  const { emergencies, loading, confirmAndTrigger, deleteEmergency } = useEmergencies(true)

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 緊急事件按鈕區 */}
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex gap-2 items-center text-[var(--theme-danger)] text-xl">
            <span className="material-icons">emergency</span>
            緊急事件
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {emergencyTypes.map((emergency) => (
            <div
              key={emergency.type}
              onClick={() => confirmAndTrigger(emergency.type, emergency.note, currentUserName || "管理員")}
              className="p-3 bg-[var(--theme-accent-light)] border border-[var(--theme-danger)]/30 rounded-lg cursor-pointer hover:bg-[rgba(244,67,54,0.1)] transition-all text-center text-[var(--theme-text-primary)]"
            >
              <div className="material-icons text-2xl mb-1">{emergency.icon}</div>
              <h3 className="font-bold text-xs">{emergency.title}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* 緊急事件紀錄表格 */}
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
            <span className="material-icons">history</span>
            緊急事件紀錄
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">類別</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">時間</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  發起人
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">備註</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {emergencies.length > 0 ? (
                emergencies.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.type}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.time ? new Date(row.time).toLocaleString("zh-TW") : ""}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.by}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.note}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <button
                        onClick={() => row.id && deleteEmergency(row.id)}
                        className="p-2 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                        title="刪除"
                      >
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    目前沒有緊急事件紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
