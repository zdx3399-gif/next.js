"use client"

import { useState, useEffect } from "react"
import {
  getCommunityPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getPostComments,
  createComment,
  deleteComment,
  createReport,
  getUserReports,
  togglePostInteraction,
  getUserInteractions,
  getPostAttachments,
  type CommunityPost,
  type PostComment,
  type Report,
  type PostAttachment,
} from "../api/community"

interface AIResult {
  aiProvider?: string
  riskLevel: string
  risks?: string[]
  suggestions?: string[]
  needsReview?: boolean
  reasoning?: string
}

interface CreatePostResult {
  post: CommunityPost | null
  aiResult: AIResult | null
}

export function useCommunityPosts(filters?: {
  category?: string
  status?: string
  userId?: string
  limit?: number
  offset?: number
}) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPosts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCommunityPosts(filters)
      setPosts(data)
    } catch (err: any) {
      console.error("[v0] Error loading posts:", err)
      setError(err.message || "載入失敗")
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [filters?.category, filters?.status, filters?.userId])

  const handleCreatePost = async (post: Parameters<typeof createPost>[0]): Promise<CreatePostResult> => {
    const result = (await createPost(post)) as unknown as CreatePostResult
    // 只有在貼文狀態是 published 時才加入列表
    if (result && result.post && result.post.status === "published") {
      setPosts((prev) => [result.post!, ...prev])
    }
    return result
  }

  const handleUpdatePost = async (postId: string, updates: Partial<CommunityPost>) => {
    try {
      const updatedPost = await updatePost(postId, updates)
      if (updatedPost) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? updatedPost : p)))
      }
      return updatedPost
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const handleDeletePost = async (postId: string, userId: string) => {
    try {
      await deletePost(postId, userId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const handleWithdrawPost = async (postId: string, userId: string) => {
    try {
      const updatedPost = await updatePost(postId, { status: "deleted" })
      if (updatedPost) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      }
      return true
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return {
    posts,
    loading,
    error,
    refresh: loadPosts,
    createPost: handleCreatePost,
    updatePost: handleUpdatePost,
    deletePost: handleDeletePost,
    withdrawPost: handleWithdrawPost,
  }
}

export function usePostDetail(postId: string) {
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [attachments, setAttachments] = useState<PostAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPostDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const [postData, commentsData, attachmentsData] = await Promise.all([
        getPostById(postId),
        getPostComments(postId),
        getPostAttachments(postId),
      ])
      setPost(postData)
      setComments(commentsData)
      setAttachments(attachmentsData)
    } catch (err: any) {
      console.error("[v0] Error loading post detail:", err)
      setError(err.message || "載入失敗")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (postId) {
      loadPostDetail()
    }
  }, [postId])

  const handleAddComment = async (comment: Parameters<typeof createComment>[0]) => {
    try {
      const newComment = await createComment(comment)
      if (newComment) {
        setComments((prev) => [...prev, newComment])
      }
      return newComment
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const handleDeleteComment = async (commentId: string, userId: string) => {
    try {
      await deleteComment(commentId, userId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return {
    post,
    comments,
    attachments,
    loading,
    error,
    refresh: loadPostDetail,
    addComment: handleAddComment,
    deleteComment: handleDeleteComment,
  }
}

export function useReports(userId: string) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReports = async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getUserReports(userId)
      setReports(data)
    } catch (err: any) {
      console.error("[v0] Error loading reports:", err)
      setError(err.message || "載入失敗")
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [userId])

  const handleCreateReport = async (report: Parameters<typeof createReport>[0]) => {
    try {
      const newReport = await createReport(report)
      if (newReport) {
        setReports((prev) => [newReport, ...prev])
      }
      return newReport
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return {
    reports,
    loading,
    error,
    refresh: loadReports,
    createReport: handleCreateReport,
  }
}

export function useUserInteractions(userId: string, targetType?: string) {
  const [interactions, setInteractions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      getUserInteractions(userId, targetType)
        .then((data) => {
          setInteractions(data || [])
        })
        .catch((err) => {
          console.error("[v0] Error loading interactions:", err)
          setInteractions([])
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [userId, targetType])

  const handleToggleInteraction = async (
    targetType: "post" | "comment" | "knowledge_card",
    targetId: string,
    interactionType: "like" | "bookmark" | "helpful" | "not_helpful",
  ) => {
    try {
      const isAdded = await togglePostInteraction(userId, targetType, targetId, interactionType)

      if (isAdded) {
        setInteractions((prev) => [
          ...prev,
          { user_id: userId, target_type: targetType, target_id: targetId, interaction_type: interactionType },
        ])
      } else {
        setInteractions((prev) =>
          prev.filter(
            (i) =>
              !(i.target_type === targetType && i.target_id === targetId && i.interaction_type === interactionType),
          ),
        )
      }

      return isAdded
    } catch (err: any) {
      console.error("[v0] Error toggling interaction:", err)
      throw new Error(err.message)
    }
  }

  return {
    interactions,
    loading,
    toggleInteraction: handleToggleInteraction,
    hasInteraction: (targetType: string, targetId: string, interactionType: string) =>
      interactions.some(
        (i) => i.target_type === targetType && i.target_id === targetId && i.interaction_type === interactionType,
      ),
  }
}

export function useInteractions(userId: string) {
  const { interactions, loading, toggleInteraction, hasInteraction } = useUserInteractions(userId)

  const likePost = async (postId: string) => {
    if (!userId) return false
    return await toggleInteraction("post", postId, "like")
  }

  const bookmarkPost = async (postId: string) => {
    if (!userId) return false
    return await toggleInteraction("post", postId, "bookmark")
  }

  const likeComment = async (commentId: string) => {
    if (!userId) return false
    return await toggleInteraction("comment", commentId, "like")
  }

  const isPostLiked = (postId: string) => hasInteraction("post", postId, "like")
  const isPostBookmarked = (postId: string) => hasInteraction("post", postId, "bookmark")
  const isCommentLiked = (commentId: string) => hasInteraction("comment", commentId, "like")

  return {
    interactions,
    loading,
    likePost,
    bookmarkPost,
    likeComment,
    isPostLiked,
    isPostBookmarked,
    isCommentLiked,
  }
}
