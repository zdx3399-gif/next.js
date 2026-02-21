"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  useDecryptionRequests,
  useAdminReviewDecryptionRequest,
  useCommitteeReviewDecryptionRequest,
  useDecryptedAuthorInfo,
} from "../hooks/useDecryption"
import { Shield, CheckCircle, XCircle, Eye, Clock, User, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HelpHint } from "@/components/ui/help-hint"

interface DecryptionReviewPanelProps {
  reviewerId: string
  reviewerRole: "admin" | "committee"
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待管委會初審", color: "bg-yellow-500" },
  committee_approved: { label: "待管理員覆核", color: "bg-blue-500" },
  admin_approved: { label: "管理員已覆核", color: "bg-purple-500" },
  fully_approved: { label: "已完全核准", color: "bg-green-500" },
  rejected: { label: "已拒絕", color: "bg-red-500" },
}

const TRIGGER_MAP: Record<string, string> = {
  multiple_reports: "多人檢舉",
  serious_violation: "嚴重違規",
  legal_request: "法律要求",
}

export function DecryptionReviewPanel({ reviewerId, reviewerRole }: DecryptionReviewPanelProps) {
  // 根據角色顯��不同的申請
  // committee (第一層): 看 pending 的申請
  // admin (第二層): 看 committee_approved 的申請
  const statusFilter = reviewerRole === "committee" 
    ? ["pending"] 
    : ["committee_approved"]
  
  const { requests, refresh, isLoading: isLoadingRequests } = useDecryptionRequests({ 
    status: statusFilter 
  })
  const { review: adminReview, isLoading: isAdminLoading } = useAdminReviewDecryptionRequest()
  const { review: committeeReview, isLoading: isCommitteeLoading } = useCommitteeReviewDecryptionRequest()
  const { getAuthor, authorInfo, isLoading: isAuthorLoading } = useDecryptedAuthorInfo()
  
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [showAuthorDialog, setShowAuthorDialog] = useState(false)
  const [selectedForView, setSelectedForView] = useState<any>(null)

  const isLoading = isAdminLoading || isCommitteeLoading

  const handleReview = async (requestId: string, approved: boolean) => {
    try {
      if (reviewerRole === "admin") {
        await adminReview(requestId, {
          adminId: reviewerId,
          approved,
          notes: reviewNote,
        })
      } else {
        await committeeReview(requestId, {
          committeeId: reviewerId,
          approved,
          notes: reviewNote,
        })
      }
      toast.success(approved ? "已核准解密申請" : "已拒絕解密申請")
      setSelectedRequest(null)
      setReviewNote("")
      refresh()
    } catch (error: any) {
      toast.error(error.message || "審核失敗")
    }
  }

  const handleViewAuthor = async (request: any) => {
    try {
      await getAuthor(request.id, reviewerId)
      setSelectedForView(request)
      setShowAuthorDialog(true)
    } catch (error: any) {
      toast.error(error.message || "無法取得作者資訊")
    }
  }

  if (isLoadingRequests) {
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>
  }

  return (
    <div className="space-y-4">
      {/* 說明區 */}
      <div className="bg-card border rounded-lg p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          {reviewerRole === "committee" ? "管委會初審（第一層）" : "系統管理員覆核（第二層）"}
          <HelpHint
            title={reviewerRole === "committee" ? "管委會初審" : "管理員覆核"}
            description={reviewerRole === "committee" ? "先判斷是否符合解密條件，通過後送管理員。" : "進行最終核准，通過後才能查看作者資訊。"}
            align="center"
          />
        </h3>
        <p className="text-sm text-muted-foreground">
          {reviewerRole === "committee" 
            ? "審核解密申請是否符合解密條件。核准後將送交系統管理員覆核。"
            : "進行最終覆核。核准後將解密作者身份，資訊有效期為7天。"
          }
        </p>
      </div>

      {/* 申請列表 */}
      {requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          目前沒有待審核的解密申請
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request: any) => {
            const status = STATUS_MAP[request.status] || { label: request.status, color: "bg-gray-500" }
            
            return (
              <Card key={request.id} className="p-4">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={status.color + " text-white"}>
                          {status.label}
                        </Badge>
                        <Badge variant="outline">
                          {request.target_type === "post" ? "貼文" : "留言"}
                        </Badge>
                        <HelpHint title="審核目標" description="顯示申請對應的內容類型與流程節點。" align="center" />
                        {request.trigger_condition && (
                          <Badge variant="secondary">
                            {TRIGGER_MAP[request.trigger_condition] || request.trigger_condition}
                          </Badge>
                        )}
                      </div>

                      {/* 申請資訊 */}
                      <div className="space-y-2 text-sm">
                        <p className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">目標ID:</span>
                          <code className="bg-muted px-1 rounded">{request.target_id}</code>
                        </p>
                        <p>
                          <span className="text-muted-foreground">申請原因:</span>{" "}
                          {request.reason}
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {new Date(request.created_at).toLocaleString("zh-TW")}
                        </p>
                      </div>

                      {/* 管委會初審結果（給系統管理員覆核時看） */}
                      {reviewerRole === "admin" && request.committee_approval_notes && (
                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <p className="text-sm font-medium text-blue-400">管委會初審意見</p>
                          <p className="text-sm">{request.committee_approval_notes}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            初審時間: {new Date(request.committee_approved_at).toLocaleString("zh-TW")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 操作區 */}
                  {selectedRequest === request.id ? (
                    <div className="space-y-3 pt-3 border-t">
                      <Textarea
                        placeholder="審核備註（選填）"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="min-h-20"
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>審核備註</span>
                        <HelpHint title="審核備註" description="建議填寫核准/拒絕依據，方便後續稽核與追溯。" align="center" />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleReview(request.id, true)}
                          disabled={isLoading}
                        >
                          <CheckCircle className="w-4 h-4" />
                          {reviewerRole === "committee" ? "初審通過（送交管理員覆核）" : "最終核准"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => handleReview(request.id, false)}
                          disabled={isLoading}
                        >
                          <XCircle className="w-4 h-4" />
                          拒絕
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRequest(null)
                            setReviewNote("")
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setSelectedRequest(request.id)}>
                        開始審核
                      </Button>
                      <HelpHint title="開始審核" description="進入審核模式後可填寫備註並做通過或拒絕。" align="center" />
                      {request.status === "fully_approved" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewAuthor(request)}
                          disabled={isAuthorLoading}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          查看作者資訊
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* 作者資訊對話框 */}
      <Dialog open={showAuthorDialog} onOpenChange={setShowAuthorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              解密後作者資訊
              <HelpHint title="解密資料保護" description="僅可用於處理違規案件，請遵守個資保護規範。" align="center" />
            </DialogTitle>
            <DialogDescription>
              此資訊僅供處理違規事項使用，請勿外洩。
            </DialogDescription>
          </DialogHeader>
          
          {authorInfo ? (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div>
                <span className="text-muted-foreground">姓名:</span>{" "}
                <span className="font-medium">{authorInfo.full_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">戶號:</span>{" "}
                <span className="font-medium">{authorInfo.unit_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{authorInfo.email}</span>
              </div>
              {authorInfo.phone && (
                <div>
                  <span className="text-muted-foreground">電話:</span>{" "}
                  <span className="font-medium">{authorInfo.phone}</span>
                </div>
              )}
              {selectedForView?.accessible_until && (
                <div className="pt-2 border-t text-sm text-muted-foreground">
                  資訊有效至: {new Date(selectedForView.accessible_until).toLocaleString("zh-TW")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">載入中...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
