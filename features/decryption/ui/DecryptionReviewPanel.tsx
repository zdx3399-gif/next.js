"use client"

import { useMemo, useState } from "react"
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
  isPreviewMode?: boolean
}

const PREVIEW_DECRYPTION_REQUESTS = [
  {
    id: "preview-dr-1",
    target_type: "post",
    target_id: "post-7788",
    reason: "內容疑似涉及詐騙招募，需要追溯來源",
    trigger_condition: "serious_violation",
    status: "pending",
    created_at: new Date().toISOString(),
  },
  {
    id: "preview-dr-2",
    target_type: "comment",
    target_id: "comment-4501",
    reason: "多名住戶檢舉同一留言，疑似惡意騷擾",
    trigger_condition: "multiple_reports",
    status: "committee_approved",
    committee_approval_notes: "初審確認有必要進入第二層覆核",
    committee_approved_at: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待管委會初審", color: "bg-yellow-500" },
  committee_approved: { label: "待開發者覆核", color: "bg-blue-500" },
  admin_approved: { label: "開發者已覆核", color: "bg-purple-500" },
  fully_approved: { label: "已完全核准", color: "bg-green-500" },
  rejected: { label: "已拒絕", color: "bg-red-500" },
}

const TRIGGER_MAP: Record<string, string> = {
  multiple_reports: "多人檢舉",
  serious_violation: "嚴重違規",
  legal_request: "法律要求",
}

export function DecryptionReviewPanel({ reviewerId, reviewerRole, isPreviewMode = false }: DecryptionReviewPanelProps) {
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
  const [previewAuthorInfo, setPreviewAuthorInfo] = useState<any>(null)
  
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [showAuthorDialog, setShowAuthorDialog] = useState(false)
  const [selectedForView, setSelectedForView] = useState<any>(null)

  const isLoading = isAdminLoading || isCommitteeLoading
  const displayedRequests = useMemo(() => {
    if (!isPreviewMode) return requests
    return PREVIEW_DECRYPTION_REQUESTS.filter((request) =>
      reviewerRole === "committee" ? request.status === "pending" : request.status === "committee_approved",
    )
  }, [isPreviewMode, requests, reviewerRole])
  const displayedAuthorInfo = isPreviewMode ? previewAuthorInfo : authorInfo

  const handleReview = async (requestId: string, approved: boolean) => {
    if (isPreviewMode) {
      toast.success(approved ? "[預覽] 已核准解密申請" : "[預覽] 已拒絕解密申請")
      setSelectedRequest(null)
      setReviewNote("")
      return
    }

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
    if (isPreviewMode) {
      setPreviewAuthorInfo({
        full_name: "黃志誠",
        unit_number: "A-1203",
        email: "preview.author@example.com",
        phone: "0912-345-678",
      })
      setSelectedForView(request)
      setShowAuthorDialog(true)
      return
    }

    try {
      await getAuthor(request.id, reviewerId)
      setSelectedForView(request)
      setShowAuthorDialog(true)
    } catch (error: any) {
      toast.error(error.message || "無法取得作者資訊")
    }
  }

  if (!isPreviewMode && isLoadingRequests) {
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>
  }

  return (
    <div className="space-y-4">
      {/* 說明區 */}
      <div className="bg-card border rounded-lg p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          {reviewerRole === "committee" ? "管委會初審（第一層）" : "開發者覆核（第二層）"}
          <HelpHint
            title={reviewerRole === "committee" ? "管委會初審" : "開發者覆核"}
            description={reviewerRole === "committee" ? "先判斷是否符合解密條件，通過後送開發者。" : "進行最終核准，通過後才能查看作者資訊。"}
            workflow={
              reviewerRole === "committee"
                ? [
                    "先閱讀申請原因與觸發條件，確認是否符合初審標準。",
                    "點開始審核，填寫備註後選擇通過或拒絕。",
                    "初審通過的案件會送交開發者進行第二層覆核。",
                  ]
                : [
                    "先查看管委會初審意見與案件內容。",
                    "點開始審核後填寫覆核備註並做最終核准或拒絕。",
                    "最終核准後，才可依權限查看作者解密資訊。",
                  ]
            }
            logic={
              reviewerRole === "committee"
                ? [
                    "管委會屬第一層把關，避免不必要的個資揭露。",
                    "僅初審通過案件會進入開發者覆核流程。",
                  ]
                : [
                    "開發者是最終決策層，決定是否開啟作者資訊存取。",
                    "雙層審核可降低誤判與濫用解密權限風險。",
                  ]
            }
            align="center"
          />
        </h3>
        <p className="text-sm text-muted-foreground">
          {reviewerRole === "committee" 
            ? "審核解密申請是否符合解密條件。核准後將送交開發者覆核。"
            : "進行最終覆核。核准後將解密作者身份，資訊有效期為7天。"
          }
        </p>
      </div>

      {/* 申請列表 */}
      {displayedRequests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          目前沒有待審核的解密申請
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map((request: any) => {
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
                        <HelpHint
                          title="審核目標"
                          description="顯示申請對應的內容類型與流程節點。"
                          workflow={[
                            "先確認目標是貼文或留言。",
                            "再看狀態與觸發條件（如多人檢舉、嚴重違規）。",
                          ]}
                          logic={[
                            "目標類型與觸發條件共同構成審核判斷依據。",
                          ]}
                          align="center"
                        />
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
                        <HelpHint
                          title="審核備註"
                          description="建議填寫核准/拒絕依據，方便後續稽核與追溯。"
                          workflow={[
                            "在備註欄填入判斷重點與決策理由。",
                            "若拒絕，請明確說明不符合條件的原因。",
                          ]}
                          logic={[
                            "備註會保留在審核紀錄中，供後續稽核與申訴查核。",
                          ]}
                          align="center"
                        />
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
                      <HelpHint
                        title="開始審核"
                        description="進入審核模式後可填寫備註並做通過或拒絕。"
                        workflow={[
                          "點開始審核進入該筆案件的操作狀態。",
                          "填寫備註後選擇通過或拒絕，或按取消退出。",
                        ]}
                        logic={[
                          "一次只會開啟一筆案件的審核操作，避免誤送出。",
                        ]}
                        align="center"
                      />
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
              <HelpHint
                title="解密資料保護"
                description="僅可用於處理違規案件，請遵守個資保護規範。"
                workflow={[
                  "僅在案件處理需要時查看作者資訊。",
                  "處理完成後避免擴散或另作他用。",
                ]}
                logic={[
                  "解密資料屬高敏感資訊，應依最小必要原則存取。",
                  "系統保留存取與審核紀錄，便於後續追蹤責任。",
                ]}
                align="center"
              />
            </DialogTitle>
            <DialogDescription>
              此資訊僅供處理違規事項使用，請勿外洩。
            </DialogDescription>
          </DialogHeader>
          
          {displayedAuthorInfo ? (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div>
                <span className="text-muted-foreground">姓名:</span>{" "}
                <span className="font-medium">{displayedAuthorInfo.full_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">戶號:</span>{" "}
                <span className="font-medium">{displayedAuthorInfo.unit_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{displayedAuthorInfo.email}</span>
              </div>
              {displayedAuthorInfo.phone && (
                <div>
                  <span className="text-muted-foreground">電話:</span>{" "}
                  <span className="font-medium">{displayedAuthorInfo.phone}</span>
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
