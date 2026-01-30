"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { usePostDetail, useUserInteractions } from "../hooks/useCommunity"
import type { User } from "@/features/profile/api/profile"

interface PostDetailViewProps {
  postId: string
  currentUser: User | null
  onBack: () => void
  onReport: (targetType: string, targetId: string) => void
}

export function PostDetailView({ postId, currentUser, onBack, onReport }: PostDetailViewProps) {
  const { post, comments, loading, error, addComment } = usePostDetail(postId)
  const { interactions, toggleInteraction, hasInteraction } = useUserInteractions(currentUser?.id || "", "post")
  const [commentText, setCommentText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleLike = async () => {
    if (!currentUser) {
      alert("請先登入")
      return
    }
    try {
      await toggleInteraction("post", postId, "like")
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleBookmark = async () => {
    if (!currentUser) {
      alert("請先登入")
      return
    }
    try {
      await toggleInteraction("post", postId, "bookmark")
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleHelpful = async () => {
    if (!currentUser) {
      alert("請先登入")
      return
    }
    try {
      await toggleInteraction("post", postId, "helpful")
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleSubmitComment = async () => {
    if (!currentUser) {
      alert("請先登入")
      return
    }
    if (!commentText.trim()) {
      alert("請輸入留言內容")
      return
    }

    setSubmitting(true)
    try {
      await addComment({
        post_id: postId,
        author_id: currentUser.id,
        content: commentText.trim(),
        display_mode: "semi_anonymous",
      })
      setCommentText("")
    } catch (error: any) {
      alert(`留言失敗: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="material-icons animate-spin text-4xl text-[var(--theme-accent)]">refresh</span>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="text-center py-12">
        <span className="material-icons text-4xl mb-2 text-red-500">error</span>
        <p className="text-red-500">載入失敗: {error}</p>
        <Button onClick={onBack} className="mt-4">
          返回列表
        </Button>
      </div>
    )
  }

  const categoryLabels: Record<string, string> = {
    case: "案例分享",
    howto: "解法教學",
    opinion: "意見討論",
    alert: "警示爆料",
  }

  const isLiked = hasInteraction("post", postId, "like")
  const isBookmarked = hasInteraction("post", postId, "bookmark")
  const isHelpful = hasInteraction("post", postId, "helpful")

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Button variant="outline" onClick={onBack} className="flex gap-2 items-center bg-transparent">
        <span className="material-icons">arrow_back</span>
        返回列表
      </Button>

      {/* Post Content */}
      <Card className="p-6">
        <div className="flex gap-2 items-center mb-4 flex-wrap">
          <Badge className="bg-blue-500/20 text-blue-600">{categoryLabels[post.category]}</Badge>
          {post.status !== "published" && <Badge variant="outline">{post.status}</Badge>}
          {post.display_mode === "anonymous" && (
            <span className="material-icons text-sm text-gray-500">visibility_off</span>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-4 text-[var(--theme-text-primary)]">{post.title}</h1>

        <div className="flex gap-4 items-center text-sm text-[var(--theme-text-secondary)] mb-6">
          <span className="flex gap-1 items-center">
            <span className="material-icons text-sm">person</span>
            {post.display_name || "住戶"}
          </span>
          <span className="flex gap-1 items-center">
            <span className="material-icons text-sm">schedule</span>
            {new Date(post.created_at).toLocaleString("zh-TW")}
          </span>
          <span className="flex gap-1 items-center">
            <span className="material-icons text-sm">visibility</span>
            {post.view_count} 次瀏覽
          </span>
        </div>

        <div className="prose max-w-none mb-6">
          <p className="whitespace-pre-wrap text-[var(--theme-text-primary)]">{post.content}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-center border-t pt-4">
          <Button
            variant={isLiked ? "default" : "outline"}
            size="sm"
            onClick={handleLike}
            className="flex gap-1 items-center"
          >
            <span className="material-icons text-sm">{isLiked ? "thumb_up" : "thumb_up_off_alt"}</span>
            按讚 {post.like_count > 0 && `(${post.like_count})`}
          </Button>

          <Button
            variant={isBookmarked ? "default" : "outline"}
            size="sm"
            onClick={handleBookmark}
            className="flex gap-1 items-center"
          >
            <span className="material-icons text-sm">{isBookmarked ? "bookmark" : "bookmark_border"}</span>
            收藏
          </Button>

          <Button
            variant={isHelpful ? "default" : "outline"}
            size="sm"
            onClick={handleHelpful}
            className="flex gap-1 items-center"
          >
            <span className="material-icons text-sm">done</span>
            有幫助 {post.helpful_vote_count > 0 && `(${post.helpful_vote_count})`}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onReport("post", post.id)}
            className="flex gap-1 items-center ml-auto"
          >
            <span className="material-icons text-sm">flag</span>
            檢舉
          </Button>
        </div>
      </Card>

      {/* Comments Section */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex gap-2 items-center text-[var(--theme-text-primary)]">
          <span className="material-icons">comment</span>
          留言 ({comments.length})
        </h2>

        {/* Add Comment */}
        {currentUser && (
          <div className="mb-6">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="輸入您的留言..."
              rows={3}
              className="mb-2"
            />
            <Button onClick={handleSubmitComment} disabled={submitting} className="flex gap-2 items-center">
              <span className="material-icons text-sm">send</span>
              {submitting ? "送出中..." : "送出留言"}
            </Button>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-center text-[var(--theme-text-secondary)] py-8">尚無留言</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border-l-2 border-[var(--theme-border)] pl-4 py-2">
                <div className="flex gap-2 items-center mb-2">
                  <span className="text-sm font-medium text-[var(--theme-text-primary)]">
                    {comment.display_name || "住戶"}
                  </span>
                  <span className="text-xs text-[var(--theme-text-secondary)]">
                    {new Date(comment.created_at).toLocaleString("zh-TW")}
                  </span>
                </div>
                <p className="text-sm text-[var(--theme-text-secondary)] mb-2">{comment.content}</p>
                <div className="flex gap-2 items-center">
                  <Button variant="ghost" size="sm" className="flex gap-1 items-center h-6 text-xs">
                    <span className="material-icons text-xs">thumb_up_off_alt</span>
                    {comment.like_count > 0 && comment.like_count}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReport("comment", comment.id)}
                    className="flex gap-1 items-center h-6 text-xs"
                  >
                    <span className="material-icons text-xs">flag</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
