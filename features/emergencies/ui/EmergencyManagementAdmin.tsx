"use client"

import { useEmergencies } from "../hooks/useEmergencies"
import { useState } from "react"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, Search, CheckCircle, XCircle } from "lucide-react"

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "待審核", className: "bg-amber-500/20 text-amber-600 border border-amber-500/50" },
    "待審核": { label: "待審核", className: "bg-amber-500/20 text-amber-600 border border-amber-500/50" },
    approved: { label: "已通過", className: "bg-green-500/20 text-green-600 border border-green-500/50" },
    "已發布": { label: "已通過", className: "bg-green-500/20 text-green-600 border border-green-500/50" },
    rejected: { label: "已駁回", className: "bg-red-500/20 text-red-600 border border-red-500/50" },
    "已駁回": { label: "已駁回", className: "bg-red-500/20 text-red-600 border border-red-500/50" },
    draft: { label: "草稿", className: "bg-gray-400/20 text-[var(--theme-text-secondary)] border border-gray-400/50" },
  }
  const info = map[status || ""] ?? { label: status || "未知", className: "bg-gray-400/20 text-[var(--theme-text-secondary)] border border-gray-400/50" }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${info.className}`}>
      {info.label}
    </span>
  )
}

interface EmergencyManagementAdminProps {
  currentUserId?: string
  currentUserName?: string
  isPreviewMode?: boolean
}

const emergencyTypes = [
  { icon: "local_fire_department", title: "火災",     type: "火災",     note: "發生火災，請立即撤離",           color: "#e53935" },
  { icon: "water_damage",          title: "水災",     type: "水災",     note: "發生淹水或漏水緊急狀況",         color: "#1e88e5" },
  { icon: "power_off",             title: "停電",     type: "停電",     note: "發生停電或電力異常",             color: "#fb8c00" },
  { icon: "build",                 title: "設備故障", type: "設備故障", note: "重要設備發生故障需緊急處理",       color: "#8e24aa" },
  { icon: "person_search",         title: "可疑人員", type: "可疑人員", note: "陌生人員闖入或可疑行為",         color: "#e53935" },
  { icon: "warning",               title: "其他",     type: "其他",     note: "其他緊急狀況",                   color: "#757575" },
]

// 預覽模式的模擬資料
const PREVIEW_EMERGENCIES = [
  { id: "preview-1", type: "測試資料", time: new Date().toISOString(), by: "測試資料", reported_by_name: "測試資料", note: "測試資料", status: "draft", source: "", location: "" },
  { id: "preview-2", type: "測試資料", time: new Date(Date.now() - 3600000).toISOString(), by: "測試資料", reported_by_name: "測試資料", note: "測試資料", status: "draft", source: "", location: "" },
]

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
  const [sendModeDialogOpen, setSendModeDialogOpen] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewSendModeDialogOpen, setReviewSendModeDialogOpen] = useState(false)
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null)

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
    // 開啟 sendMode 選擇 dialog
    setSendModeDialogOpen(true)
  }

  const doSubmitCreate = async (sendMode: "test" | "official") => {
    setSendModeDialogOpen(false)
    setSubmitting(true)
    try {
      await triggerEmergency(
        draftType.trim(),
        draftNote.trim(),
        currentUserId,
        currentUserName || "管理員",
        draftLocation.trim(),
        draftDescription.trim(),
        sendMode,
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


  const pendingEmergencies = emergencies.filter((e) => {
    const status = e.status || ""
    return status === "pending" || status === "待審核"
  })

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

  const handleReview = async (incidentId: string, action: "approve" | "reject") => {
    if (!currentUserId) {
      alert("無法取得審核者身分，請重新登入")
      return
    }
    const label = action === "approve" ? "核准" : "駁回"
    if (!confirm(`確定要「${label}」此緊急事件嗎？${action === "approve" ? "\n核准後將廣播給住戶並觸發 IoT 緊急警報。" : ""}`)) return
    if (action === "approve") {
      setPendingReviewId(incidentId)
      setReviewSendModeDialogOpen(true)
    } else {
      setReviewingId(incidentId)
      try {
        await reviewEmergency(incidentId, action, currentUserId)
      } finally {
        setReviewingId(null)
      }
    }
  }

  const doReviewWithMode = async (sendMode: "test" | "official") => {
    setReviewSendModeDialogOpen(false)
    if (!pendingReviewId || !currentUserId) return
    const id = pendingReviewId
    setPendingReviewId(null)
    setReviewingId(id)
    try {
      await reviewEmergency(id, "approve", currentUserId, sendMode)
    } finally {
      setReviewingId(null)
    }
  }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {emergencyTypes.map((emergency) => (
            <button
              key={emergency.type}
              onClick={() => openCreateForm(emergency.type, emergency.note)}
              className="flex items-center gap-3 p-4 bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-xl cursor-pointer hover:bg-[var(--theme-bg-card)] hover:border-[var(--theme-accent)] transition-all text-left group"
              style={{ borderLeftWidth: 4, borderLeftColor: emergency.color }}
            >
              <span className="material-icons text-2xl flex-shrink-0" style={{ color: emergency.color }}>{emergency.icon}</span>
              <div>
                <div className="font-semibold text-[var(--theme-text-primary)] group-hover:text-[var(--theme-accent)]">{emergency.title}</div>
                <div className="text-xs text-[var(--theme-text-muted)] mt-0.5">{emergency.note}</div>
              </div>
            </button>
          ))}
        </div>

        {formMode && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-[var(--theme-border)]">
                <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">
                  <span className="material-icons">emergency</span>
                  {formMode === "create" ? "建立緊急事件" : "編輯緊急事件"}
                </h3>
                <button onClick={resetForm} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
                  <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--theme-text-primary)] font-medium mb-2">事件類別</label>
                    <input value={draftType} onChange={(e) => setDraftType(e.target.value)} placeholder="例如：火災" className="w-full p-3 rounded-xl theme-input outline-none" />
                  </div>
                  <div>
                    <label className="block text-[var(--theme-text-primary)] font-medium mb-2">發起人</label>
                    <input value={currentUserName || "管理員"} disabled className="w-full p-3 rounded-xl theme-input outline-none opacity-60 cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="block text-[var(--theme-text-primary)] font-medium mb-2">現場備註（必填）</label>
                  <textarea
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="請描述現場狀況，例如：2樓A棟有人昏倒，已通知119"
                    rows={4}
                    className="w-full p-3 rounded-xl theme-input outline-none resize-none"
                  />
                </div>
                {formMode === "create" && (
                  <>
                    <div>
                      <label className="block text-[var(--theme-text-primary)] font-medium mb-2">地點（必填）</label>
                      <input value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="例如：A 棟 1F 大廳" className="w-full p-3 rounded-xl theme-input outline-none" />
                    </div>
                    <div>
                      <label className="block text-[var(--theme-text-primary)] font-medium mb-2">事件描述（必填）</label>
                      <textarea
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder="請描述目前狀況，例如有人昏倒、現場人數、是否已聯絡 119/110"
                        rows={3}
                        className="w-full p-3 rounded-xl theme-input outline-none resize-none"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
                <button onClick={resetForm} disabled={submitting} className="flex-1 px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all disabled:opacity-60">取消</button>
                {formMode === "create" ? (
                  <button onClick={submitCreateForm} disabled={submitting} className="flex-1 px-4 py-3 rounded-xl font-semibold bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed">發送緊急通知</button>
                ) : (
                  <button onClick={submitEditForm} disabled={submitting} className="flex-1 px-4 py-3 rounded-xl font-semibold bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed">儲存編輯</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 待審核通報 */}
      {!isPreviewMode && pendingEmergencies.length > 0 && (
        <div className="bg-[var(--theme-bg-card)] border-2 border-amber-500/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-icons text-amber-500">pending_actions</span>
            <h2 className="text-amber-600 text-xl font-bold">待審核通報</h2>
            <span className="ml-1 bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pendingEmergencies.length}</span>
            <HelpHint title="緊急通報審核" description="所有來源（LINE 或網頁）的待審核緊急事件，需由管委會或管理員審核後才會廣播給所有住戶並觸發 IoT 警報。" workflow={["核實事件後點選「核准」，系統自動廣播並發送 IoT E 指令。","若為誤報，點選「駁回」結案，不廣播。"]} logic={["核准後無法撤銷，請確認事件屬實再操作。"]} />
          </div>
          <div className="space-y-3">
            {pendingEmergencies.map((row) => {
              const isLine = row.source === "line_report" || row.source === "line_session" || row.source === "resident"
              const sourceLabel = isLine
                ? { text: "LINE通報", cls: "bg-green-500/20 text-green-600 border border-green-500/50" }
                : { text: "網頁通報", cls: "bg-blue-500/20 text-blue-600 border border-blue-500/50" }
              return (
              <div key={row.id} className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-bold text-[var(--theme-text-primary)]">{row.type}</span>
                    <StatusBadge status={row.status} />
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${sourceLabel.cls}`}>{sourceLabel.text}</span>
                    {row.location && (
                      <span className="text-xs text-[var(--theme-text-secondary)] flex items-center gap-1">
                        <span className="material-icons text-sm">location_on</span>{row.location}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[var(--theme-text-secondary)]">
                    <span>發起人：{row.by || row.reported_by_name || "未知"}</span>
                    <span className="mx-2">·</span>
                    <span>{row.time ? new Date(row.time).toLocaleString("zh-TW") : ""}</span>
                  </div>
                  {row.note && (
                    <p className="text-sm text-[var(--theme-text-primary)] mt-1">{row.note}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => row.id && handleReview(row.id, "approve")}
                    disabled={reviewingId === row.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/50 text-green-600 hover:bg-green-500/30 transition-all text-sm font-semibold disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />核准
                  </button>
                  <button
                    onClick={() => row.id && handleReview(row.id, "reject")}
                    disabled={reviewingId === row.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 text-red-600 hover:bg-red-500/30 transition-all text-sm font-semibold disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />駁回
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 緊急事件紀錄表格 */}
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
            <span className="material-icons">history</span>
            緊急事件紀錄
            <HelpHint title="管理端紀錄" description="查看通報歷史、發起人與備註，供事後追蹤與稽核。" workflow={["先用搜尋定位事件。","查看時間、發起人與備註完成追蹤。"]} logic={["事件紀錄是檢討與稽核基礎資料。"]} />
          </h2>
          <Button variant="outline" onClick={() => void reload()} disabled={loading || isPreviewMode}>
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
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap w-24">狀態</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">類別</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">地點</th>
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
                filteredEmergencies.map((row) => {
                  const isPending = row.status === "pending" || row.status === "待審核"
                  const isLineSource = row.source === "line_report" || row.source === "line_session" || row.source === "resident"
                  return (
                    <tr key={row.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                      <td className="p-3 border-b border-[var(--theme-border)]">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                        {row.type}
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-secondary)] text-sm">
                        {row.location || "—"}
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
                        <div className="flex flex-wrap gap-1">
                          {isPending && isLineSource && currentUserId && (
                            <>
                              <button
                                onClick={() => row.id && handleReview(row.id, "approve")}
                                disabled={reviewingId === row.id}
                                className="p-1.5 rounded-lg border border-green-500/50 text-green-600 hover:bg-green-500/10 transition-all disabled:opacity-50"
                                title="核准"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => row.id && handleReview(row.id, "reject")}
                                disabled={reviewingId === row.id}
                                className="p-1.5 rounded-lg border border-red-500/50 text-red-600 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                title="駁回"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
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
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    {searchTerm ? "沒有符合條件的緊急事件紀錄" : "目前沒有緊急事件紀錄"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review sendMode Dialog */}
      {reviewSendModeDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="border-b border-[var(--theme-border)] p-5">
              <h3 className="text-lg font-bold text-[var(--theme-accent)]">🚨 選擇廣播通道</h3>
              <p className="text-sm text-[var(--theme-text-secondary)] mt-3">請選擇要使用測試或正式 LINE BOT 廣播緊急事件通知</p>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => doReviewWithMode("test")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-amber-500/20 border border-amber-500 text-amber-600 hover:bg-amber-500/30 transition-colors"
              >
                🧪 測試傳送
                <div className="text-xs font-normal mt-1 opacity-80">僅通知管委會 + 管理員，加 [測試] 標記</div>
              </button>
              <button
                type="button"
                onClick={() => doReviewWithMode("official")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-red-500/20 border border-red-500 text-red-600 hover:bg-red-500/30 transition-colors"
              >
                🚨 正式廣播
                <div className="text-xs font-normal mt-1 opacity-80">廣播給所有住戶並觸發 IoT 警報</div>
              </button>
            </div>
            <div className="border-t border-[var(--theme-border)] p-3 bg-[var(--theme-bg-secondary)]">
              <button
                type="button"
                onClick={() => { setReviewSendModeDialogOpen(false); setPendingReviewId(null) }}
                className="w-full px-4 py-2 rounded-lg text-[var(--theme-text-secondary)] border border-[var(--theme-border)] hover:bg-[var(--theme-bg-primary)] transition-colors text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* sendMode Dialog */}
      {sendModeDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="border-b border-[var(--theme-border)] p-5">
              <h3 className="text-lg font-bold text-[var(--theme-accent)]">🚨 選擇發送模式</h3>
              <p className="text-sm text-[var(--theme-text-secondary)] mt-3">請選擇要使用測試或正式模式發送緊急通報</p>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => doSubmitCreate("test")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-amber-500/20 border border-amber-500 text-amber-600 hover:bg-amber-500/30 transition-colors"
              >
                🧪 測試傳送
                <div className="text-xs font-normal mt-1 opacity-80">僅通知管委會 + 管理員，加 [測試] 標記</div>
              </button>
              <button
                type="button"
                onClick={() => doSubmitCreate("official")}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-red-500/20 border border-red-500 text-red-600 hover:bg-red-500/30 transition-colors"
              >
                🚨 正式發布
                <div className="text-xs font-normal mt-1 opacity-80">審核通過後廣播給所有住戶</div>
              </button>
            </div>
            <div className="border-t border-[var(--theme-border)] p-3 bg-[var(--theme-bg-secondary)]">
              <button
                type="button"
                onClick={() => setSendModeDialogOpen(false)}
                className="w-full px-4 py-2 rounded-lg text-[var(--theme-text-secondary)] border border-[var(--theme-border)] hover:bg-[var(--theme-bg-primary)] transition-colors text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}