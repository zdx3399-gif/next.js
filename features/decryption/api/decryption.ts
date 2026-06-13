import { getCurrentTenant, getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

export interface DecryptionRequest {
  id: string
  target_type: "post" | "comment"
  target_id: string
  reason: string
  trigger_condition?: "multiple_reports" | "serious_violation" | "legal_request"
  requested_by: string
  admin_approved_by?: string
  admin_approved_at?: string
  admin_approval_notes?: string
  committee_approved_by?: string
  committee_approved_at?: string
  committee_approval_notes?: string
  status: "pending" | "admin_approved" | "committee_approved" | "fully_approved" | "rejected"
  decrypted_author_id?: string
  decrypted_at?: string
  accessible_until?: string
  created_at: string
}

export async function createDecryptionRequest(data: {
  requestedBy: string
  targetType: "post" | "comment"
  targetId: string
  reason: string
  triggerCondition?: "multiple_reports" | "serious_violation" | "legal_request"
}): Promise<DecryptionRequest | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: result, error } = await supabase
    .from("decryption_requests")
    .insert({
      requested_by: data.requestedBy,
      target_type: data.targetType,
      target_id: data.targetId,
      reason: data.reason,
      trigger_condition: data.triggerCondition,
      status: "pending",
    })
    .select()
    .single()

  if (error) throw error
  return result
}

export async function getDecryptionRequests(filters?: {
  status?: string | string[]
  requestedBy?: string
}): Promise<DecryptionRequest[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  let query = supabase.from("decryption_requests").select("*").order("created_at", { ascending: false })

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status)
    } else {
      query = query.eq("status", filters.status)
    }
  }
  if (filters?.requestedBy) {
    query = query.eq("requested_by", filters.requestedBy)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// 管委會審核（第一層）
export async function committeeReviewDecryptionRequest(
  requestId: string,
  data: {
    committeeId: string
    approved: boolean
    notes?: string
  },
): Promise<DecryptionRequest | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const updateData = data.approved
    ? {
        status: "committee_approved",
        committee_approved_by: data.committeeId,
        committee_approved_at: new Date().toISOString(),
        committee_approval_notes: data.notes,
      }
    : {
        status: "rejected",
        committee_approved_by: data.committeeId,
        committee_approved_at: new Date().toISOString(),
        committee_approval_notes: data.notes,
      }

  const { data: result, error } = await supabase
    .from("decryption_requests")
    .update(updateData)
    .eq("id", requestId)
    .select()
    .single()

  if (error) throw error

  await createAuditLog({
    operatorId: data.committeeId,
    operatorRole: "committee",
    actionType: data.approved ? "decryption_committee_approved" : "decryption_rejected",
    targetType: "decryption_request",
    targetId: requestId,
    reason: data.notes || (data.approved ? "管委會初審通過" : "管委會拒絕"),
    afterState: updateData,
    additionalData: { module: "decryption", status: "success" },
  })

  return result
}

// 系統管理員覆核（第二層）
export async function adminReviewDecryptionRequest(
  requestId: string,
  data: {
    adminId: string
    approved: boolean
    notes?: string
  },
): Promise<DecryptionRequest | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  // 先獲取申請資訊
  const { data: request } = await supabase
    .from("decryption_requests")
    .select("*, target_type, target_id")
    .eq("id", requestId)
    .single()

  if (!request || request.status !== "committee_approved") {
    throw new Error("此申請尚未經過管委會初審通過")
  }

  let updateData: any = {
    admin_approved_by: data.adminId,
    admin_approved_at: new Date().toISOString(),
    admin_approval_notes: data.notes,
  }

  if (data.approved) {
    // 獲取原始作者資訊
    let authorId = null
    if (request.target_type === "post") {
      const { data: post } = await supabase
        .from("community_posts")
        .select("author_id")
        .eq("id", request.target_id)
        .single()
      authorId = post?.author_id
    } else if (request.target_type === "comment") {
      const { data: comment } = await supabase
        .from("post_comments")
        .select("author_id")
        .eq("id", request.target_id)
        .single()
      authorId = comment?.author_id
    }

    updateData = {
      ...updateData,
      status: "fully_approved",
      decrypted_author_id: authorId,
      decrypted_at: new Date().toISOString(),
      accessible_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天後過期
    }
  } else {
    updateData.status = "rejected"
  }

  const { data: result, error } = await supabase
    .from("decryption_requests")
    .update(updateData)
    .eq("id", requestId)
    .select()
    .single()

  if (error) throw error

  await createAuditLog({
    operatorId: data.adminId,
    operatorRole: "admin",
    actionType: data.approved ? "decryption_fully_approved" : "decryption_rejected",
    targetType: "decryption_request",
    targetId: requestId,
    reason: data.notes || (data.approved ? "系統管理員覆核通過" : "系統管理員拒絕"),
    afterState: updateData,
    additionalData: { module: "decryption", status: "success" },
  })

  return result
}

// 取得解密後的作者資訊（透過 server-side API 繞過 RLS）
export async function getDecryptedAuthorInfo(requestId: string, viewerId: string, viewerRole: "admin" | "committee" = "committee") {
  let tenantId: "tenant_a" | "tenant_b" = "tenant_a"
  try {
    tenantId = getCurrentTenant()
  } catch {
    tenantId = "tenant_a"
  }
  const response = await fetch("/api/decryption/author-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, viewerId, viewerRole, tenantId }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "請求失敗" }))
    throw new Error(err.error || "無法取得作者資訊")
  }

  return response.json()
}

export async function getAuditLogs(filters?: {
  actorId?: string
  targetType?: string
  action?: string
  startDate?: string
  endDate?: string
}) {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false })

  if (filters?.actorId) {
    query = query.eq("operator_id", filters.actorId)
  }
  if (filters?.targetType) {
    query = query.eq("target_type", filters.targetType)
  }
  if (filters?.action) {
    query = query.eq("action_type", filters.action)
  }
  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
