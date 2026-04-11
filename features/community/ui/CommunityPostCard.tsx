"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreHorizontal,
  Trash2,
  Edit,
  Flag,
  ShieldAlert,
  Key,
} from "lucide-react"
import { useState } from "react"
import type { MouseEvent } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HelpHint } from "@/components/ui/help-hint"

interface PostCardProps {
  post: {
    id: string
    title: string
    content: string
    redacted_title?: string
    redacted_content?: string
    status?: string
    author_id?: string
    author_name?: string
    is_anonymous?: boolean
    post_type?: string
    category?: string
    likes_count?: number
    like_count?: number
    comments_count?: number
    comment_count?: number
    created_at: string
    tags?: string[]
    display_mode?: string
    display_name?: string | null
    moderation_reason?: string
  }
  currentUserId?: string
  isAdmin?: boolean
  onLike?: (postId: string) => void
  onComment?: (postId: string) => void
  onBookmark?: (postId: string) => void
  onShare?: (postId: string) => void
  onWithdraw?: (postId: string) => void
  onEdit?: (postId: string) => void
  onReport?: (postId: string) => void
  onAppeal?: (postId: string, reason: string) => Promise<void> | void
  onRequestDecryption?: (postId: string, reason: string, triggerCondition: string) => void
  isLiked?: boolean
  isBookmarked?: boolean
  appealStatus?: "pending" | "reviewing" | "restored" | "rejected" | "cancelled"
}

export function CommunityPostCard({
  post,
  currentUserId,
  isAdmin = false,
  onLike,
  onComment,
  onBookmark,
  onShare,
  onWithdraw,
  onEdit,
  onReport,
  onAppeal,
  onRequestDecryption,
  isLiked = false,
  isBookmarked = false,
  appealStatus,
}: PostCardProps) {
  const [liked, setLiked] = useState(isLiked)
  const [bookmarked, setBookmarked] = useState(isBookmarked)
  const [showDecryptionDialog, setShowDecryptionDialog] = useState(false)
  const [decryptionReason, setDecryptionReason] = useState("")
  const [triggerCondition, setTriggerCondition] = useState("")
  const [showAppealDialog, setShowAppealDialog] = useState(false)
  const [appealReason, setAppealReason] = useState("")
  const [appealSubmitting, setAppealSubmitting] = useState(false)

  const isAuthor = currentUserId && post.author_id && currentUserId === post.author_id
  const isRedacted = post.status === "redacted"
  const isShadow = post.status === "shadow"
  const isRemoved = post.status === "removed"
  const isAiPreScreened = post.status === "pending" && !!post.ai_risk_level && !post.moderated_by
  const canRequestDecryption = isAdmin && (isRedacted || isShadow || isRemoved)
  const hasOpenAppeal = appealStatus === "pending" || appealStatus === "reviewing"
  const isAppealRejected = appealStatus === "rejected"
  const canAppeal = isAuthor && !isAdmin && isAiPreScreened && !hasOpenAppeal && !isAppealRejected

  const stopCardClick = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleLike = (event?: MouseEvent<HTMLElement>) => {
    if (event) stopCardClick(event)
    setLiked(!liked)
    onLike?.(post.id)
  }

  const handleBookmark = (event?: MouseEvent<HTMLElement>) => {
    if (event) stopCardClick(event)
    setBookmarked(!bookmarked)
    onBookmark?.(post.id)
  }

  const handleWithdraw = (event?: MouseEvent<HTMLElement>) => {
    if (event) stopCardClick(event)
    if (confirm("確定要收回這篇貼文嗎？收回後將無法復原。")) {
      onWithdraw?.(post.id)
    }
  }

  const handleSubmitDecryption = () => {
    if (!decryptionReason.trim() || !triggerCondition) {
      alert("請填寫申請原因並選擇觸發條件")
      return
    }
    onRequestDecryption?.(post.id, decryptionReason, triggerCondition)
    setShowDecryptionDialog(false)
    setDecryptionReason("")
    setTriggerCondition("")
    alert("解密申請已提交，請等待審核")
  }

  const handleSubmitAppeal = async () => {
    if (isAppealRejected) {
      alert("此貼文申訴已被駁回，無法再次申請")
      return
    }

    if (!appealReason.trim()) {
      alert("請輸入申訴理由")
      return
    }

    if (!onAppeal) return

    setAppealSubmitting(true)
    try {
      await onAppeal(post.id, appealReason.trim())
      setShowAppealDialog(false)
      setAppealReason("")
    } finally {
      setAppealSubmitting(false)
    }
  }

  const getPostTypeDisplay = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      case: { label: "案例", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
      howto: { label: "教學", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      opinion: { label: "意見", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
      alert: { label: "警示", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    }
    return types[type] || { label: "其他", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" }
  }

  const postType = post.post_type || post.category || "case"
  const typeInfo = getPostTypeDisplay(postType)
  const isAnonymous = post.is_anonymous ?? post.display_mode === "anonymous"
  const authorDisplay = isAnonymous ? "匿名用戶" : post.display_name || post.author_name || "社區住戶"
  const likesCount = post.likes_count ?? post.like_count ?? 0
  const commentsCount = post.comments_count ?? post.comment_count ?? 0

  const displayTitle = post.title
  const displayContent = post.content
  const spoilerMaskClass = isRedacted && !isAdmin ? "blur-[5px] select-none" : ""

  const getAppealBadge = (status?: PostCardProps["appealStatus"]) => {
    if (status === "pending" || status === "reviewing") {
      return { label: "申訴處理中", className: "border-amber-500/40 text-amber-500 bg-amber-500/10" }
    }
    if (status === "rejected") {
      return { label: "申訴失敗", className: "border-red-500/40 text-red-500 bg-red-500/10" }
    }
    if (status === "restored") {
      return { label: "申訴成功", className: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10" }
    }
    if (status === "cancelled") {
      return { label: "申訴已取消", className: "border-slate-400/40 text-slate-500 bg-slate-500/10" }
    }
    return null
  }

  const appealBadge = getAppealBadge(appealStatus)

  return (
    <>
      <Card className="hover:shadow-md transition-shadow duration-200 overflow-hidden border-border/40">
        <div className="p-4 md:p-5">
          {isRedacted && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-500">此貼文部分敏感內容已被遮蔽</span>
              {canRequestDecryption && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-6 text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10 bg-transparent"
                  onClick={(event) => {
                    stopCardClick(event)
                    setShowDecryptionDialog(true)
                  }}
                >
                  <Key className="w-3 h-3 mr-1" />
                  申請解密
                </Button>
              )}
            </div>
          )}
          {isShadow && isAdmin && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-purple-500">此貼文已被影子封禁（僅作者可見）</span>
              {canRequestDecryption && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-6 text-xs border-purple-500/50 text-purple-500 hover:bg-purple-500/10 bg-transparent"
                  onClick={(event) => {
                    stopCardClick(event)
                    setShowDecryptionDialog(true)
                  }}
                >
                  <Key className="w-3 h-3 mr-1" />
                  申請解密
                </Button>
              )}
            </div>
          )}
          {isRemoved && isAdmin && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-500">此貼文已被下架：{post.moderation_reason || "違反社區規範"}</span>
              {canRequestDecryption && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-6 text-xs border-red-500/50 text-red-500 hover:bg-red-500/10 bg-transparent"
                  onClick={(event) => {
                    stopCardClick(event)
                    setShowDecryptionDialog(true)
                  }}
                >
                  <Key className="w-3 h-3 mr-1" />
                  申請解密
                </Button>
              )}
            </div>
          )}
          {canAppeal && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-blue-500">
                此貼文為 AI 初篩待審，可提出申訴進入管理員人工複審
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-6 text-xs border-blue-500/50 text-blue-500 hover:bg-blue-500/10 bg-transparent"
                onClick={(event) => {
                  stopCardClick(event)
                  setShowAppealDialog(true)
                }}
              >
                提出申訴
              </Button>
            </div>
          )}
          {isAiPreScreened && hasOpenAppeal && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-500">此貼文已有處理中的申訴案件</span>
            </div>
          )}
          {isAiPreScreened && isAppealRejected && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-500">此貼文申訴已駁回，無法再次申請</span>
            </div>
          )}

          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium">
              {isAnonymous ? "匿" : authorDisplay.charAt(0) || "U"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{authorDisplay}</span>
                <Badge variant="secondary" className={`text-xs px-2 py-0 ${typeInfo.color} border-0`}>
                  {typeInfo.label}
                </Badge>
                {isAuthor && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border-primary/50 text-primary">
                    我的貼文
                  </Badge>
                )}
                {isRedacted && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border-amber-500/50 text-amber-500">
                    已遮蔽
                  </Badge>
                )}
                {isShadow && isAdmin && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border-purple-500/50 text-purple-500">
                    {isAiPreScreened ? "AI 初篩" : "影子封禁"}
                  </Badge>
                )}
                {isRemoved && isAdmin && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border-red-500/50 text-red-500">
                    已下架
                  </Badge>
                )}
                {appealBadge && (
                  <Badge variant="outline" className={`text-xs px-2 py-0 ${appealBadge.className}`}>
                    {appealBadge.label}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString("zh-TW", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground"
                  onClick={stopCardClick}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAuthor ? (
                  <>
                    <DropdownMenuItem onClick={() => onEdit?.(post.id)}>
                      <Edit className="w-4 h-4 mr-2" />
                      編輯貼文
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleWithdraw} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      收回貼文
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => onReport?.(post.id)}>
                      <Flag className="w-4 h-4 mr-2" />
                      檢舉貼文
                    </DropdownMenuItem>
                    {canAppeal && (
                      <DropdownMenuItem onClick={() => setShowAppealDialog(true)}>
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        提出申訴
                      </DropdownMenuItem>
                    )}
                    {canRequestDecryption && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowDecryptionDialog(true)}>
                          <Key className="w-4 h-4 mr-2" />
                          申請解密
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2 mb-4">
            <h3 className={`font-semibold text-base md:text-lg leading-snug text-balance line-clamp-2 ${spoilerMaskClass}`}>
              {displayTitle}
            </h3>
            <p className={`text-sm text-muted-foreground leading-relaxed line-clamp-3 ${spoilerMaskClass}`}>
              {displayContent}
            </p>
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.slice(0, 3).map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs px-2 py-0 border-border/50 text-muted-foreground"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <div className="flex items-center gap-1">
              <HelpHint title="住戶端互動操作" description="可按讚、留言、收藏，互動數據會影響貼文排序。" workflow={["閱讀後可按讚、留言或收藏。","需要時可展開更多選單進行檢舉。"]} logic={["互動行為會影響社區內容排序與推薦。"]} align="center" />
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 h-8 px-2 ${liked ? "text-red-500" : "text-muted-foreground"}`}
                onClick={handleLike}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                <span className="text-xs">{likesCount}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  stopCardClick(event)
                  onComment?.(post.id)
                }}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs">{commentsCount}</span>
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${bookmarked ? "text-amber-500" : "text-muted-foreground"}`}
                onClick={handleBookmark}
              >
                <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  stopCardClick(event)
                  onShare?.(post.id)
                }}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={showDecryptionDialog} onOpenChange={setShowDecryptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">申請解密<HelpHint title="管理端解密申請" description="需填寫觸發條件與理由，送交雙重授權審核。" workflow={["選擇觸發條件並填寫申請理由。","送出後等待委員會與管理員雙重審核。"]} logic={["解密屬高敏感操作，需雙重授權降低濫用風險。"]} align="center" /></DialogTitle>
            <DialogDescription>
              申請查看此貼文作者的真實身份。此操作需要經過雙重授權（管理員 + 委員會）才能完成。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>貼文標題</Label>
              <div className="p-2 bg-muted rounded text-sm">{displayTitle}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="triggerCondition">觸發條件 *</Label>
              <Select value={triggerCondition} onValueChange={setTriggerCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇觸發條件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_reports">多人檢舉</SelectItem>
                  <SelectItem value="serious_violation">嚴重違規（誹謗、人身攻擊等）</SelectItem>
                  <SelectItem value="legal_request">法律要求（司法機關調閱）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">申請原因 *</Label>
              <Textarea
                id="reason"
                value={decryptionReason}
                onChange={(e) => setDecryptionReason(e.target.value)}
                placeholder="請說明為何需要解密此貼文作者身份..."
                rows={3}
              />
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-600">
              注意：解密申請會記錄在稽核日誌中，解密後的資料僅保留 7 天。請確保有充分理由再提交申請。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecryptionDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitDecryption}>提交申請</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAppealDialog} onOpenChange={setShowAppealDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提交內容申訴</DialogTitle>
            <DialogDescription>請說明你認為被誤判的原因，管理員將進行人工複審。</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>申訴理由</Label>
            <Textarea
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder="請提供具體理由，例如：內容不含違規資訊、已修正敏感字詞等"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAppealDialog(false)} disabled={appealSubmitting}>
              取消
            </Button>
            <Button onClick={handleSubmitAppeal} disabled={appealSubmitting}>
              {appealSubmitting ? "提交中..." : "送出申訴"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CommunityPostCard
