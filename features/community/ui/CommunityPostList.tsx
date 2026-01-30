"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CommunityPostCard } from "./CommunityPostCard"
import { useCommunityPosts, useInteractions } from "../hooks/useCommunity"
import type { User } from "@/features/profile/api/profile"
import { Search, Plus } from "lucide-react"

interface CommunityPostListProps {
  currentUser: User | null
  onSelectPost: (postId: string) => void
  onCreatePost: () => void
}

export function CommunityPostList({ currentUser, onSelectPost, onCreatePost }: CommunityPostListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const { posts, loading, error, withdrawPost, refresh } = useCommunityPosts({ category: selectedCategory })
  const { likePost, bookmarkPost } = useInteractions(currentUser?.id || "")

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

      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
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
      <div className="space-y-3">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">尚無貼文</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} onClick={() => onSelectPost(post.id)} className="cursor-pointer">
              <CommunityPostCard
                post={post}
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
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
