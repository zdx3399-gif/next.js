"use client"

import { useEmergencies } from "../hooks/useEmergencies"
import { useState } from "react"
import { HelpHint } from "@/components/ui/help-hint"

interface EmergencyManagementAdminProps {
  currentUserName?: string
  isPreviewMode?: boolean
}

const emergencyTypes = [
  { icon: "local_hospital", title: "救護車 119", type: "救護車119", note: "醫療緊急狀況" },
  { icon: "report_problem", title: "報警 110", type: "報警110", note: "治安緊急狀況" },
  { icon: "favorite", title: "AED", type: "AED", note: "需要AED急救設備" },
  { icon: "warning", title: "可疑人員", type: "可疑人員", note: "陌生人員闖入警告" },
]

// 預覽模式的模擬資料
const PREVIEW_EMERGENCIES = [
  { id: "preview-1", type: "救護車119", time: new Date().toISOString(), by: "王**", reported_by_name: "王**", note: "醫療緊急狀況" },
  { id: "preview-2", type: "可疑人員", time: new Date(Date.now() - 3600000).toISOString(), by: "管理員", reported_by_name: "管理員", note: "陌生人員闖入警告" },
]

export function EmergencyManagementAdmin({ currentUserName, isPreviewMode = false }: EmergencyManagementAdminProps) {
  const { emergencies: realEmergencies, loading, confirmAndTrigger, deleteEmergency } = useEmergencies(true)

  // 預覽模式使用模擬資料
  const emergencies = isPreviewMode ? PREVIEW_EMERGENCIES : realEmergencies

  const [searchTerm, setSearchTerm] = useState("")

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  const filteredEmergencies = emergencies.filter((emergency) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const reportedBy = emergency.by || emergency.reported_by_name || ""
    return (
      emergency.type?.toLowerCase().includes(term) ||
      reportedBy.toLowerCase().includes(term) ||
      emergency.note?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* 緊急事件按鈕區 */}
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex gap-2 items-center text-[var(--theme-danger)] text-xl">
            <span className="material-icons">emergency</span>
            緊急事件
            <HelpHint title="管理端緊急通報" description="可由管理端主動發起通報，並同步通知相關人員。" />
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
            <HelpHint title="管理端紀錄" description="查看通報歷史、發起人與備註，供事後追蹤與稽核。" />
          </h2>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--theme-text-primary)] text-sm">搜尋紀錄</span>
            <HelpHint title="管理端搜尋" description="可依類別、發起人或備註快速查詢事件。" align="center" />
          </div>
          <input
            type="text"
            placeholder="搜尋類別、發起人或備註..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 rounded-xl theme-input outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">類別</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">時間<HelpHint title="管理端時間欄" description="顯示事件建立時間，建議搭配監視器時間軸比對。" align="center" /></span>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">發起人<HelpHint title="管理端發起人欄" description="顯示住戶姓名或管理端帳號，便於回訪確認。" align="center" /></span>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">備註</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">操作<HelpHint title="管理端操作欄" description="僅在確認已結案或誤報時再刪除，避免影響追溯。" align="center" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEmergencies.length > 0 ? (
                filteredEmergencies.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.type}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.time ? new Date(row.time).toLocaleString("zh-TW") : ""}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.by || row.reported_by_name || "未知"}
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
                    {searchTerm ? "沒有符合條件的緊急事件紀錄" : "目前沒有緊急事件紀錄"}
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
