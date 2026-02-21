"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useModerationItemDetail } from "../hooks/useModeration"
import type { User } from "@/features/profile/api/profile"
import { HelpHint } from "@/components/ui/help-hint"

interface ModerationDetailProps {
  itemId: string
  currentUser: User
  onBack: () => void
  onResolved: () => void
}

export function ModerationDetail({ itemId, currentUser, onBack, onResolved }: ModerationDetailProps) {
  const { queueItem, content, reports, loading, error } = useModerationItemDetail(itemId)
  const [action, setAction] = useState<string>("approve")
  const [reason, setReason] = useState("")
  const [redactedContent, setRedactedContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleResolve = async () => {
    if (!reason.trim()) {
      alert("請輸入處理原因")
      return
    }

    setSubmitting(true)
    try {
      // 這裡應該呼叫 API
      await fetch(`/api/moderation/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          userId: currentUser.id,
          resolution: {
            action,
            reason: reason.trim(),
            redacted_content: action === "redact" ? redactedContent : undefined,
          },
        }),
      })

      alert("處理完成")
      onResolved()
    } catch (err: any) {
      alert(`處理失敗: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="material-icons animate-spin text-4xl text-[var(--theme-accent)]">refresh</span>
      </div>
    )
  }

  if (error || !queueItem || !content) {
    return (
      <div className="text-center py-12">
        <span className="material-icons text-4xl mb-2 text-red-500">error</span>
        <p className="text-red-500">載入失敗: {error}</p>
        <Button onClick={onBack} className="mt-4">
          返回列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Button variant="outline" onClick={onBack} className="flex gap-2 items-center bg-transparent">
        <span className="material-icons">arrow_back</span>
        返回列表
      </Button>
      <div className="flex items-center gap-2 text-xs text-[var(--theme-text-secondary)]">
        <span>審核詳情頁</span>
        <HelpHint title="管理端審核詳情" description="此頁可比對內容、檢舉資訊並做最終處理。" align="center" />
      </div>

      {/* AI Risk Summary */}
      {queueItem.ai_risk_summary && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <h3 className="font-bold mb-2 flex gap-2 items-center text-orange-700">
            <span className="material-icons">warning</span>
            AI 風險評估
          </h3>
          <p className="text-sm text-orange-600">{queueItem.ai_risk_summary}</p>
          {queueItem.ai_suggested_action && (
            <p className="text-xs text-orange-500 mt-2">建議動作: {queueItem.ai_suggested_action}</p>
          )}
        </Card>
      )}

      {/* Content */}
      <Card className="p-6">
        <h2 className="font-bold text-lg mb-4 flex gap-2 items-center text-[var(--theme-text-primary)]">
          <span className="material-icons">article</span>
          內容詳情
          <HelpHint title="管理端內容詳情" description="請先閱讀原文與上下文，再決定是否通過、遮蔽或下架。" align="center" />
        </h2>

        {queueItem.item_type === "post" && (
          <div>
            <div className="mb-2">
              <Badge>{content.category}</Badge>
              <Badge variant="outline" className="ml-2">
                {content.display_mode}
              </Badge>
            </div>
            <h3 className="font-bold text-xl mb-2">{content.title}</h3>
            <p className="whitespace-pre-wrap text-[var(--theme-text-secondary)]">{content.content}</p>
          </div>
        )}

        {queueItem.item_type === "comment" && (
          <div>
            <p className="text-sm text-[var(--theme-text-secondary)] mb-2">留言內容:</p>
            <p className="whitespace-pre-wrap">{content.content}</p>
          </div>
        )}

        {queueItem.item_type === "report" && (
          <div>
            <p className="text-sm text-[var(--theme-text-secondary)] mb-2">檢舉原因: {content.reason}</p>
            {content.description && <p className="text-sm">詳細說明: {content.description}</p>}
          </div>
        )}
      </Card>

      {/* Related Reports */}
      {reports.length > 0 && (
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4 flex gap-2 items-center text-[var(--theme-text-primary)]">
            <span className="material-icons">flag</span>
            相關檢舉 ({reports.length})
          </h2>
          <div className="space-y-3">
            {reports.map((report: any) => (
              <div key={report.id} className="border-l-2 border-red-500 pl-4 py-2">
                <p className="text-sm font-medium">原因: {report.reason}</p>
                {report.description && (
                  <p className="text-xs text-[var(--theme-text-secondary)]">{report.description}</p>
                )}
                <p className="text-xs text-[var(--theme-text-secondary)] mt-1">
                  {new Date(report.created_at).toLocaleString("zh-TW")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resolution Form */}
      <Card className="p-6">
        <h2 className="font-bold text-lg mb-4 flex gap-2 items-center text-[var(--theme-text-primary)]">
          <span className="material-icons">gavel</span>
          處理決定
          <HelpHint title="管理端處理決定" description="所有處理都應填寫清楚理由，供後續追溯。" align="center" />
        </h2>

        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-2">處理動作<HelpHint title="管理端處理動作" description="依案件類型提供不同選項：\n• 一般內容（貼文/留言）：通過發布、遮蔽部分內容、下架。\n• 檢舉案件：檢舉成立或駁回檢舉。\n\n建議先比對內容上下文與檢舉理由，再選擇最小必要處置。" align="center" /></Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {queueItem.item_type !== "report" && <SelectItem value="approve">通過發布</SelectItem>}
                {queueItem.item_type !== "report" && <SelectItem value="redact">遮蔽部分內容</SelectItem>}
                {queueItem.item_type !== "report" && <SelectItem value="remove">下架</SelectItem>}
                {queueItem.item_type === "report" && <SelectItem value="approve">檢舉成立</SelectItem>}
                {queueItem.item_type === "report" && <SelectItem value="reject_report">駁回檢舉</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {action === "redact" && (
            <div>
              <Label>遮蔽後的內容</Label>
              <Textarea
                value={redactedContent}
                onChange={(e) => setRedactedContent(e.target.value)}
                placeholder="輸入遮蔽個資後的內容..."
                rows={6}
              />
            </div>
          )}

          <div>
            <Label className="flex items-center gap-2">處理原因<HelpHint title="管理端處理原因" description="建議至少包含：\n• 違規或通過的判斷依據。\n• 參考規範或社群準則。\n• 為何選擇此處置（通過 / 遮蔽 / 下架 / 檢舉結論）。\n\n此欄位會影響後續稽核與申訴可追溯性。" align="center" /></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請說明處理原因..."
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onBack} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleResolve} disabled={submitting}>
              {submitting ? "處理中..." : "確認處理"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
