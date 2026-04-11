"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CommunityPostCard } from "./CommunityPostCard"
import { useCommunityPosts, useInteractions } from "../hooks/useCommunity"
import {
  getPostsByIds,
  getOwnModeratedPosts,
  getUserModerationAppeals,
  submitModerationAppeal,
  type CommunityPost,
  type ModerationAppeal,
} from "../api/community"
import type { User } from "@/features/profile/api/profile"
import { Search, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { HelpHint } from "@/components/ui/help-hint"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface CommunityPostListProps {
  currentUser: User | null
  onSelectPost: (postId: string) => void
  onCreatePost: () => void
}

type AppealBuckets = {
  beforeAppeal: CommunityPost[]
  inProgress: CommunityPost[]
  restored: CommunityPost[]
  rejected: CommunityPost[]
}

const EMPTY_APPEAL_BUCKETS: AppealBuckets = {
  beforeAppeal: [],
  inProgress: [],
  restored: [],
  rejected: [],
}

export function CommunityPostList({ currentUser, onSelectPost, onCreatePost }: CommunityPostListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const { posts, loading, error, withdrawPost, refresh } = useCommunityPosts({ category: selectedCategory })
  const { likePost, bookmarkPost } = useInteractions(currentUser?.id || "")
  const [appealBuckets, setAppealBuckets] = useState<AppealBuckets>(EMPTY_APPEAL_BUCKETS)
  const [appealStatusByPostId, setAppealStatusByPostId] = useState<Record<string, ModerationAppeal["status"]>>({})
  const [appealPanelOpen, setAppealPanelOpen] = useState(false)

  const categories = [
    { value: undefined, label: "全部" },
    { value: "case", label: "案例" },
    { value: "howto", label: "教學" },
    { value: "opinion", label: "意見" },
    { value: "alert", label: "警示" },
  ]

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const totalAppealPosts =
    appealBuckets.beforeAppeal.length +
    appealBuckets.inProgress.length +
    appealBuckets.restored.length +
    appealBuckets.rejected.length

  const appealSections = [
    { key: "beforeAppeal", title: "申訴前", posts: appealBuckets.beforeAppeal },
    { key: "inProgress", title: "申訴中", posts: appealBuckets.inProgress },
    { key: "restored", title: "申訴後成功", posts: appealBuckets.restored },
    { key: "rejected", title: "申訴後失敗", posts: appealBuckets.rejected },
  ]

  const handleWithdraw = async (postId: string) => {
    if (!currentUser) return
    try {
      await withdrawPost(postId, currentUser.id)
      alert("貼文已收回")
    } catch (err: any) {
      alert("收回失敗: " + err.message)
    }
  }

  const handleReport = (postId: string) => {
    // 這裡可以打開檢舉對話框
    alert("檢舉功能開發中")
  }

  const handleEdit = (postId: string) => {
    // 這裡可以打開編輯對話框
    alert("編輯功能開發中")
  }

  const loadAppealContext = async () => {
    if (!currentUser?.id) {
      setAppealBuckets(EMPTY_APPEAL_BUCKETS)
      setAppealStatusByPostId({})
      return
    }

    try {
      const ownModeratedPosts = await getOwnModeratedPosts(currentUser.id)
      const appeals = await getUserModerationAppeals(currentUser.id)

      const appealPostIds = Array.from(new Set(appeals.map((a) => a.post_id)))
      const appealPosts = await getPostsByIds(appealPostIds)
      const aiAppealPostIds = new Set(
        appealPosts.filter((post) => post?.id && post.ai_risk_level).map((post) => post.id),
      )

      // appeals 已依 created_at DESC 排序，第一筆即為最新申訴
      const statusMap: Record<string, ModerationAppeal["status"]> = {}
      const appealUpdatedAt: Record<string, string> = {}
      for (const appeal of appeals) {
        if (!aiAppealPostIds.has(appeal.post_id)) continue
        if (!statusMap[appeal.post_id]) {
          statusMap[appeal.post_id] = appeal.status
          appealUpdatedAt[appeal.post_id] = appeal.updated_at
        }
      }

      const moderatedById = new Map<string, CommunityPost>()
      for (const post of ownModeratedPosts) {
        if (post?.id) moderatedById.set(post.id, post)
      }
      for (const post of appealPosts) {
        if (post?.id && post.ai_risk_level) moderatedById.set(post.id, post)
      }

      // 申訴後成功：只顯示 30 天內剛恢復的，避免舊紀錄堆積
      const RESTORED_SHOW_DAYS = 30

      const unappealedPosts: CommunityPost[] = []
      const processingPosts: CommunityPost[] = []
      const restoredPosts: CommunityPost[] = []
      const rejectedPosts: CommunityPost[] = []

      for (const post of moderatedById.values()) {
        const isAppealableStatus = post.status === "pending" && !!post.ai_risk_level && !post.moderated_by
        const appealStatus = statusMap[post.id]

        if (appealStatus === "pending" || appealStatus === "reviewing") {
          // 申訴進行中，貼文狀態不拘
          processingPosts.push(post)
        } else if (appealStatus === "restored") {
          if (isAppealableStatus) {
            // 申訴成功後又被二次處置 → 視為未申訴，讓使用者可重新申訴
            unappealedPosts.push(post)
          } else {
            // 已恢復正常 → 僅保留近 30 天的成功紀錄
            const ts = appealUpdatedAt[post.id]
            const daysSince = ts ? (Date.now() - new Date(ts).getTime()) / 86_400_000 : Infinity
            if (daysSince <= RESTORED_SHOW_DAYS) {
              restoredPosts.push(post)
            }
          }
        } else if (appealStatus === "rejected") {
          rejectedPosts.push(post)
        } else {
          // 無申訴或已撤銷 → 只在可申訴狀態顯示
          if (isAppealableStatus) {
            unappealedPosts.push(post)
          }
        }
      }

      // 各群組按 updated_at 新→舊排列
      const sortByUpdated = (a: CommunityPost, b: CommunityPost) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()

      setAppealBuckets({
        beforeAppeal: unappealedPosts.sort(sortByUpdated),
        inProgress: processingPosts.sort(sortByUpdated),
        restored: restoredPosts.sort(sortByUpdated),
        rejected: rejectedPosts.sort(sortByUpdated),
      })
      setAppealStatusByPostId(statusMap)
    } catch (e) {
      console.error("[v0] Error loading appeal context:", e)
    }
  }

  useEffect(() => {
    loadAppealContext()
  }, [currentUser?.id])

  const handleAppeal = async (postId: string, reason: string) => {
    if (!currentUser?.id) {
      alert("請先登入")
      return
    }

    try {
      const result = await submitModerationAppeal({
        postId,
        authorId: currentUser.id,
        reason,
      })
      alert(result.message)
      await loadAppealContext()
    } catch (err: any) {
      alert(err?.message || "申訴提交失敗")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p className="text-sm">載入失敗: {error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Improved search bar with better styling */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">搜尋社區貼文</span>
            <HelpHint title="住戶端貼文搜尋" description="可用標題或內容關鍵字快速找到相關討論。" workflow={["輸入主題關鍵字。","從結果中選擇要閱讀的貼文。"]} logic={["搜尋同時比對標題與內容，提高命中率。"]} align="center" />
          </div>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋貼文..."
            className="pl-10 bg-card border-border/50 rounded-full"
          />
        </div>
        {currentUser && (
          <Button onClick={onCreatePost} className="gap-2 shrink-0 rounded-full bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            發文
          </Button>
        )}
      </div>

      {currentUser && (
        <Collapsible
          open={appealPanelOpen}
          onOpenChange={setAppealPanelOpen}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)]/40"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--theme-text-primary)]">申訴專區</span>
              <HelpHint
                title="住戶端申訴"
                description="若內容被下架且你認為是誤判，可提交申訴要求管理員人工複審。"
                workflow={[
                  "在被處置貼文中點擊『提出申訴』。",
                  "填寫具體申訴理由後送出。",
                  "等待管理員複審結果。",
                ]}
                logic={[
                  "同一貼文有處理中案件時不可重複送出。",
                  "申訴失敗後不可再次申請同一貼文。",
                ]}
                align="center"
              />
              <span className="text-xs text-[var(--theme-text-secondary)]">
                申訴前 {appealBuckets.beforeAppeal.length} 筆 / 申訴中 {appealBuckets.inProgress.length} 筆 / 成功 {appealBuckets.restored.length} 筆 / 失敗 {appealBuckets.rejected.length} 筆
              </span>
            </div>

            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                {appealPanelOpen ? (
                  <>
                    收合
                    <ChevronUp className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    展開
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="space-y-3 px-3 pb-3">
            {totalAppealPosts === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--theme-border)] p-3 text-xs text-[var(--theme-text-secondary)]">
                目前沒有可申訴的被處置貼文
              </div>
            ) : (
              appealSections.map((section) => (
                <div key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)]/50 px-3 py-2">
                    <span className="text-sm font-medium text-[var(--theme-text-primary)]">{section.title}</span>
                    <span className="text-xs text-[var(--theme-text-secondary)]">{section.posts.length} 筆</span>
                  </div>

                  {section.posts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--theme-border)] p-3 text-xs text-[var(--theme-text-secondary)]">
                      目前沒有{section.title}案件
                    </div>
                  ) : (
                    section.posts.map((post) => (
                      <div key={`${section.key}-${post.id}`} className="cursor-default">
                        <CommunityPostCard
                          post={{ ...post, moderation_reason: post.moderation_reason ?? undefined }}
                          currentUserId={currentUser.id}
                          onAppeal={handleAppeal}
                          appealStatus={appealStatusByPostId[post.id]}
                        />
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-2 shrink-0 pr-2">
          <span className="text-xs text-muted-foreground">分類</span>
          <HelpHint title="住戶端貼文分類" description="可用案例、教學、意見、警示篩選討論主題。" workflow={["先選分類縮小列表。","再搭配搜尋快速定位。"]} logic={["全部：顯示所有討論。","案例：實際事件與處理經驗。","教學：步驟教學與操作指南。","意見：討論想法與建議。","警示：風險提醒與重要通報。"]} align="center" />
        </div>
        {categories.map((cat) => (
          <button
            key={cat.value || "all"}
            onClick={() => setSelectedCategory(cat.value)}
            className={`shrink-0 px-4 py-1.5 text-sm font-medium transition-all rounded-full ${
              selectedCategory === cat.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Using new CommunityPostCard component */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">貼文列表</span>
        <HelpHint title="住戶端貼文列表" description="點選卡片可進入詳情、留言與檢舉。" workflow={["先看卡片摘要判斷是否相關。","點卡片進入詳情頁執行互動。"]} logic={["列表是討論入口，詳情頁是互動主場景。"]} align="center" />
      </div>
      <div className="space-y-3">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">尚無貼文</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} onClick={() => onSelectPost(post.id)} className="cursor-pointer">
              <CommunityPostCard
                post={{ ...post, moderation_reason: post.moderation_reason ?? undefined }}
                currentUserId={currentUser?.id}
                onLike={(postId) => {
                  // 阻止事件冒泡，避免觸發 onSelectPost
                  likePost(postId)
                }}
                onComment={(postId) => onSelectPost(postId)}
                onBookmark={(postId) => bookmarkPost(postId)}
                onWithdraw={handleWithdraw}
                onEdit={handleEdit}
                onReport={handleReport}
                onAppeal={handleAppeal}
              />
            </div>
          ))
        )}
      </div>

    </div>
  )
}
