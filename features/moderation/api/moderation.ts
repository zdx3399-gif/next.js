import { getSupabaseClient } from "@/lib/supabase"

export interface ModerationQueueItem {
  id: string
  item_type: "post" | "comment" | "report"
  item_id: string
  priority: "low" | "medium" | "high" | "urgent"
  ai_risk_summary: string | null
  ai_highlighted_content: any
  ai_suggested_action: string | null
  due_at: string | null
  overdue: boolean
  status: "pending" | "in_review" | "resolved"
  assigned_to: string | null
  resolved_at: string | null
  resolution: string | null
  created_at: string
  updated_at: string
}

export async function getModerationQueue(filters?: { status?: string; priority?: string; assignedTo?: string }) {
  const supabase = getSupabaseClient()
  let query = supabase
    .from("moderation_queue")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  } else {
    query = query.in("status", ["pending", "in_review"])
  }

  if (filters?.priority) {
    query = query.eq("priority", filters.priority)
  }

  if (filters?.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo)
  }

  const { data, error } = await query

  if (error) throw error
  return data as ModerationQueueItem[]
}

export async function getModerationItemDetail(itemId: string) {
  const supabase = getSupabaseClient()
  const { data: queueItem, error } = await supabase.from("moderation_queue").select("*").eq("id", itemId).single()

  if (error) throw error

  // 根據 item_type 獲取實際內容
  let content = null
  if (queueItem.item_type === "post") {
    const { data } = await supabase.from("community_posts").select("*").eq("id", queueItem.item_id).single()
    content = data
  } else if (queueItem.item_type === "comment") {
    const { data } = await supabase.from("post_comments").select("*").eq("id", queueItem.item_id).single()
    content = data
  } else if (queueItem.item_type === "report") {
    const { data } = await supabase.from("reports").select("*").eq("id", queueItem.item_id).single()
    content = data
  }

  return { queueItem: queueItem as ModerationQueueItem, content }
}

export async function assignModerationItem(itemId: string, userId: string) {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from("moderation_queue")
    .update({
      assigned_to: userId,
      status: "in_review",
    })
    .eq("id", itemId)
    .select()
    .single()

  if (error) throw error
  return data as ModerationQueueItem
}

export async function resolveModerationItem(
  itemId: string,
  resolution: {
    action: "approve" | "redact" | "remove" | "reject_report"
    reason: string
    redacted_content?: string
  },
  userId: string,
) {
  const supabase = getSupabaseClient()

  // 獲取審核項目
  const { data: queueItem } = await supabase.from("moderation_queue").select("*").eq("id", itemId).single()

  if (!queueItem) throw new Error("Moderation item not found")

  // 根據動作更新內容
  if (queueItem.item_type === "post") {
    if (resolution.action === "approve") {
      await supabase.from("community_posts").update({ status: "published" }).eq("id", queueItem.item_id)
    } else if (resolution.action === "redact") {
      await supabase
        .from("community_posts")
        .update({
          status: "redacted",
          content: resolution.redacted_content || "",
          moderated_at: new Date().toISOString(),
          moderated_by: userId,
          moderation_reason: resolution.reason,
        })
        .eq("id", queueItem.item_id)
    } else if (resolution.action === "remove") {
      await supabase
        .from("community_posts")
        .update({
          status: "removed",
          moderated_at: new Date().toISOString(),
          moderated_by: userId,
          moderation_reason: resolution.reason,
        })
        .eq("id", queueItem.item_id)
    }
  } else if (queueItem.item_type === "comment") {
    if (resolution.action === "remove") {
      await supabase.from("post_comments").update({ status: "removed" }).eq("id", queueItem.item_id)
    }
  } else if (queueItem.item_type === "report") {
    if (resolution.action === "approve") {
      await supabase
        .from("reports")
        .update({
          status: "upheld",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          review_notes: resolution.reason,
        })
        .eq("id", queueItem.item_id)
    } else if (resolution.action === "reject_report") {
      await supabase
        .from("reports")
        .update({
          status: "dismissed",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          review_notes: resolution.reason,
        })
        .eq("id", queueItem.item_id)
    }
  }

  // 更新審核隊列狀態
  const { data, error } = await supabase
    .from("moderation_queue")
    .update({
      status: "resolved",
      resolution: JSON.stringify(resolution),
      resolved_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select()
    .single()

  if (error) throw error

  // 記錄稽核日誌
  await supabase.from("audit_logs").insert([
    {
      operator_id: userId,
      operator_role: "committee",
      action_type: resolution.action,
      target_type: queueItem.item_type,
      target_id: queueItem.item_id,
      reason: resolution.reason,
      additional_data: resolution,
      related_request_id: itemId,
    },
  ])

  return data as ModerationQueueItem
}

export async function getReportsForTarget(targetType: string, targetId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}
