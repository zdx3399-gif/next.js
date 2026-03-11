"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDecryptionRequests } from "../hooks/useDecryption"
import { Shield, Clock, CheckCircle, XCircle } from "lucide-react"
import { HelpHint } from "@/components/ui/help-hint"

const PREVIEW_REQUESTS = [
  {
    id: "dec-preview-1",
    target_type: "post",
    reason: "疑似偽造訊息需要追查發布者",
    status: "pending",
    created_at: new Date().toISOString(),
    reviewed_at: null,
    review_note: null,
  },
  {
    id: "dec-preview-2",
    target_type: "comment",
    reason: "留言涉及人身攻擊，需進一步處理",
    status: "approved",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 43200000).toISOString(),
    review_note: "已完成覆核，進入追蹤流程",
  },
]

interface DecryptionRequestListProps {
  isPreviewMode?: boolean
}

export function DecryptionRequestList({ isPreviewMode = false }: DecryptionRequestListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { requests, isLoading } = useDecryptionRequests(statusFilter === "all" ? {} : { status: statusFilter })
  const previewFiltered = PREVIEW_REQUESTS.filter((r) => statusFilter === "all" || r.status === statusFilter)
  const displayedRequests = isPreviewMode ? previewFiltered : requests

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            待審核
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="w-3 h-3" />
            已核准
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            已拒絕
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (!isPreviewMode && isLoading) {
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <HelpHint
          title="住戶端解密申請"
          description="可查看你提出的解密申請進度與審核結果。"
          workflow={[
            "先用上方狀態按鈕切換要看的申請範圍（全部/待審核/已核准/已拒絕）。",
            "在清單逐筆查看申請原因、建立時間與審核時間。",
            "若已完成審核，可對照審核備註確認結果。",
          ]}
          logic={[
            "此頁是住戶端查詢用途，不提供審核操作。",
            "狀態由審核流程更新，住戶端即時反映最終結果。",
          ]}
          align="center"
        />
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
        >
          全部
        </Button>
        <Button
          variant={statusFilter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("pending")}
        >
          待審核
        </Button>
        <Button
          variant={statusFilter === "approved" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("approved")}
        >
          已核准
        </Button>
        <Button
          variant={statusFilter === "rejected" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("rejected")}
        >
          已拒絕
        </Button>
      </div>

      {displayedRequests && displayedRequests.length > 0 ? (
        <div className="space-y-3">
          {displayedRequests.map((request: any) => (
            <Card key={request.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {request.target_type === "post" ? "貼文" : "留言"} 解密申請
                    </span>
                    <HelpHint
                      title="住戶端申請項目"
                      description="顯示你申請解密的目標類型與目前狀態。"
                      workflow={[
                        "先確認申請目標是貼文或留言。",
                        "再看右側狀態標籤判斷目前審核進度。",
                      ]}
                      logic={[
                        "目標類型與狀態一起看，能快速判斷案件在哪個流程節點。",
                      ]}
                      align="center"
                    />
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">申請原因: {request.reason}</p>
                  <div className="text-xs text-muted-foreground">
                    申請時間: {new Date(request.created_at).toLocaleString("zh-TW")}
                  </div>
                  {request.reviewed_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      審核時間: {new Date(request.reviewed_at).toLocaleString("zh-TW")}
                      {request.review_note && ` - ${request.review_note}`}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">沒有解密申請記錄</div>
      )}
    </div>
  )
}
