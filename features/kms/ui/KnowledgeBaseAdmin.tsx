"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, CheckCircle, XCircle, Shield, Users, Building, MoreVertical, FileText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useKnowledgeCards } from "../hooks/useKMS"
import { getPendingKMSPosts, getRejectedKMSPosts, importPostToKMS, rejectKMSSuggestion } from "../api/kms"
import type { User } from "@/features/profile/api/profile"
import type { CommunityPost } from "@/features/community/api/community"
import { HelpHint } from "@/components/ui/help-hint"

interface KnowledgeBaseAdminProps {
  currentUser: User | null
  isPreviewMode?: boolean
}

const CATEGORIES = [
  { value: "all", label: "全部" },
  { value: "package", label: "包裹" },
  { value: "visitor", label: "訪客" },
  { value: "repair", label: "報修" },
  { value: "facility", label: "設施" },
  { value: "fee", label: "管理費" },
  { value: "emergency", label: "緊急" },
  { value: "rules", label: "規章" },
  { value: "other", label: "其他" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "全部狀態" },
  { value: "active", label: "已發布" },
  { value: "unverified", label: "待入庫" },
  { value: "archived", label: "拒絕入庫" },
]

const CREDIBILITY_OPTIONS = [
  { value: "official", label: "官方", icon: Building, color: "text-blue-500" },
  { value: "verified", label: "已驗證", icon: CheckCircle, color: "text-green-500" },
  { value: "community", label: "社區", icon: Users, color: "text-gray-500" },
]


// 預覽模式的模擬資料
const PREVIEW_CARDS = [
  { id: "preview-1", title: "測試資料", summary: "測試資料", category: "package", credibility: "official", status: "active", helpful_count: 15, not_helpful_count: 2, view_count: 120, version: 1, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 43200000).toISOString() },
  { id: "preview-2", title: "測試資料", summary: "測試資料", category: "visitor", credibility: "verified", status: "active", helpful_count: 8, not_helpful_count: 1, view_count: 85, version: 2, created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "preview-3", title: "測試資料", summary: "測試資料", category: "facility", credibility: "community", status: "unverified", helpful_count: 3, not_helpful_count: 0, view_count: 42, version: 1, created_at: new Date(Date.now() - 259200000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString() },
]

const PREVIEW_PENDING_POSTS: CommunityPost[] = [
  {
    id: "preview-kms-pending-1",
    author_id: "preview-user-1",
    title: "測試資料",
    content: "測試資料",
    category: "howto",
    display_mode: "real_name",
    display_name: "測試資料",
    status: "published",
    ai_risk_level: "low",
    ai_risk_reason: null,
    ai_suggestions: null,
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    bookmark_count: 0,
    helpful_vote_count: 0,
    moderated_at: null,
    moderated_by: null,
    moderation_reason: null,
    is_in_kms: false,
    kms_card_id: null,
    edited_at: null,
    can_edit_until: null,
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    structured_data: {
      kms_suggestion: {
        suggested_title: "測試資料",
        summary: "測試資料",
        suggested_category: "visitor",
      },
    },
  },
]

export function KnowledgeBaseAdmin({ currentUser, isPreviewMode = false }: KnowledgeBaseAdminProps) {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null)
  const [pendingPosts, setPendingPosts] = useState<CommunityPost[]>([])
  const [rejectedPosts, setRejectedPosts] = useState<CommunityPost[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [rejectedLoading, setRejectedLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [actionSubmitting, setActionSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    category: "other",
    credibility: "community",
    status: "unverified",
  })

  // 載入待入庫貼文
  const loadPendingPosts = useCallback(async () => {
    if (isPreviewMode) {
      setPendingLoading(false)
      setPendingPosts(PREVIEW_PENDING_POSTS)
      return
    }

    setPendingLoading(true)
    try {
      const posts = await getPendingKMSPosts()
      setPendingPosts(posts as CommunityPost[])
    } catch (err) {
      console.error("[v0] Error loading pending posts:", err)
    } finally {
      setPendingLoading(false)
    }
  }, [isPreviewMode])
  const loadRejectedPosts = useCallback(async () => {
    if (isPreviewMode) {
      setRejectedLoading(false)
      setRejectedPosts([])
      return
    }

    setRejectedLoading(true)
    try {
      const posts = await getRejectedKMSPosts()
      setRejectedPosts(posts as CommunityPost[])
    } catch (err) {
      console.error("[v0] Error loading rejected posts:", err)
    } finally {
      setRejectedLoading(false)
    }
  }, [isPreviewMode])

  // 初次進入頁面就先載入一次，讓「待入庫審核」筆數可立即顯示
  useEffect(() => {
    loadPendingPosts()
    loadRejectedPosts()
  }, [loadPendingPosts, loadRejectedPosts])

  const { cards: realCards, loading: realLoading, error: realError, refresh: realRefresh, createCard, updateCard, deleteCard } = useKnowledgeCards({
    category: selectedCategory === "all" ? undefined : selectedCategory,
    status: selectedStatus,
    search: searchQuery || undefined,
  })

  const cards = isPreviewMode ? PREVIEW_CARDS : realCards
  const loading = isPreviewMode ? false : realLoading
  const error = isPreviewMode ? null : realError
  const refresh = isPreviewMode ? () => {} : realRefresh

  // 處理入庫
  const handleImport = async () => {
    if (actionSubmitting) return
    if (!selectedPost || !currentUser) return
    setActionSubmitting(true)
    try {
      await importPostToKMS(selectedPost.id, currentUser.id, {
        title: formData.title,
        summary: formData.summary,
        category: formData.category,
      })
      alert("入庫成功！")
      setShowImportDialog(false)
      setSelectedPost(null)
      resetForm()
      loadPendingPosts()
      refresh()
    } catch (err: any) {
      alert("入庫失敗: " + err.message)
    } finally {
      setActionSubmitting(false)
    }
  }

  // 處理拒絕入庫
  const handleReject = async () => {
    if (actionSubmitting) return
    if (!selectedPost || !currentUser) return
    setActionSubmitting(true)
    try {
      await rejectKMSSuggestion(selectedPost.id, currentUser.id, rejectReason)
      alert("已拒絕入庫建議")
      setShowRejectDialog(false)
      setSelectedPost(null)
      setRejectReason("")
      loadPendingPosts()
      loadRejectedPosts()
    } catch (err: any) {
      alert("操作失敗: " + err.message)
    } finally {
      setActionSubmitting(false)
    }
  }

  // 開啟入庫對話框
  const openImportDialog = (post: CommunityPost) => {
    const kmsSuggestion = (post as any).structured_data?.kms_suggestion || {}
    setSelectedPost(post)
    setFormData({
      title: kmsSuggestion.suggested_title || post.title,
      summary: kmsSuggestion.summary || post.content,
      category: kmsSuggestion.suggested_category || post.category,
      credibility: "community",
      status: "active",
    })
    setShowImportDialog(true)
  }

  const filteredCards = cards.filter((card) => {
    if (selectedStatus === "all") return true
    return card.status === selectedStatus
  })

  const handleCreate = async () => {
    if (actionSubmitting) return
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!currentUser) {
      alert("請先登入")
      return
    }
    setActionSubmitting(true)
    try {
      await createCard({
        source_type: "manual",
        title: formData.title,
        summary: formData.summary,
        category: formData.category,
        created_by: currentUser.id,
      })
      alert("知識卡建立成功")
      setShowCreateDialog(false)
      resetForm()
    } catch (err: any) {
      alert("建立失敗: " + err.message)
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!selectedCard || !currentUser) return
    try {
      await updateCard(
        selectedCard.id,
        {
          title: formData.title,
          summary: formData.summary,
          category: formData.category,
          changelog: "管理員編輯更新",
        },
        currentUser.id,
      )
      alert("知識卡更新成功")
      setShowEditDialog(false)
      resetForm()
    } catch (err: any) {
      alert("更新失敗: " + err.message)
    }
  }

  const handleDelete = async () => {
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!selectedCard) return
    try {
      await deleteCard(selectedCard.id)
      alert("知識卡已刪除")
      setShowDeleteDialog(false)
      setSelectedCard(null)
    } catch (err: any) {
      alert("刪除失敗: " + err.message)
    }
  }

  const handleStatusChange = async (cardId: string, newStatus: string) => {
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!currentUser) return
    try {
      await updateCard(
        cardId,
        {
          status: newStatus as "active" | "unverified" | "archived",
          changelog: `狀態變更為 ${newStatus}`,
        },
        currentUser.id,
      )
      alert(`狀態已變更為 ${newStatus}`)
      refresh()
    } catch (err: any) {
      alert("狀態變更失敗: " + err.message)
    }
  }

  const handleCredibilityChange = async (cardId: string, newCredibility: string) => {
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!currentUser) return
    try {
      await updateCard(
        cardId,
        {
          credibility: newCredibility,
          changelog: `可信度變更為 ${newCredibility}`,
        },
        currentUser.id,
      )
      alert(`可信度已變更為 ${newCredibility}`)
      refresh()
    } catch (err: any) {
      alert("可信度變更失敗: " + err.message)
    }
  }


  const resetForm = () => {
    setFormData({
      title: "",
      summary: "",
      category: "other",
      credibility: "community",
      status: "unverified",
    })
    setSelectedCard(null)
  }

  const openEditDialog = (card: any) => {
    setSelectedCard(card)
    setFormData({
      title: card.title || "",
      summary: card.summary || "",
      category: card.category || "other",
      credibility: card.credibility || "community",
      status: card.status || "unverified",
    })
    setShowEditDialog(true)
  }

  const getCredibilityBadge = (credibility: string) => {
    const option = CREDIBILITY_OPTIONS.find((o) => o.value === credibility)
    if (!option) return null
    const Icon = option.icon
    return (
      <Badge variant="outline" className={`${option.color} border-current`}>
        <Icon className="w-3 h-3 mr-1" />
        {option.label}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/50">已發布</Badge>
      case "unverified":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">待入庫(待入庫審核)</Badge>
      case "archived":
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50">拒絕入庫</Badge>
      case "removed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/50">已移除</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border pb-2">
        <Button variant="default" className="gap-2">
          <FileText className="w-4 h-4" />
          知識庫管理
        </Button>
        <HelpHint title="管理端知識庫" description="在同一頁管理正式知識卡、待入庫貼文與拒絕入庫紀錄。" workflow={["用狀態切換查看已發布、待入庫與拒絕入庫內容。","待入庫與拒絕入庫都直接來自貼文審核結果。"]} logic={["避免分頁拆散資料流，讓待審與拒絕結果都在同一套狀態篩選中查看。"]} align="center" />
      </div>

      <>
          {/* Header with actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">搜尋知識卡</span>
                <HelpHint title="管理端搜尋" description="可依標題或內容關鍵字查找既有知識卡。" workflow={["輸入標題或摘要關鍵字。","從結果中快速進入編輯或狀態調整。"]} logic={["搜尋能縮短維護定位時間，特別適合大量知識卡。"]} align="center" />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="搜尋知識卡..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                重新整理
              </Button>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                新增知識卡
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">分類篩選</span>
            <HelpHint title="管理端分類篩選" description="用分類快速盤點特定主題知識卡。" workflow={["先選擇主題分類。","再搭配搜尋縮小到目標內容。"]} logic={["全部：顯示所有主題知識卡。","包裹/訪客/報修/設施/管理費：對應各業務流程主題。","緊急：高優先通報與應變流程。","規章：制度與社區規範。","其他：尚未歸入既有主題。"]} align="center" />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className={selectedCategory === cat.value ? "bg-primary text-primary-foreground" : ""}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">狀態：</span>
            <HelpHint title="管理端狀態篩選" description="可檢視已發布、待入庫(待入庫審核)、拒絕入庫內容，安排維護優先序。" workflow={["切換狀態快速檢視不同生命週期內容。","優先處理待入庫與拒絕入庫項目。"]} logic={["全部狀態：顯示全部生命週期內容。","已發布（active）：可供住戶查閱。","待入庫（unverified）：內容待入庫審核。","拒絕入庫（archived）：已決定不入庫。"]} align="center" />
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status.value}
                variant={selectedStatus === status.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedStatus(status.value)}
              >
                {status.label}
              </Button>
            ))}
          </div>

          {/* Stats - 修正狀態計數 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">{cards.length}</div>
              <div className="text-sm text-muted-foreground">總知識卡</div>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-500">{cards.filter((c) => c.status === "active").length}</div>
              <div className="text-sm text-muted-foreground">已發布</div>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-500">
                {cards.filter((c) => c.credibility === "official").length}
              </div>
              <div className="text-sm text-muted-foreground">官方文件</div>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-500">
                {pendingPosts.length}
              </div>
              <div className="text-sm text-muted-foreground">待入庫</div>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-400">{rejectedPosts.length}</div>
              <div className="text-sm text-muted-foreground">拒絕入庫</div>
            </div>
          </div>

          {/* 合併後：待入庫狀態直接顯示原待入庫審核貼文 */}
          {selectedStatus === "unverified" && (
            <div className="space-y-4">
              <div className="bg-card border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">待入庫(待入庫審核)</h3>
                <p className="text-sm text-muted-foreground">以下貼文經 AI 評估後建議納入知識庫，請審核後決定是否入庫。</p>
              </div>

              {pendingLoading ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : pendingPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">目前沒有待入庫的貼文</div>
              ) : (
                <div className="space-y-3">
                  {pendingPosts.map((post) => {
                    const kmsSuggestion = (post as any).structured_data?.kms_suggestion || {}
                    return (
                      <div key={post.id} className="bg-card border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                                AI 建議入庫
                              </Badge>
                              <Badge variant="outline">
                                {CATEGORIES.find((c) => c.value === post.category)?.label || post.category}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-foreground">{post.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.content}</p>

                            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                              <div className="font-medium text-primary mb-1">AI 分析結果</div>
                              {kmsSuggestion.suggested_title && (
                                <div>
                                  <span className="text-muted-foreground">建議標題：</span>
                                  {kmsSuggestion.suggested_title}
                                </div>
                              )}
                              {kmsSuggestion.suggested_category && (
                                <div>
                                  <span className="text-muted-foreground">建議分類：</span>
                                  {CATEGORIES.find((c) => c.value === kmsSuggestion.suggested_category)?.label ||
                                    kmsSuggestion.suggested_category}
                                </div>
                              )}
                              {kmsSuggestion.summary && (
                                <div className="mt-1">
                                  <span className="text-muted-foreground">摘要：</span>
                                  {kmsSuggestion.summary}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                              <span>發布於 {new Date(post.created_at).toLocaleDateString()}</span>
                              <span>👍 {post.like_count || 0}</span>
                              <span>💬 {post.comment_count || 0}</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button size="sm" onClick={() => openImportDialog(post)} className="bg-green-600 hover:bg-green-700 text-white">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              入庫
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPost(post)
                                setShowRejectDialog(true)
                              }}
                              className="text-destructive border-destructive/50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              拒絕
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {selectedStatus === "archived" && (
            <div className="space-y-4">
              <div className="bg-card border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">拒絕入庫</h3>
                <p className="text-sm text-muted-foreground">以下貼文是已被管理員拒絕入庫的紀錄。</p>
              </div>

              {rejectedLoading ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : rejectedPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">目前沒有拒絕入庫的貼文</div>
              ) : (
                <div className="space-y-3">
                  {rejectedPosts.map((post) => {
                    const kmsSuggestion = (post as any).structured_data?.kms_suggestion || {}
                    return (
                      <div key={post.id} className="bg-card border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="outline" className="bg-gray-500/10 text-gray-300 border-gray-500/30">
                                已拒絕入庫
                              </Badge>
                              <Badge variant="outline">
                                {CATEGORIES.find((c) => c.value === post.category)?.label || post.category}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-foreground">{post.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.content}</p>
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                              {kmsSuggestion.reject_reason && (
                                <div>
                                  <span className="text-muted-foreground">拒絕原因：</span>
                                  {kmsSuggestion.reject_reason}
                                </div>
                              )}
                              {kmsSuggestion.rejected_at && (
                                <div>
                                  <span className="text-muted-foreground">拒絕時間：</span>
                                  {new Date(kmsSuggestion.rejected_at).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Cards list */}
          {selectedStatus !== "unverified" && selectedStatus !== "archived" && (loading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">尚無知識卡</div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map((card) => (
                <div key={card.id} className="bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {getCredibilityBadge(card.credibility)}
                        {getStatusBadge(card.status)}
                        <Badge variant="outline">
                          {CATEGORIES.find((c) => c.value === card.category)?.label || card.category}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-foreground truncate">{card.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{card.summary}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>👍 {card.helpful_count || 0}</span>
                        <span>👎 {card.not_helpful_count || 0}</span>
                        <span>👁 {card.view_count || 0} 次瀏覽</span>
                        <span>版本 {card.version || 1}</span>
                      </div>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(card)}>
                          <Edit className="w-4 h-4 mr-2" />
                          編輯
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleStatusChange(card.id, "active")}>
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                          發布
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(card.id, "unverified")}>
                          <XCircle className="w-4 h-4 mr-2 text-yellow-500" />
                          設為待入庫(待入庫審核)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(card.id, "archived")}>
                          <XCircle className="w-4 h-4 mr-2 text-gray-500" />
                          拒絕入庫
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCredibilityChange(card.id, "official")}>
                          <Building className="w-4 h-4 mr-2 text-blue-500" />
                          設為官方
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCredibilityChange(card.id, "verified")}>
                          <Shield className="w-4 h-4 mr-2 text-green-500" />
                          設為已驗證
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCredibilityChange(card.id, "community")}>
                          <Users className="w-4 h-4 mr-2 text-gray-500" />
                          設為社區
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCard(card)
                            setShowDeleteDialog(true)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Create Dialog - 使用 summary */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">新增知識卡<HelpHint title="管理端新增知識卡" description="建立可供住戶查閱的標準內容。" workflow={["填寫標題、摘要、分類與可信度。","確認內容可重用後建立發布。"]} logic={["新增內容應以標準流程為主，避免一次性公告式文字。"]} align="center" /></DialogTitle>
                <DialogDescription>建立新的知識卡供社區成員參考</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>標題</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="輸入標題"
                  />
                </div>
                <div>
                  <Label>摘要內容</Label>
                  <Textarea
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    placeholder="輸入摘要內容"
                    rows={5}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>分類</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>可信度</Label>
                    <Select
                      value={formData.credibility}
                      onValueChange={(v) => setFormData({ ...formData, credibility: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREDIBILITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={actionSubmitting}>
                  取消
                </Button>
                <Button onClick={handleCreate} disabled={actionSubmitting}>{actionSubmitting ? "處理中..." : "建立"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog - 使用 summary */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">編輯知識卡<HelpHint title="管理端編輯知識卡" description="更新內容後可透過版本歷史追蹤調整。" workflow={["修改標題、摘要或分類內容。","儲存後確認列表與版本紀錄更新。"]} logic={["持續編修可讓知識卡維持最新與一致。"]} align="center" /></DialogTitle>
                <DialogDescription>修改知識卡內容</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>標題</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="輸入標題"
                  />
                </div>
                <div>
                  <Label>摘要內容</Label>
                  <Textarea
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    placeholder="輸入摘要內容"
                    rows={5}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>分類</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>可信度</Label>
                    <Select
                      value={formData.credibility}
                      onValueChange={(v) => setFormData({ ...formData, credibility: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREDIBILITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleEdit}>儲存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>確認刪除</DialogTitle>
                <DialogDescription>確定要刪除「{selectedCard?.title}」嗎？此操作無法復原。</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  刪除
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">入庫知識卡<HelpHint title="管理端入庫" description="將審核通過的貼文轉為知識卡，供住戶搜尋使用。" workflow={["檢查 AI 建議欄位並人工修正標題摘要。","確認分類與可信度後執行入庫。"]} logic={["入庫會把貼文轉為可維護知識資產，後續可版本化管理。"]} align="center" /></DialogTitle>
            <DialogDescription>將選定的貼文納入知識庫</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>標題</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="輸入標題"
              />
            </div>
            <div>
              <Label>摘要內容</Label>
              <Textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="輸入摘要內容"
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>分類</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>可信度</Label>
                <Select
                  value={formData.credibility}
                  onValueChange={(v) => setFormData({ ...formData, credibility: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDIBILITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={actionSubmitting}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={actionSubmitting}>{actionSubmitting ? "處理中..." : "入庫"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">拒絕入庫建議<HelpHint title="管理端拒絕原因" description="請填具體原因，便於後續模型與流程優化。" workflow={["輸入具體且可執行的拒絕原因。","送出後返回待審列表確認案件已移除。"]} logic={["拒絕原因可回饋內容治理與 AI 建議品質改進。"]} align="center" /></DialogTitle>
            <DialogDescription>請輸入拒絕的原因</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>拒絕原因</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="輸入拒絕的原因"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={actionSubmitting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionSubmitting}>
              {actionSubmitting ? "處理中..." : "拒絕"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
