"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Edit, Trash2, CheckCircle, XCircle, Shield, Users, Building, MoreVertical, Inbox, FileText, ArrowRight } from "lucide-react"
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
import { getPendingKMSPosts, importPostToKMS, rejectKMSSuggestion } from "../api/kms"
import type { User } from "@/features/profile/api/profile"
import type { CommunityPost } from "@/features/community/api/community"

interface KnowledgeBaseAdminProps {
  currentUser: User | null
  isPreviewMode?: boolean
}

type TabType = "cards" | "pending"

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
  { value: "unverified", label: "待驗證" },
  { value: "archived", label: "已封存" },
]

const CREDIBILITY_OPTIONS = [
  { value: "official", label: "官方", icon: Building, color: "text-blue-500" },
  { value: "verified", label: "已驗證", icon: CheckCircle, color: "text-green-500" },
  { value: "community", label: "社區", icon: Users, color: "text-gray-500" },
]

// 預覽模式的模擬資料
const PREVIEW_CARDS = [
  { id: "preview-1", title: "包裹領取流程", summary: "說明如何領取包裹的標準流程...", category: "package", credibility: "official", status: "active", helpful_count: 15, not_helpful_count: 2, view_count: 120, version: 1 },
  { id: "preview-2", title: "訪客登記須知", summary: "訪客來訪前需要完成的登記步驟...", category: "visitor", credibility: "verified", status: "active", helpful_count: 8, not_helpful_count: 1, view_count: 85, version: 2 },
  { id: "preview-3", title: "設施預約規則", summary: "公共設施預約的相關規定...", category: "facility", credibility: "community", status: "unverified", helpful_count: 3, not_helpful_count: 0, view_count: 42, version: 1 },
]

export function KnowledgeBaseAdmin({ currentUser, isPreviewMode = false }: KnowledgeBaseAdminProps) {
  const [activeTab, setActiveTab] = useState<TabType>("cards")
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
  const [pendingLoading, setPendingLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    category: "other",
    credibility: "community",
    status: "unverified",
  })

  // 載入待入庫貼文
  const loadPendingPosts = useCallback(async () => {
    setPendingLoading(true)
    try {
      const posts = await getPendingKMSPosts()
      setPendingPosts(posts as CommunityPost[])
    } catch (err) {
      console.error("[v0] Error loading pending posts:", err)
    } finally {
      setPendingLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "pending") {
      loadPendingPosts()
    }
  }, [activeTab, loadPendingPosts])

  const { cards, loading, error, refresh, createCard, updateCard, deleteCard } = useKnowledgeCards({
    category: selectedCategory === "all" ? undefined : selectedCategory,
    search: searchQuery || undefined,
  })

  // 處理入庫
  const handleImport = async () => {
    if (!selectedPost || !currentUser) return
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
    }
  }

  // 處理拒絕入庫
  const handleReject = async () => {
    if (!selectedPost || !currentUser) return
    try {
      await rejectKMSSuggestion(selectedPost.id, currentUser.id, rejectReason)
      alert("已拒絕入庫建議")
      setShowRejectDialog(false)
      setSelectedPost(null)
      setRejectReason("")
      loadPendingPosts()
    } catch (err: any) {
      alert("操作失敗: " + err.message)
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
    if (!currentUser) {
      alert("請先登入")
      return
    }
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
    }
  }

  const handleEdit = async () => {
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
    if (!currentUser) return
    try {
      await updateCard(
        cardId,
        {
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
    if (!currentUser) return
    try {
      await updateCard(
        cardId,
        {
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
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">待驗證</Badge>
      case "archived":
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50">已封存</Badge>
      case "removed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/50">已移除</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab 切換 */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "cards" ? "default" : "ghost"}
          onClick={() => setActiveTab("cards")}
          className="gap-2"
        >
          <FileText className="w-4 h-4" />
          知識卡管理
        </Button>
        <Button
          variant={activeTab === "pending" ? "default" : "ghost"}
          onClick={() => setActiveTab("pending")}
          className="gap-2"
        >
          <Inbox className="w-4 h-4" />
          待入庫審核
          {pendingPosts.length > 0 && (
            <Badge variant="destructive" className="ml-1">{pendingPosts.length}</Badge>
          )}
        </Button>
      </div>

      {activeTab === "pending" ? (
        /* 待入庫審核分頁 */
        <div className="space-y-4">
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-2">AI 建議入庫的貼文</h3>
            <p className="text-sm text-muted-foreground">
              以下貼文經 AI 評估後建議納入知識庫，請審核後決定是否入庫。
            </p>
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
                        
                        {/* AI 分析結果 */}
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                          <div className="font-medium text-primary mb-1">AI 分析結果</div>
                          {kmsSuggestion.suggested_title && (
                            <div><span className="text-muted-foreground">建議標題：</span>{kmsSuggestion.suggested_title}</div>
                          )}
                          {kmsSuggestion.suggested_category && (
                            <div><span className="text-muted-foreground">建議分類：</span>
                              {CATEGORIES.find((c) => c.value === kmsSuggestion.suggested_category)?.label || kmsSuggestion.suggested_category}
                            </div>
                          )}
                          {kmsSuggestion.summary && (
                            <div className="mt-1"><span className="text-muted-foreground">摘要：</span>{kmsSuggestion.summary}</div>
                          )}
                        </div>

                        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                          <span>發布於 {new Date(post.created_at).toLocaleDateString()}</span>
                          <span>👍 {post.like_count || 0}</span>
                          <span>💬 {post.comment_count || 0}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => openImportDialog(post)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
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
      ) : (
        /* 知識卡管理分頁 */
        <>
          {/* Header with actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋知識卡..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              新增知識卡
            </Button>
          </div>

          {/* Filters */}
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
                {cards.filter((c) => c.status === "unverified").length}
              </div>
              <div className="text-sm text-muted-foreground">待驗證</div>
            </div>
          </div>

          {/* Cards list */}
          {loading ? (
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
                          設為待驗證
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(card.id, "archived")}>
                          <XCircle className="w-4 h-4 mr-2 text-gray-500" />
                          封存
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
          )}

          {/* Create Dialog - 使用 summary */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>新增知識卡</DialogTitle>
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
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate}>建立</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog - 使用 summary */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>編輯知識卡</DialogTitle>
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
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>入庫知識卡</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
            <Button onClick={handleImport}>入庫</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>拒絕入庫建議</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              拒絕
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
