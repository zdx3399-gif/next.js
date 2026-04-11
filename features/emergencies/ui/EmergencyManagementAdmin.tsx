"use client"

import { useEmergencies } from "../hooks/useEmergencies"
import { useState } from "react"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, Search } from "lucide-react"

interface EmergencyManagementAdminProps {
  currentUserId?: string
  currentUserName?: string
  isPreviewMode?: boolean
}

const emergencyTypes = [
  { icon: "local_fire_department", title: "火災", type: "火災", note: "現場有火源或濃煙" },
  { icon: "water_drop", title: "水災", type: "水災", note: "漏水、淹水或管線破裂" },
  { icon: "bolt", title: "停電", type: "停電", note: "區域停電或電力異常" },
  { icon: "build", title: "設備故障", type: "設備故障", note: "公共設備異常或失效" },
  { icon: "warning", title: "可疑人員", type: "可疑人員", note: "陌生人員闖入警告" },
  { icon: "report_problem", title: "其他", type: "其他", note: "其他需要立即處理的緊急事件" },
]

// 預覽模式的模擬資料
const PREVIEW_EMERGENCIES = [
  { id: "preview-1", type: "測試資料", time: new Date().toISOString(), by: "測試資料", reported_by_name: "測試資料", note: "測試資料" },
  { id: "preview-2", type: "測試資料", time: new Date(Date.now() - 3600000).toISOString(), by: "測試資料", reported_by_name: "測試資料", note: "測試資料" },
]

function getStatusLabel(status?: string) {
  if (status === "pending") return "待管委會驗證"
  if (status === "submitted") return "已送出"
  if (status === "approved") return "已核准"
  if (status === "rejected") return "已駁回"
  if (status === "draft") return "草稿"
  return "未分類"
}

export function EmergencyManagementAdmin({ currentUserId, currentUserName, isPreviewMode = false }: EmergencyManagementAdminProps) {
  const { emergencies: realEmergencies, loading, triggerEmergency, editEmergency, deleteEmergency, reviewEmergency, reload } = useEmergencies(true)

  // 預覽模式使用模擬資料
  const emergencies = isPreviewMode ? PREVIEW_EMERGENCIES : realEmergencies

  const [searchTerm, setSearchTerm] = useState("")
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null)
  const [draftId, setDraftId] = useState<string>("")
  const [draftType, setDraftType] = useState<string>("")
  const [draftNote, setDraftNote] = useState<string>("")
  const [draftLocation, setDraftLocation] = useState<string>("")
  const [draftDescription, setDraftDescription] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  const openCreateForm = (type: string, note: string) => {
    setFormMode("create")
    setDraftId("")
    setDraftType(type)
    setDraftNote(note)
    setDraftLocation("")
    setDraftDescription("")
  }

  const openEditForm = (row: any) => {
    if (!row?.id) return
    setFormMode("edit")
    setDraftId(row.id)
    setDraftType(row.type || "")
    setDraftNote(row.note || "")
  }

  const resetForm = () => {
    setFormMode(null)
    setDraftId("")
    setDraftType("")
    setDraftNote("")
    setDraftLocation("")
    setDraftDescription("")
  }

  const submitCreateForm = async () => {
    if (!draftType.trim()) {
      alert("事件類別不可為空")
      return
    }
    if (!draftNote.trim()) {
      alert("備註不可為空，請輸入現場狀況")
      return
    }
    if (!draftLocation.trim() || !draftDescription.trim()) {
      alert("請填寫地點與事件描述")
      return
    }

    setSubmitting(true)
    try {
      await triggerEmergency(
        draftType.trim(),
        draftNote.trim(),
        currentUserId,
        currentUserName || "管理員",
        draftLocation.trim(),
        draftDescription.trim(),
      )
      resetForm()
      reload()
    } finally {
      setSubmitting(false)
    }
  }

  const submitEditForm = async () => {
    if (!draftId) return
    if (!draftType.trim()) {
      alert("事件類別不可為空")
      return
    }
    if (!draftNote.trim()) {
      alert("備註不可為空，請輸入現場狀況")
      return
    }

    setSubmitting(true)
    try {
      await editEmergency(draftId, { type: draftType.trim(), note: draftNote.trim() })
      resetForm()
    } finally {
      setSubmitting(false)
    }
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
            <HelpHint title="管理端緊急通報" description="可由管理端主動發起通報，並同步通知相關人員。" workflow={["依事件類型點選對應緊急按鈕。","同步通知相關單位並啟動應變流程。"]} logic={["管理端主動通報可在住戶未回報時快速啟動處置。"]} />
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {emergencyTypes.map((emergency) => (
            <div
              key={emergency.type}
              onClick={() => openCreateForm(emergency.type, emergency.note)}
              className="p-3 bg-[var(--theme-accent-light)] border border-[var(--theme-danger)]/30 rounded-lg cursor-pointer hover:bg-[rgba(244,67,54,0.1)] transition-all text-center text-[var(--theme-text-primary)]"
            >
              <div className="material-icons text-2xl mb-1">{emergency.icon}</div>
              <h3 className="font-bold text-xs">{emergency.title}</h3>
            </div>
          ))}
        </div>

        {formMode && (
          <div className="mt-4 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] space-y-3">
            <h3 className="text-[var(--theme-text-primary)] font-semibold">
              {formMode === "create" ? "建立緊急事件" : "編輯緊急事件"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[var(--theme-text-secondary)]">事件類別</label>
                <Input value={draftType} onChange={(e) => setDraftType(e.target.value)} placeholder="例如：救護車119" />
              </div>
              <div>
                <label className="text-sm text-[var(--theme-text-secondary)]">發起人</label>
                <Input value={currentUserName || "管理員"} disabled />
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--theme-text-secondary)]">現場備註（必填）</label>
              <Textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="請描述現場狀況，例如：2樓A棟有人昏倒，已通知119"
                rows={4}
              />
            </div>
            {formMode === "create" && (
              <>
                <div>
                  <label className="text-sm text-[var(--theme-text-secondary)]">地點（必填）</label>
                  <Input value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="例如：A 棟 1F 大廳" />
                </div>
                <div>
                  <label className="text-sm text-[var(--theme-text-secondary)]">事件描述（必填）</label>
                  <Textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="例如：訪客已到管理室，請住戶下樓接待"
                    rows={3}
                  />
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} disabled={submitting}>取消</Button>
              {formMode === "create" ? (
                <Button onClick={submitCreateForm} disabled={submitting}>送出事件</Button>
              ) : (
                <Button onClick={submitEditForm} disabled={submitting}>儲存編輯</Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 緊急事件紀錄表格 */}
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
            <span className="material-icons">history</span>
            緊急事件紀錄
            <HelpHint title="管理端紀錄" description="查看通報歷史、發起人與備註，供事後追蹤與稽核。" workflow={["先用搜尋定位事件。","查看時間、發起人與備註完成追蹤。"]} logic={["事件紀錄是檢討與稽核基礎資料。"]} />
          </h2>
          <Button variant="outline" onClick={reload} disabled={loading || isPreviewMode}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
        </div>

        <div className="mb-4 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--theme-text-primary)] text-sm">搜尋紀錄</span>
            <HelpHint title="管理端搜尋" description="可依類別、發起人或備註快速查詢事件。" workflow={["輸入類別、人名或關鍵字。","依結果展開目標事件。"]} logic={["搜尋不改資料，只加速事件定位。"]} align="center" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
            <Input
              placeholder="搜尋類別、發起人或備註..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">類別</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">狀態</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">時間<HelpHint title="管理端時間欄" description="顯示事件建立時間，建議搭配監視器時間軸比對。" workflow={["先確認通報時間。","必要時與監視器時間交叉比對。"]} logic={["時間欄是事件還原與調查關鍵。"]} align="center" /></span>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">發起人<HelpHint title="管理端發起人欄" description="顯示住戶姓名或管理端帳號，便於回訪確認。" workflow={["查看是住戶還是管理端發起。","需要時回訪確認現場細節。"]} logic={["發起人欄可對應責任與後續聯繫窗口。"]} align="center" /></span>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">備註</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">操作<HelpHint title="管理端操作欄" description="僅在確認已結案或誤報時再刪除，避免影響追溯。" workflow={["先確認事件已結案或判定誤報。","再執行刪除避免保留錯誤資料。"]} logic={["刪除會減少可追溯資訊，應審慎操作。"]} align="center" /></span>
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
                      <span className="px-2 py-1 rounded-md text-xs border border-[var(--theme-border)]">
                        {getStatusLabel(row.status)}
                      </span>
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
                      {row.status === "pending" && row.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => reviewEmergency(row.id!, "approve", currentUserId)}
                            className="p-2 rounded-lg border border-[var(--theme-border)] text-green-700 hover:bg-green-50 transition-all"
                            title="核准"
                          >
                            <span className="material-icons text-lg">check_circle</span>
                          </button>
                          <button
                            onClick={() => reviewEmergency(row.id!, "reject", currentUserId)}
                            className="p-2 rounded-lg border border-[var(--theme-border)] text-red-700 hover:bg-red-50 transition-all"
                            title="駁回"
                          >
                            <span className="material-icons text-lg">cancel</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditForm(row)}
                            className="p-2 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-accent-light)] transition-all"
                            title="編輯"
                          >
                            <span className="material-icons text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => row.id && deleteEmergency(row.id)}
                            className="p-2 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                            title="刪除"
                          >
                            <span className="material-icons text-lg">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--theme-text-secondary)]">
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
