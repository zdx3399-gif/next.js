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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
    status: "fully_approved",
    committee_approval_notes: "初審確認有必要進行解密",
    committee_approved_at: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待管委會初審", color: "bg-yellow-500" },
  committee_approved: { label: "待系統管理員覆核", color: "bg-blue-500" },
  admin_approved: { label: "系統管理員已覆核", color: "bg-purple-500" },
  fully_approved: { label: "已完全核准", color: "bg-green-500" },
  rejected: { label: "已拒絕", color: "bg-red-500" },
}

const TRIGGER_MAP: Record<string, string> = {
  multiple_reports: "多人檢舉",
  serious_violation: "嚴重違規",
  legal_request: "法律要求",
}

export function DecryptionReviewPanel({ reviewerId, reviewerRole, isPreviewMode = false }: DecryptionReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<"review" | "decrypted">("review")
  
  // committee 看 pending（待審）和 fully_approved（已解密）
  // admin 只看 committee_approved（待覆核）
  const reviewStatusFilter = reviewerRole === "committee" 
    ? ["pending"] 
    : ["committee_approved"]
  const decryptedStatusFilter = ["fully_approved"]
  
  const { 
    requests: reviewRequests, 
    refresh: refreshReview, 
    isLoading: isLoadingReviewRequests 
  } = useDecryptionRequests({ status: reviewStatusFilter })
  
  const { 
    requests: decryptedRequests, 
    refresh: refreshDecrypted, 
    isLoading: isLoadingDecryptedRequests 
  } = useDecryptionRequests({ status: decryptedStatusFilter })
  
  const { review: adminReview, isLoading: isAdminLoading } = useAdminReviewDecryptionRequest()
  const { review: committeeReview, isLoading: isCommitteeLoading } = useCommitteeReviewDecryptionRequest()
  const { getAuthor, authorInfo, isLoading: isAuthorLoading, clearAuthor } = useDecryptedAuthorInfo()
  const [previewAuthorInfo, setPreviewAuthorInfo] = useState<any>(null)
  const [authorError, setAuthorError] = useState<string | null>(null)
  
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [showAuthorDialog, setShowAuthorDialog] = useState(false)
  const [selectedForView, setSelectedForView] = useState<any>(null)

  const isLoading = isAdminLoading || isCommitteeLoading
  
  const displayedReviewRequests = useMemo(() => {
    if (!isPreviewMode) return reviewRequests
    return PREVIEW_DECRYPTION_REQUESTS.filter((request) =>
      reviewerRole === "committee" ? request.status === "pending" : request.status === "committee_approved",
    )
  }, [isPreviewMode, reviewRequests, reviewerRole])
  
  const displayedDecryptedRequests = useMemo(() => {
    if (!isPreviewMode) return decryptedRequests
    return PREVIEW_DECRYPTION_REQUESTS.filter((request) => request.status === "fully_approved")
  }, [isPreviewMode, decryptedRequests])
  
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
      refreshReview()
      refreshDecrypted()
    } catch (error: any) {
      toast.error(error.message || "審核失敗")
    }
  }

  const handleViewAuthor = async (request: any) => {
    if (isPreviewMode) {
      setAuthorError(null)
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

    setAuthorError(null)
    clearAuthor()
    setSelectedForView(request)
    setShowAuthorDialog(true)

    try {
      await getAuthor(request.id, reviewerId, reviewerRole)
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : typeof error === "string"
            ? error
            : "無法取得作者資訊"
      setAuthorError(message)
      toast.error(message)
    }
  }

  if (!isPreviewMode && (isLoadingReviewRequests || isLoadingDecryptedRequests)) {
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>
  }

  return (
    <div className="space-y-4">
      {reviewerRole === "committee" ? (
        // 管委會：顯示兩個分頁
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "review" | "decrypted")} className="w-full">
          <TabsList className="w-full grid grid-cols-2 p-1">
            <TabsTrigger value="review" className="flex items-center gap-2">
              <span>第一層審核</span>
              {displayedReviewRequests.length > 0 && (
                <Badge variant="destructive" className="ml-1">{displayedReviewRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="decrypted" className="flex items-center gap-2">
              <span>已解密完成</span>
              {displayedDecryptedRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">{displayedDecryptedRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-4">
            {/* 第一層審核說明 */}
            <div className="bg-card border rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-500" />
                第一層審核
                <HelpHint
                  title="第一層審核"
                  description="管委會對解密申請進行初步審核，判斷是否有必要進行解密。"
                  workflow={[
                    "查看待審核的解密申請清單。",
                    "點開始審核進入該筆案件的操作狀態。",
                    "填寫備註後選擇通過或拒絕，或按取消退出。",
                  ]}
                  logic={[
                    "管委會是第一層把關，確認解密必要性。",
                    "通過後進入系統管理員的第二層覆核。",
                  ]}
                  align="center"
                />
              </h3>
              <p className="text-sm text-muted-foreground">
                請審核解密申請，決定是否送往系統管理員進行最終覆核。
              </p>
            </div>

            {/* 待審列表 */}
            {displayedReviewRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                目前沒有待審核的解密申請
              </div>
            ) : (
              <div className="space-y-4">
                {displayedReviewRequests.map((request: any) => {
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
                                申請時間: {new Date(request.created_at).toLocaleString("zh-TW")}
                              </p>
                            </div>
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
                                description="建議填寫通過/拒絕依據，方便後續稽核與追溯。"
                                workflow={[
                                  "在備註欄填入判斷重點與決策理由。",
                                  "若拒絕，請明確說明理由。",
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
                                初審通過（送管理員）
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
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="decrypted" className="space-y-4">
            {/* 已解密完成說明 */}
            <div className="bg-card border rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                已解密完成
                <HelpHint
                  title="已解密完成"
                  description="系統管理員已通過的解密申請。管委會可在此查看解密後的作者身份資訊。"
                  workflow={[
                    "查看已完全核准的解密案件清單。",
                    "點查看作者資訊可取得解密內容。",
                    "解密資訊僅供處理違規事項使用，遵守個資保護規範。",
                  ]}
                  logic={[
                    "管委會是解密資訊的主要存取方，負責違規案件處理。",
                    "系統記錄所有查看紀錄，便於後續追蹤。",
                  ]}
                  align="center"
                />
              </h3>
              <p className="text-sm text-muted-foreground">
                系統管理員已通過的解密申請。點選「查看作者資訊」可取得解密內容。
              </p>
            </div>

            {/* 已解密列表 */}
            {displayedDecryptedRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                目前沒有已解密的案件
              </div>
            ) : (
              <div className="space-y-4">
                {displayedDecryptedRequests.map((request: any) => {
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
                                申請時間: {new Date(request.created_at).toLocaleString("zh-TW")}
                              </p>
                              {request.decrypted_at && (
                                <p className="flex items-center gap-2 text-muted-foreground">
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  解密時間: {new Date(request.decrypted_at).toLocaleString("zh-TW")}
                                </p>
                              )}
                              {request.accessible_until && (
                                <p className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="w-4 h-4" />
                                  有效期至: {new Date(request.accessible_until).toLocaleString("zh-TW")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 操作區 */}
                        <div className="flex gap-2 pt-3 border-t">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewAuthor(request)}
                            disabled={isAuthorLoading}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            查看作者資訊
                          </Button>
                          <HelpHint
                            title="查看作者資訊"
                            description="查看解密後的作者身份資訊。此操作會記錄在稽核日誌中。"
                            workflow={[
                              "點查看作者資訊可取得解密內容。",
                              "資訊窗中會顯示姓名、戶號、Email和電話。",
                            ]}
                            logic={[
                              "解密資訊屬高敏感資訊，應依最小必要原則存取。",
                              "系統保留所有存取紀錄，便於後續追蹤責任。",
                            ]}
                            align="center"
                          />
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        // 系統管理員：只顯示第一層審核
        <div className="space-y-4">
          {/* 系統管理員覆核說明 */}
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              系統管理員覆核（第二層）
              <HelpHint
                title="系統管理員覆核"
                description="進行管委會初審後的最終覆核，確保程序正確。"
                workflow={[
                  "先查看管委會初審意見與案件內容。",
                  "確認程序無誤後可覆核通過或拒絕。",
                  "覆核通過後，管委會可查看解密的作者資訊。",
                ]}
                logic={[
                  "系統管理員是最後把關層，確保程序合規。",
                  "管委會和管理員的雙層審核降低濫用風險。",
                ]}
                align="center"
              />
            </h3>
            <p className="text-sm text-muted-foreground">
              進行最終覆核確保程序正確。通過後，管委會可查看解密資訊。
            </p>
          </div>

          {/* 待覆核列表 */}
          {displayedReviewRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              目前沒有待覆核的解密申請
            </div>
          ) : (
            <div className="space-y-4">
              {displayedReviewRequests.map((request: any) => {
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

                          {/* 管委會初審結果 */}
                          {request.committee_approval_notes && (
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
                            placeholder="覆核備註（選填）"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            className="min-h-20"
                          />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>覆核備註</span>
                            <HelpHint
                              title="覆核備註"
                              description="建議填寫核准/拒絕依據，方便後續稽核與追溯。"
                              workflow={[
                                "在備註欄填入判斷重點與決策理由。",
                                "若拒絕，請明確說明理由。",
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
                              最終核准
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
                            開始覆核
                          </Button>
                          <HelpHint
                            title="開始覆核"
                            description="進入覆核模式後可填寫備註並做通過或拒絕。"
                            workflow={[
                              "點開始覆核進入該筆案件的操作狀態。",
                              "填寫備註後選擇通過或拒絕，或按取消退出。",
                            ]}
                            logic={[
                              "一次只會開啟一筆案件的覆核操作，避免誤送出。",
                            ]}
                            align="center"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
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
          
          {authorError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              取得作者資訊失敗：{authorError}
            </div>
          ) : displayedAuthorInfo ? (
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
