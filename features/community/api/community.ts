import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

export interface CommunityPost {
  id: string
  author_id: string
  author_name?: string
  category: "case" | "howto" | "opinion" | "alert" | "discussion" | "question" | "announcement" | "notice"
  display_mode: "anonymous" | "semi_anonymous" | "real_name"
  display_name: string | null
  title: string
  content: string
  structured_data: any
  status: "draft" | "published" | "pending" | "shadow" | "redacted" | "removed" | "deleted"
  ai_risk_level: "low" | "medium" | "high" | null
  ai_risk_reason: string | null
  ai_suggestions: any
  view_count: number
  like_count: number
  comment_count: number
  bookmark_count: number
  helpful_vote_count: number
  moderated_at: string | null
  moderated_by: string | null
  moderation_reason: string | null
  is_in_kms: boolean
  kms_card_id: string | null
  edited_at: string | null
  can_edit_until: string | null
  created_at: string
  updated_at: string
  is_anonymous?: boolean
  post_type?: string
  likes_count?: number
  comments_count?: number
}

export interface PostComment {
  id: string
  post_id: string
  author_id: string
  parent_comment_id: string | null
  content: string
  display_mode: "anonymous" | "semi_anonymous" | "real_name"
  display_name: string | null
  status: "published" | "removed" | "deleted"
  like_count: number
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  reporter_id: string
  target_type: "post" | "comment" | "user"
  target_id: string
  reason: "pii" | "defamation" | "harassment" | "misinformation" | "spam" | "hate_speech" | "other"
  description: string | null
  ai_assessment: "valid" | "invalid" | "needs_review" | null
  ai_assessment_reason: string | null
  status: "pending" | "reviewing" | "upheld" | "dismissed" | "spam"
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  action_taken: string | null
  created_at: string
  updated_at: string
}

export interface PostAttachment {
  id: string
  post_id: string
  file_type: "image" | "video" | "document"
  file_url: string
  file_name: string | null
  file_size: number | null
  visibility: "public" | "residents_only" | "admins_only"
  expires_at: string | null
  contains_pii: boolean
  created_at: string
}

export interface ModerationAppeal {
  id: string
  post_id: string
  author_id: string
  reason: string
  status: "pending" | "reviewing" | "restored" | "rejected" | "cancelled"
  review_note?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
}

function getCurrentOperator() {
  if (typeof window === "undefined") return { id: "", role: "unknown" }

  try {
    const raw = localStorage.getItem("currentUser")
    if (!raw) return { id: "", role: "unknown" }
    const parsed = JSON.parse(raw)
    return { id: parsed?.id || "", role: parsed?.role || "unknown" }
  } catch {
    return { id: "", role: "unknown" }
  }
}

export async function getCommunityPosts(filters?: {
  category?: string
  status?: string
  userId?: string
  limit?: number
  offset?: number
}): Promise<CommunityPost[]> {
  const supabase = getSupabaseClient()

  console.log("[v0] getCommunityPosts called, supabase available:", !!supabase)
  console.log("[v0] filters:", filters)

  if (!supabase) {
    console.log("[v0] Supabase client not available for getCommunityPosts")
    return []
  }

  let query = supabase.from("community_posts").select("*").order("created_at", { ascending: false })

  if (filters?.category) {
    query = query.eq("category", filters.category)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  } else {
    query = query.in("status", ["published", "redacted"])
  }
  if (filters?.userId) {
    query = query.eq("author_id", filters.userId)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
  }

  const { data, error } = await query

  console.log("[v0] getCommunityPosts result - data count:", data?.length || 0, "error:", error)
  if (data && data.length > 0) {
    console.log("[v0] First post sample:", {
      id: data[0].id,
      title: data[0].title,
      status: data[0].status,
      category: data[0].category,
    })
  }

  if (error) {
    console.error("[v0] Error fetching community posts:", error)
    return []
  }
  return (data || []) as CommunityPost[]
}

export async function getPostById(postId: string): Promise<CommunityPost | null> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    console.log("[v0] Supabase client not available for getPostById")
    return null
  }

  const { data, error } = await supabase.from("community_posts").select("*").eq("id", postId).single()

  if (error) {
    console.error("[v0] Error fetching post:", error)
    return null
  }

  // 增加瀏覽次數
  await supabase
    .from("community_posts")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", postId)

  return data as CommunityPost
}

export async function createPost(post: {
  author_id: string
  category: string
  display_mode: string
  display_name?: string
  title: string
  content: string
  structured_data?: any
}): Promise<CommunityPost | null> {
  console.log("[v0] createPost: 呼叫 API 進行 AI 審核...")

  const response = await fetch("/api/community/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error("[v0] createPost API error:", result.error)
    throw new Error(result.error || "發文失敗")
  }

  console.log("[v0] createPost 成功，AI 結果:", result.aiResult)

  // 如果 AI 建議需要審核，提示用戶
  if (result.aiResult?.needsReview) {
    console.log("[v0] 貼文需要人工審核，已加入審核隊列")
  }

  return result.data as CommunityPost
}

export async function updatePost(postId: string, updates: Partial<CommunityPost>): Promise<CommunityPost | null> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()

  if (!supabase) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_post",
        targetType: "post",
        targetId: postId,
        reason: "請先登入",
        additionalData: { module: "community", status: "blocked", error_code: "unauthenticated" },
      })
    }
    throw new Error("請先登入")
  }

  const { data: beforePost } = await supabase.from("community_posts").select("id,status,title").eq("id", postId).maybeSingle()

  const { data, error } = await supabase
    .from("community_posts")
    .update({ ...updates, edited_at: new Date().toISOString() })
    .eq("id", postId)
    .select()
    .single()

  if (error) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_post",
        targetType: "post",
        targetId: postId,
        reason: error.message,
        additionalData: { module: "community", status: "failed", error_code: error.message },
      })
    }
    throw new Error(error.message)
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "update_post",
      targetType: "post",
      targetId: postId,
      reason: data?.title || "更新貼文",
      beforeState: beforePost || undefined,
      afterState: { status: data?.status, title: data?.title },
      additionalData: { module: "community", status: "success" },
    })
  }

  return data as CommunityPost
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()

  if (!supabase) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_post",
        targetType: "post",
        targetId: postId,
        reason: "請先登入",
        additionalData: { module: "community", status: "blocked", error_code: "unauthenticated" },
      })
    }
    throw new Error("請先登入")
  }

  const { data: post } = await supabase.from("community_posts").select("author_id").eq("id", postId).single()

  if (!post || post.author_id !== userId) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_post",
        targetType: "post",
        targetId: postId,
        reason: "Unauthorized",
        additionalData: { module: "community", status: "blocked", error_code: "unauthorized" },
      })
    }
    throw new Error("Unauthorized")
  }

  const { error } = await supabase.from("community_posts").update({ status: "deleted" }).eq("id", postId)

  if (error) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_post",
        targetType: "post",
        targetId: postId,
        reason: error.message,
        additionalData: { module: "community", status: "failed", error_code: error.message },
      })
    }
    throw new Error(error.message)
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_post",
      targetType: "post",
      targetId: postId,
      reason: "刪除貼文",
      afterState: { status: "deleted" },
      additionalData: { module: "community", status: "success" },
    })
  }
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    console.log("[v0] Supabase client not available for getPostComments")
    return []
  }

  const { data, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .eq("status", "published")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching comments:", error)
    return []
  }
  return (data || []) as PostComment[]
}

export async function createComment(comment: {
  post_id: string
  author_id: string
  parent_comment_id?: string
  content: string
  display_mode: string
  display_name?: string
}): Promise<PostComment | null> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()

  if (!supabase) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_comment",
        targetType: "comment",
        targetId: comment.post_id,
        reason: "請先登入",
        additionalData: { module: "community", status: "blocked", error_code: "unauthenticated" },
      })
    }
    throw new Error("請先登入")
  }

  const { data, error } = await supabase.from("post_comments").insert([comment]).select().single()

  if (error) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_comment",
        targetType: "comment",
        targetId: comment.post_id,
        reason: error.message,
        additionalData: { module: "community", status: "failed", error_code: error.message },
      })
    }
    throw new Error(error.message)
  }

  try {
    await supabase.rpc("increment_comment_count", { post_id: comment.post_id })
  } catch (e) {
    console.error("[v0] Failed to increment comment count:", e)
  }

  if (operator.id && data?.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "create_comment",
      targetType: "comment",
      targetId: data.id,
      reason: "建立留言",
      afterState: { post_id: comment.post_id },
      additionalData: { module: "community", status: "success" },
    })
  }

  return data as PostComment
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()

  if (!supabase) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_comment",
        targetType: "comment",
        targetId: commentId,
        reason: "請先登入",
        additionalData: { module: "community", status: "blocked", error_code: "unauthenticated" },
      })
    }
    throw new Error("請先登入")
  }

  const { data: comment } = await supabase
    .from("post_comments")
    .select("author_id, post_id")
    .eq("id", commentId)
    .single()

  if (!comment || comment.author_id !== userId) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_comment",
        targetType: "comment",
        targetId: commentId,
        reason: "Unauthorized",
        additionalData: { module: "community", status: "blocked", error_code: "unauthorized" },
      })
    }
    throw new Error("Unauthorized")
  }

  const { error } = await supabase.from("post_comments").update({ status: "deleted" }).eq("id", commentId)

  if (error) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_comment",
        targetType: "comment",
        targetId: commentId,
        reason: error.message,
        additionalData: { module: "community", status: "failed", error_code: error.message },
      })
    }
    throw new Error(error.message)
  }

  try {
    await supabase.rpc("decrement_comment_count", { post_id: comment.post_id })
  } catch (e) {
    console.error("[v0] Failed to decrement comment count:", e)
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_comment",
      targetType: "comment",
      targetId: commentId,
      reason: "刪除留言",
      afterState: { status: "deleted" },
      additionalData: { module: "community", status: "success" },
    })
  }
}

export async function createReport(report: {
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  description?: string
}): Promise<Report | null> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()

  if (!supabase) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_report",
        targetType: "report",
        targetId: report.target_id,
        reason: "請先登入",
        additionalData: { module: "community", status: "blocked", error_code: "unauthenticated" },
      })
    }
    throw new Error("請先登入")
  }

  const { data, error } = await supabase.from("reports").insert([report]).select().single()

  if (error) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_report",
        targetType: "report",
        targetId: report.target_id,
        reason: error.message,
        additionalData: { module: "community", status: "failed", error_code: error.message },
      })
    }
    throw new Error(error.message)
  }

  if (operator.id && data?.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "create_report",
      targetType: "report",
      targetId: data.id,
      reason: report.reason,
      afterState: { target_type: report.target_type, target_id: report.target_id },
      additionalData: { module: "community", status: "success" },
    })
  }

  return data as Report
}

export async function getOwnModeratedPosts(userId: string): Promise<CommunityPost[]> {
  const supabase = getSupabaseClient()

  if (!supabase || !userId) {
    return []
  }

  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("author_id", userId)
    .in("status", ["removed", "shadow", "redacted"])
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching moderated posts:", error)
    return []
  }

  return (data || []) as CommunityPost[]
}

export async function submitModerationAppeal(params: {
  postId: string
  authorId: string
  reason: string
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch("/api/community/appeals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "申訴提交失敗")
  }

  return {
    success: true,
    message: payload?.message || "申訴已送出",
  }
}

export async function getUserModerationAppeals(authorId: string): Promise<ModerationAppeal[]> {
  if (!authorId) return []

  const res = await fetch(`/api/community/appeals?authorId=${encodeURIComponent(authorId)}`, {
    cache: "no-store",
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "讀取申訴紀錄失敗")
  }

  return Array.isArray(payload?.data) ? (payload.data as ModerationAppeal[]) : []
}

export async function getUserReports(userId: string): Promise<Report[]> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching reports:", error)
    return []
  }
  return (data || []) as Report[]
}

export async function togglePostInteraction(
  userId: string,
  targetType: "post" | "comment" | "knowledge_card",
  targetId: string,
  interactionType: "like" | "bookmark" | "helpful" | "not_helpful",
): Promise<boolean> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()

  if (!supabase) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "system_action",
        targetType: targetType === "post" ? "post" : targetType === "comment" ? "comment" : "knowledge_card",
        targetId,
        reason: "請先登入",
        additionalData: { module: "community", status: "blocked", error_code: "unauthenticated", interactionType },
      })
    }
    throw new Error("請先登入")
  }

  console.log("[v0] togglePostInteraction called:", { userId, targetType, targetId, interactionType })

  const { data: existing } = await supabase
    .from("user_interactions")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("interaction_type", interactionType)
    .single()

  if (existing) {
    await supabase
      .from("user_interactions")
      .delete()
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("interaction_type", interactionType)

    if (interactionType === "like" && targetType === "post") {
      const { data: post } = await supabase.from("community_posts").select("like_count").eq("id", targetId).single()

      if (post) {
        await supabase
          .from("community_posts")
          .update({ like_count: Math.max(0, (post.like_count || 0) - 1) })
          .eq("id", targetId)
      }
      console.log("[v0] Like removed, decremented count")
    }

    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "system_action",
        targetType: targetType === "post" ? "post" : targetType === "comment" ? "comment" : "knowledge_card",
        targetId,
        reason: "取消互動",
        afterState: { interactionType, active: false },
        additionalData: { module: "community", status: "success" },
      })
    }

    return false
  } else {
    const { error: insertError } = await supabase.from("user_interactions").insert([
      {
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        interaction_type: interactionType,
      },
    ])

    if (insertError) {
      console.error("[v0] Failed to insert interaction:", insertError)
      if (operator.id) {
        await createAuditLog({
          operatorId: operator.id,
          operatorRole: operator.role,
          actionType: "system_action",
          targetType: targetType === "post" ? "post" : targetType === "comment" ? "comment" : "knowledge_card",
          targetId,
          reason: insertError.message,
          additionalData: { module: "community", status: "failed", error_code: insertError.message, interactionType },
        })
      }
      throw new Error(insertError.message)
    }

    if (interactionType === "like" && targetType === "post") {
      const { data: post } = await supabase.from("community_posts").select("like_count").eq("id", targetId).single()

      if (post) {
        await supabase
          .from("community_posts")
          .update({ like_count: (post.like_count || 0) + 1 })
          .eq("id", targetId)
      }
      console.log("[v0] Like added, incremented count")
    }

    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "system_action",
        targetType: targetType === "post" ? "post" : targetType === "comment" ? "comment" : "knowledge_card",
        targetId,
        reason: "新增互動",
        afterState: { interactionType, active: true },
        additionalData: { module: "community", status: "success" },
      })
    }

    return true
  }
}

export async function getUserInteractions(userId: string, targetType?: string): Promise<any[]> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return []
  }

  let query = supabase.from("user_interactions").select("*").eq("user_id", userId)

  if (targetType) {
    query = query.eq("target_type", targetType)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error fetching interactions:", error)
    return []
  }
  return data || []
}

export async function getPostAttachments(postId: string): Promise<PostAttachment[]> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from("post_attachments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching attachments:", error)
    return []
  }
  return (data || []) as PostAttachment[]
}
