"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useModerationItemDetail } from "../hooks/useModeration"
import type { User } from "@/features/profile/api/profile"
import { CheckCircle, EyeOff, XCircle, Flag, Ban } from "lucide-react"

interface MobileReviewDialogProps {
  open: boolean
  itemId: string
  currentUser: User
  onClose: () => void
  onResolved: () => void
}

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  urgent: { label: "緊急", className: "bg-red-600 text-white" },
  high:   { label: "高",   className: "bg-orange-500 text-white" },
  medium: { label: "中",   className: "bg-yellow-500 text-white" },
  low:    { label: "低",   className: "bg-gray-500 text-white" },
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  post: "貼文", comment: "留言", report: "檢舉",
}

// 對應 item_type 的可用動作
function getActions(itemType: string) {
  if (itemType === "report") {
    return [
      { action: "approve",       label: "檢舉成立",  icon: Flag,        cls: "bg-red-600 hover:bg-red-700 text-white" },
      { action: "reject_report", label: "駁回檢舉",  icon: Ban,         cls: "bg-gray-500 hover:bg-gray-600 text-white" },
    ]
  }
  return [
    { action: "approve", label: "通過發布",   icon: CheckCircle, cls: "bg-green-600 hover:bg-green-700 text-white" },
    { action: "redact",  label: "遮蔽內容",   icon: EyeOff,      cls: "bg-orange-500 hover:bg-orange-600 text-white" },
    { action: "remove",  label: "下架",       icon: XCircle,     cls: "bg-red-600 hover:bg-red-700 text-white" },
  ]
}

// 狀態 → 結果 顯示文字
const ACTION_OUTCOME: Record<string, string> = {
  approve:       "→ 內容將正常發布",
  redact:        "→ 敏感部分將被遮蔽",
  remove:        "→ 內容將從社區下架",
  reject_report: "→ 檢舉記錄標記為駁回",
}

export function MobileReviewDialog({
  open, itemId, currentUser, onClose, onResolved,
}: MobileReviewDialogProps) {
  const { queueItem, content, reports, loading, error } = useModerationItemDetail(itemId)
  const [selectedAction, setSelectedAction] = useState<string>("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const requireSecondConfirmationIfNeeded = () => {
    const key = "moderation_resolve_timestamps"
    const now = Date.now()
    const windowMs = 10 * 60 * 1000
    const threshold = 5
    let timestamps: number[] = []
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) timestamps = parsed.filter((n) => typeof n === "number")
      }
    } catch { timestamps = [] }
    const recent = timestamps.filter((ts) => now - ts <= windowMs)
    if (recent.length >= threshold) {
      return window.confirm("你在短時間內已高頻處理多筆案件，請再次確認本次決策是否正確。")
    }
    return true
  }

  const markResolvedTimestamp = () => {
    const key = "moderation_resolve_timestamps"
    const now = Date.now()
    const windowMs = 10 * 60 * 1000
    let timestamps: number[] = []
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) timestamps = parsed.filter((n) => typeof n === "number")
      }
    } catch { timestamps = [] }
    const recent = timestamps.filter((ts) => now - ts <= windowMs)
    recent.push(now)
    localStorage.setItem(key, JSON.stringify(recent))
  }

  const handleResolve = async () => {
    if (!selectedAction) { alert("請選擇處理動作"); return }
    if (!reason.trim()) { alert("請輸入處理原因"); return }

    if (queueItem?.item_type === "post" && content?.author_id === currentUser.id) {
      alert("您不能審核自己發布的貼文"); return
    }
    if (!requireSecondConfirmationIfNeeded()) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/moderation/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          userId: currentUser.id,
          resolution: { action: selectedAction, reason: reason.trim() },
        }),
      })
      const result = await res.json()
      if (!res.ok) { alert("處理失敗: " + (result?.error || "未知錯誤")); return }
      markResolvedTimestamp()
      onResolved()
    } catch (e: any) {
      alert("處理失敗: " + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedAction("")
    setReason("")
    onClose()
  }

  const actions = queueItem ? getActions(queueItem.item_type) : []
  const outcome = selectedAction ? ACTION_OUTCOME[selectedAction] : null
  const priorityBadge = queueItem ? (PRIORITY_BADGE[queueItem.priority] || PRIORITY_BADGE.low) : null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 gap-0 rounded-t-2xl sm:rounded-2xl">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-[var(--theme-border)] sticky top-0 bg-[var(--theme-bg-primary)] z-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="material-icons text-xl">gavel</span>
            審核案件
            {priorityBadge && (
              <Badge className={`${priorityBadge.className} text-xs`}>{priorityBadge.label}</Badge>
            )}
            {queueItem && (
              <Badge variant="outline" className="text-xs">{ITEM_TYPE_LABEL[queueItem.item_type]}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center items-center py-16">
            <span className="material-icons animate-spin text-4xl text-[var(--theme-accent)]">refresh</span>
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-red-500">載入失敗: {error}</div>
        )}

        {!loading && !error && queueItem && content && (
          <div className="space-y-0 divide-y divide-[var(--theme-border)]">

            {/* AI 風險摘要 */}
            {queueItem.ai_risk_summary && (
              <div className="px-4 py-3 bg-orange-50 dark:bg-orange-950/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-icons text-orange-500 text-sm">warning</span>
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">AI 風險評估</span>
                </div>
                <p className="text-sm text-orange-700 dark:text-orange-300">{queueItem.ai_risk_summary}</p>
                {queueItem.ai_suggested_action && (
                  <p className="text-xs text-orange-500 mt-1">建議: {queueItem.ai_suggested_action}</p>
                )}
              </div>
            )}

            {/* 內容詳情 */}
            <div className="px-4 py-4">
              <p className="text-xs text-[var(--theme-text-secondary)] mb-2 font-medium uppercase tracking-wide">
                {ITEM_TYPE_LABEL[queueItem.item_type]}內容
              </p>

              {queueItem.item_type === "post" && (
                <>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {content.category && <Badge variant="outline" className="text-xs">{content.category}</Badge>}
                    {content.display_mode && <Badge variant="outline" className="text-xs">{content.display_mode}</Badge>}
                    {content.status && <Badge variant="outline" className="text-xs">{content.status}</Badge>}
                  </div>
                  <h3 className="font-bold text-base mb-2 text-[var(--theme-text-primary)]">{content.title}</h3>
                  <p className="text-sm text-[var(--theme-text-secondary)] whitespace-pre-wrap line-clamp-6">{content.content}</p>
                  {content.author_name && (
                    <p className="text-xs text-[var(--theme-text-secondary)] mt-2">作者：{content.author_name}</p>
                  )}
                </>
              )}

              {queueItem.item_type === "comment" && (
                <>
                  <p className="text-xs text-[var(--theme-text-secondary)] mb-1">留言內容</p>
                  <p className="text-sm whitespace-pre-wrap">{content.content}</p>
                </>
              )}

              {queueItem.item_type === "report" && (
                <>
                  <p className="text-sm font-medium mb-1">檢舉原因：{content.reason}</p>
                  {content.description && (
                    <p className="text-sm text-[var(--theme-text-secondary)]">{content.description}</p>
                  )}
                </>
              )}
            </div>

            {/* 相關檢舉摘要 */}
            {reports.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-[var(--theme-text-secondary)] mb-2">
                  相關檢舉 {reports.length} 件
                </p>
                <div className="space-y-2">
                  {reports.slice(0, 3).map((r: any) => (
                    <div key={r.id} className="border-l-2 border-red-400 pl-3 py-1">
                      <p className="text-xs font-medium text-[var(--theme-text-primary)]">{r.reason}</p>
                      {r.description && (
                        <p className="text-xs text-[var(--theme-text-secondary)] line-clamp-1">{r.description}</p>
                      )}
                    </div>
                  ))}
                  {reports.length > 3 && (
                    <p className="text-xs text-[var(--theme-text-secondary)]">還有 {reports.length - 3} 件…</p>
                  )}
                </div>
              </div>
            )}

            {/* 決策區 */}
            <div className="px-4 py-4 space-y-4">
              {/* 彩色動作按鈕 */}
              <div>
                <Label className="text-xs font-semibold text-[var(--theme-text-secondary)] uppercase tracking-wide mb-2 block">
                  選擇處理動作
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {actions.map(({ action, label, icon: Icon, cls }) => (
                    <button
                      key={action}
                      onClick={() => setSelectedAction(action)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 text-sm font-medium transition-all ${
                        selectedAction === action
                          ? `${cls} border-transparent scale-[1.03] shadow-md ring-2 ring-offset-1 ring-current`
                          : "bg-[var(--theme-bg-primary)] border-[var(--theme-border)] text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* 現況 → 結果 提示 */}
                {outcome && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--theme-text-secondary)] bg-[var(--theme-bg-secondary)] rounded-lg px-3 py-2">
                    <span className="material-icons text-sm text-[var(--theme-accent)]">info</span>
                    {outcome}
                  </div>
                )}
              </div>

              {/* 遮蔽說明（僅 redact） */}
              {selectedAction === "redact" && (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">遮蔽後的內容（貼上修改版）</Label>
                  <Textarea
                    placeholder="輸入遮蔽個資後的修改版內容..."
                    rows={4}
                    className="text-sm"
                  />
                </div>
              )}

              {/* 原因欄位 */}
              <div>
                <Label className="text-xs font-semibold text-[var(--theme-text-secondary)] uppercase tracking-wide mb-1 block">
                  處理原因 <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="請說明判斷依據，例如：違反第 X 條社群規範，內容含有 ..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* 確認 / 取消 */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={handleClose} className="flex-1" disabled={submitting}>
                  取消
                </Button>
                <Button
                  onClick={handleResolve}
                  disabled={submitting || !selectedAction || !reason.trim()}
                  className="flex-1 bg-[var(--theme-accent)] text-black hover:opacity-90"
                >
                  {submitting ? "處理中…" : "確認送出"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
