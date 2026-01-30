"use client"

import { useState, useEffect } from "react"
import {
  Search,
  MoreVertical,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Heart,
  Clock,
  Filter,
  ShieldAlert,
  FileWarning,
  EyeOff,
} from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSupabaseClient } from "@/lib/supabase"
import type { User } from "@/features/profile/api/profile"
import type { CommunityPost } from "../api/community"

interface CommunityBoardAdminProps {
  currentUser: User | null
  isPreviewMode?: boolean
}

interface ModerationQueueItem {
  id: string
  item_type: "post" | "comment" | "report"
  item_id: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "in_review" | "resolved"
  ai_risk_summary?: string
  ai_suggested_action?: string
  created_at: string
  deadline?: string
  assigned_to?: string
  resolved_by?: string
  resolved_at?: string
  resolution?: string
  // 關聯的貼文資料
  post?: CommunityPost
}

const CATEGORIES = [
  { value: "all", label: "全部" },
  { value: "case", label: "案例" },
  { value: "howto", label: "教學" },
  { value: "opinion", label: "意見" },
  { value: "alert", label: "警示" },
]

const STATUSES = [
  { value: "all", label: "全部狀態", color: "bg-gray-500" },
  { value: "published", label: "已發布", color: "bg-green-500" },
  { value: "pending", label: "待審核", color: "bg-yellow-500" },
  { value: "shadow", label: "影子封禁", color: "bg-purple-500" },
  { value: "redacted", label: "已遮蔽", color: "bg-orange-500" },
  { value: "removed", label: "已下架", color: "bg-red-500" },
  { value: "deleted", label: "已刪除", color: "bg-gray-400" },
]

const CATEGORY_LABELS: Record<string, string> = {
  case: "案例",
  howto: "教學",
  opinion: "意見",
  alert: "警示",
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "緊急", color: "bg-red-600" },
  high: { label: "高", color: "bg-red-500" },
  medium: { label: "中", color: "bg-yellow-500" },
  low: { label: "低", color: "bg-green-500" },
}

export function CommunityBoardAdmin({ currentUser, isPreviewMode = false }: CommunityBoardAdminProps) {
  const [activeTab, setActiveTab] = useState("posts")
  
  // 預覽模式下遮蔽資料的輔助函數
  const maskData = (text: string | null | undefined, type: "title" | "content" | "name" = "content") => {
    if (!isPreviewMode || !text) return text
    return `[${type === "title" ? "標題" : type === "name" ? "用戶" : "內容"}已遮蔽 - 系統管理員無權查看]`
  }
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [moderationQueue, setModerationQueue] = useState<ModerationQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null)
  const [selectedQueueItem, setSelectedQueueItem] = useState<ModerationQueueItem | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [showModerationDialog, setShowModerationDialog] = useState(false)
  const [actionType, setActionType] = useState<string>("")
  const [actionReason, setActionReason] = useState("")
  const [queueFilter, setQueueFilter] = useState<"pending" | "resolved">("pending")

  // 統計
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    pending: 0,
    shadow: 0,
    redacted: 0,
    removed: 0,
    queuePending: 0,
    queueResolved: 0,
  })

  const loadPosts = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      let query = supabase.from("community_posts").select("*").order("created_at", { ascending: false })

      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory)
      }
      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus)
      }

      const { data, error } = await query

      if (error) {
        console.error("[v0] Error loading posts:", error)
        return
      }

      setPosts(data || [])

      // 計算統計
      const { data: allPosts } = await supabase.from("community_posts").select("status")
      const postStats = allPosts || []

      // 載入審核隊列統計
      const { data: queueData } = await supabase.from("moderation_queue").select("status")
      const queueStats = queueData || []

      setStats({
        total: postStats.length,
        published: postStats.filter((p: any) => p.status === "published").length,
        pending: postStats.filter((p: any) => p.status === "pending").length,
        shadow: postStats.filter((p: any) => p.status === "shadow").length,
        redacted: postStats.filter((p: any) => p.status === "redacted").length,
        removed: postStats.filter((p: any) => p.status === "removed" || p.status === "deleted").length,
        queuePending: queueStats.filter((q: any) => q.status === "pending" || q.status === "in_review").length,
        queueResolved: queueStats.filter((q: any) => q.status === "resolved").length,
      })
    } catch (e) {
      console.error("[v0] Error:", e)
    } finally {
      setLoading(false)
    }
  }

  const loadModerationQueue = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    try {
      const statusFilter = queueFilter === "pending" ? ["pending", "in_review"] : ["resolved"]

      const { data, error } = await supabase
        .from("moderation_queue")
        .select("*")
        .in("status", statusFilter)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })

      if (error) {
        console.error("[v0] Error loading moderation queue:", error)
        return
      }

      // 載入關聯的貼文資料
      const queueWithPosts = await Promise.all(
        (data || []).map(async (item) => {
          if (item.item_type === "post") {
            const { data: post } = await supabase.from("community_posts").select("*").eq("id", item.item_id).single()
            return { ...item, post }
          }
          return item
        }),
      )

      setModerationQueue(queueWithPosts)
    } catch (e) {
      console.error("[v0] Error:", e)
    }
  }

  useEffect(() => {
    loadPosts()
    loadModerationQueue()
  }, [selectedCategory, selectedStatus, queueFilter])

  const handleAction = async () => {
    if (!selectedPost) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    try {
      let newStatus = selectedPost.status
      switch (actionType) {
        case "publish":
          newStatus = "published"
          break
        case "pending":
          newStatus = "pending"
          break
        case "shadow":
          newStatus = "shadow"
          break
        case "redact":
          newStatus = "redacted"
          break
        case "remove":
          newStatus = "removed"
          break
        case "delete":
          newStatus = "deleted"
          break
      }

      const updateData = {
        status: newStatus,
        moderated_at: new Date().toISOString(),
        moderated_by: currentUser?.id,
        moderation_reason: actionReason || null,
      }

      const { error } = await supabase.from("community_posts").update(updateData).eq("id", selectedPost.id)

      if (error) {
        alert("操作失敗: " + error.message)
        return
      }

      // 記錄稽核日誌
      await supabase.from("audit_logs").insert([
        {
          operator_id: currentUser?.id,
          operator_role: currentUser?.role,
          action_type: `post_${actionType}`,
          target_type: "community_post",
          target_id: selectedPost.id,
          reason: actionReason,
          after_state: { status: newStatus },
        },
      ])

      alert("操作成功")
      setShowActionDialog(false)
      setActionReason("")
      loadPosts()
    } catch (e: any) {
      alert("操作失敗: " + e.message)
    }
  }

  const handleModerationResolve = async (action: "approve" | "remove" | "reject_report" | "redact" | "shadow") => {
    if (!selectedQueueItem) {
      alert("請選擇要處理的項目")
      return
    }

    const userId = currentUser?.id || localStorage.getItem("userId")
    if (!userId) {
      alert("請先登入")
      return
    }

    console.log("[v0] handleModerationResolve called:", {
      action,
      itemId: selectedQueueItem.id,
      userId,
      reason: actionReason,
    })

    try {
      const response = await fetch("/api/moderation/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedQueueItem.id,
          userId: userId,
          resolution: {
            action,
            reason: actionReason,
          },
        }),
      })

      const result = await response.json()
      console.log("[v0] API response:", result)

      if (!response.ok) {
        alert("操作失敗: " + (result.error || "未知錯誤"))
        return
      }

      alert("審核完成")
      setShowModerationDialog(false)
      setActionReason("")
      setSelectedQueueItem(null)
      loadPosts()
      loadModerationQueue()
    } catch (e: any) {
      console.error("[v0] Error in handleModerationResolve:", e)
      alert("操作失敗: " + e.message)
    }
  }

  const openActionDialog = (post: CommunityPost, action: string) => {
    setSelectedPost(post)
    setActionType(action)
    setShowActionDialog(true)
  }

  const filteredPosts = posts.filter((post) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      post.title?.toLowerCase().includes(query) ||
      post.content?.toLowerCase().includes(query) ||
      post.display_name?.toLowerCase().includes(query)
    )
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUSES.find((s) => s.value === status)
    return (
      <Badge variant="outline" className={`${statusConfig?.color || "bg-gray-500"} text-white border-0`}>
        {statusConfig?.label || status}
      </Badge>
    )
  }

  const getRiskBadge = (level: string | null) => {
    if (!level) return null
    const colors: Record<string, string> = {
      low: "bg-green-500",
      medium: "bg-yellow-500",
      high: "bg-red-500",
    }
    return (
      <Badge variant="outline" className={`${colors[level] || "bg-gray-500"} text-white border-0`}>
        風險: {level === "low" ? "低" : level === "medium" ? "中" : "高"}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority] || { label: priority, color: "bg-gray-500" }
    return (
      <Badge variant="outline" className={`${config.color} text-white border-0`}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* 統計面板 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[var(--theme-accent)]">{stats.total}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">總貼文數</div>
        </div>
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{stats.published}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">已發布</div>
        </div>
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">待審核</div>
        </div>
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-500">{stats.shadow}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">影子封禁</div>
        </div>
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{stats.redacted}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">已遮蔽</div>
        </div>
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{stats.removed}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">已下架</div>
        </div>
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-400">{stats.queuePending}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">審核待處理</div>
        </div>
        <div className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">{stats.queueResolved}</div>
          <div className="text-sm text-[var(--theme-text-secondary)]">審核已完成</div>
        </div>
      </div>

      {/* 分頁切換 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[var(--theme-bg-primary)]">
          <TabsTrigger
            value="posts"
            className="data-[state=active]:bg-[var(--theme-accent)] data-[state=active]:text-black"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            貼文管理
          </TabsTrigger>
          <TabsTrigger
            value="moderation"
            className="data-[state=active]:bg-[var(--theme-accent)] data-[state=active]:text-black"
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            審核隊列
            {stats.queuePending > 0 && <Badge className="ml-2 bg-red-500 text-white">{stats.queuePending}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* 貼文管理 */}
        <TabsContent value="posts" className="space-y-4">
          {/* 搜尋和篩選 */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
              <Input
                placeholder="搜尋貼文標題或內容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[var(--theme-bg-primary)] border-[var(--theme-border)]"
              />
            </div>

            {/* 分類篩選 */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat.value}
                  variant={selectedCategory === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.value)}
                  className={selectedCategory === cat.value ? "bg-[var(--theme-accent)] text-black" : ""}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 狀態篩選 */}
          <div className="flex gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-[var(--theme-text-secondary)] mt-2" />
            {STATUSES.map((status) => (
              <Button
                key={status.value}
                variant={selectedStatus === status.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus(status.value)}
                className={selectedStatus === status.value ? "bg-[var(--theme-accent)] text-black" : ""}
              >
                {status.label}
              </Button>
            ))}
          </div>

          {/* 貼文列表 */}
          {loading ? (
            <div className="text-center py-12 text-[var(--theme-text-secondary)]">載入中...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-[var(--theme-text-secondary)]">尚無貼文</div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 hover:border-[var(--theme-accent)] transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getStatusBadge(post.status)}
                        {getRiskBadge(post.ai_risk_level)}
                        <Badge variant="outline" className="bg-[var(--theme-bg-card)]">
                          {CATEGORY_LABELS[post.category] || post.category}
                        </Badge>
                      </div>

                      <h3 className="font-semibold text-[var(--theme-text-primary)] mb-1 truncate">
                        {maskData(post.title, "title")}
                      </h3>
                      <p className="text-sm text-[var(--theme-text-secondary)] line-clamp-2 mb-2">
                        {maskData(post.content, "content")}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-[var(--theme-text-secondary)]">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {post.view_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {post.like_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {post.comment_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(post.created_at).toLocaleDateString("zh-TW")}
                        </span>
                        <span>作者: {isPreviewMode ? "***" : (post.display_name || "匿名")}</span>
                      </div>

                      {post.ai_risk_reason && (
                        <div className="mt-2 p-2 bg-yellow-500/10 rounded text-xs text-yellow-500">
                          AI 風險原因: {post.ai_risk_reason}
                        </div>
                      )}
                    </div>

                    {/* 操作選單 - 預覽模式下隱藏 */}
                    {!isPreviewMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedPost(post)
                              setShowDetailDialog(true)
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            查看詳情
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {post.status !== "published" && (
                            <DropdownMenuItem onClick={() => openActionDialog(post, "publish")}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                              發布
                            </DropdownMenuItem>
                          )}
                          {post.status !== "pending" && (
                            <DropdownMenuItem onClick={() => openActionDialog(post, "pending")}>
                              <Clock className="w-4 h-4 mr-2 text-yellow-500" />
                              設為待審核
                            </DropdownMenuItem>
                          )}
                          {post.status !== "shadow" && (
                            <DropdownMenuItem onClick={() => openActionDialog(post, "shadow")}>
                              <AlertTriangle className="w-4 h-4 mr-2 text-purple-500" />
                              影子封禁
                            </DropdownMenuItem>
                          )}
                          {post.status !== "redacted" && (
                            <DropdownMenuItem onClick={() => openActionDialog(post, "redact")}>
                              <EyeOff className="w-4 h-4 mr-2 text-orange-500" />
                              遮蔽敏感內容
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openActionDialog(post, "remove")} className="text-red-500">
                            <XCircle className="w-4 h-4 mr-2" />
                            下架貼文
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openActionDialog(post, "delete")} className="text-red-500">
                            <Trash2 className="w-4 h-4 mr-2" />
                            刪除貼文
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 審核隊列 */}
        <TabsContent value="moderation" className="space-y-4">
          {/* 審核狀態篩選 */}
          <div className="flex gap-2">
            <Button
              variant={queueFilter === "pending" ? "default" : "outline"}
              onClick={() => setQueueFilter("pending")}
              className={queueFilter === "pending" ? "bg-[var(--theme-accent)] text-black" : ""}
            >
              待處理 ({stats.queuePending})
            </Button>
            <Button
              variant={queueFilter === "resolved" ? "default" : "outline"}
              onClick={() => setQueueFilter("resolved")}
              className={queueFilter === "resolved" ? "bg-[var(--theme-accent)] text-black" : ""}
            >
              已完成 ({stats.queueResolved})
            </Button>
          </div>

          {/* 審核隊列列表 */}
          {moderationQueue.length === 0 ? (
            <div className="text-center py-12 text-[var(--theme-text-secondary)]">
              {queueFilter === "pending" ? "沒有待處理的審核項目" : "沒有已完成的審核項目"}
            </div>
          ) : (
            <div className="space-y-4">
              {moderationQueue.map((item) => (
                <div
                  key={item.id}
                  className="bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] rounded-xl p-4 hover:border-[var(--theme-accent)] transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getPriorityBadge(item.priority)}
                        <Badge variant="outline" className="bg-[var(--theme-bg-card)]">
                          {item.item_type === "post" ? "貼文" : item.item_type === "comment" ? "留言" : "檢舉"}
                        </Badge>
                        {item.status === "resolved" && (
                          <Badge variant="outline" className="bg-blue-500 text-white border-0">
                            已處理
                          </Badge>
                        )}
                      </div>

                      {item.post && (
                        <>
                          <h3 className="font-semibold text-[var(--theme-text-primary)] mb-1 truncate">
                            {item.post.title}
                          </h3>
                          <p className="text-sm text-[var(--theme-text-secondary)] line-clamp-2 mb-2">
                            {item.post.content}
                          </p>
                        </>
                      )}

                      {item.ai_risk_summary && (
                        <div className="p-2 bg-yellow-500/10 rounded text-xs text-yellow-500 mb-2">
                          <FileWarning className="w-3 h-3 inline mr-1" />
                          {item.ai_risk_summary}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-[var(--theme-text-secondary)]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          建立: {new Date(item.created_at).toLocaleString("zh-TW")}
                        </span>
                        {item.deadline && (
                          <span className="text-red-500">期限: {new Date(item.deadline).toLocaleString("zh-TW")}</span>
                        )}
                        {item.resolved_at && (
                          <span className="text-green-500">
                            處理: {new Date(item.resolved_at).toLocaleString("zh-TW")}
                          </span>
                        )}
                      </div>

                      {item.ai_suggested_action && (
                        <div className="mt-2 text-xs text-[var(--theme-accent)]">
                          AI 建議: {item.ai_suggested_action}
                        </div>
                      )}
                    </div>

                    {/* 審核操作按鈕 */}
                    {item.status !== "resolved" && (
                      <Button
                        variant="outline"
                        className="border-[var(--theme-accent)] text-[var(--theme-accent)] bg-transparent"
                        onClick={() => {
                          setSelectedQueueItem(item)
                          setShowModerationDialog(true)
                        }}
                      >
                        處理
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 貼文詳情 Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>貼文詳情</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {getStatusBadge(selectedPost.status)}
                {getRiskBadge(selectedPost.ai_risk_level)}
                <Badge variant="outline">{CATEGORY_LABELS[selectedPost.category] || selectedPost.category}</Badge>
              </div>

              <div>
                <Label className="text-[var(--theme-text-secondary)]">標題</Label>
                <p className="font-semibold">{selectedPost.title}</p>
              </div>

              <div>
                <Label className="text-[var(--theme-text-secondary)]">內容</Label>
                <p className="whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[var(--theme-text-secondary)]">作者</Label>
                  <p>{selectedPost.display_name || "匿名"}</p>
                </div>
                <div>
                  <Label className="text-[var(--theme-text-secondary)]">發布時間</Label>
                  <p>{new Date(selectedPost.created_at).toLocaleString("zh-TW")}</p>
                </div>
              </div>

              {selectedPost.ai_risk_reason && (
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <Label className="text-yellow-500">AI 風險分析</Label>
                  <p className="text-sm mt-1">{selectedPost.ai_risk_reason}</p>
                </div>
              )}

              {selectedPost.moderation_reason && (
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <Label className="text-red-500">審核原因</Label>
                  <p className="text-sm mt-1">{selectedPost.moderation_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 操作確認 Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "publish" && "發布貼文"}
              {actionType === "pending" && "設為待審核"}
              {actionType === "shadow" && "影子封禁"}
              {actionType === "redact" && "遮蔽敏感內容"}
              {actionType === "remove" && "下架貼文"}
              {actionType === "delete" && "刪除貼文"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "publish" && "確定要發布此貼文嗎？"}
              {actionType === "pending" && "確定要將此貼文設為待審核嗎？"}
              {actionType === "shadow" && "影子封禁後，只有作者可以看到此貼文，其他用戶看不到。"}
              {actionType === "redact" && "遮蔽後，貼文仍然公開但敏感片段會被遮蔽處理。"}
              {actionType === "remove" && "下架後，此貼文將不再顯示，作者可看到下架原因。"}
              {actionType === "delete" && "刪除後，此貼文將永久刪除。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>操作原因（選填）</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="請輸入操作原因..."
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleAction}
              className={
                actionType === "remove" || actionType === "delete"
                  ? "bg-red-500 hover:bg-red-600"
                  : actionType === "redact"
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-[var(--theme-accent)]"
              }
            >
              確認
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 審核處理 Dialog */}
      <Dialog open={showModerationDialog} onOpenChange={setShowModerationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>審核處理</DialogTitle>
            <DialogDescription>請選擇對此項目的處理方式</DialogDescription>
          </DialogHeader>

          {selectedQueueItem?.post && (
            <div className="p-3 bg-[var(--theme-bg-secondary)] rounded-lg mb-4">
              <p className="font-semibold mb-1">{selectedQueueItem.post.title}</p>
              <p className="text-sm text-[var(--theme-text-secondary)] line-clamp-3">
                {selectedQueueItem.post.content}
              </p>
            </div>
          )}

          {selectedQueueItem?.ai_risk_summary && (
            <div className="p-3 bg-yellow-500/10 rounded-lg mb-4">
              <Label className="text-yellow-500">AI 風險分析</Label>
              <p className="text-sm mt-1">{selectedQueueItem.ai_risk_summary}</p>
              {selectedQueueItem.ai_suggested_action && (
                <p className="text-sm mt-1 text-[var(--theme-accent)]">建議: {selectedQueueItem.ai_suggested_action}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label>處理原因（選填）</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="請輸入處理原因..."
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2">
            <div className="flex flex-wrap gap-2 justify-end w-full">
              <Button variant="outline" onClick={() => setShowModerationDialog(false)}>
                取消
              </Button>
              <Button onClick={() => handleModerationResolve("approve")} className="bg-green-500 hover:bg-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                核准發布
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 justify-end w-full">
              <Button onClick={() => handleModerationResolve("shadow")} className="bg-purple-500 hover:bg-purple-600">
                <AlertTriangle className="w-4 h-4 mr-2" />
                影子封禁
              </Button>
              <Button onClick={() => handleModerationResolve("redact")} className="bg-orange-500 hover:bg-orange-600">
                <EyeOff className="w-4 h-4 mr-2" />
                遮蔽敏感
              </Button>
              <Button onClick={() => handleModerationResolve("remove")} className="bg-red-500 hover:bg-red-600">
                <XCircle className="w-4 h-4 mr-2" />
                下架內容
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
