import { getSupabaseClient } from "@/lib/supabase"
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

// 取得解密後的作者資訊
export async function getDecryptedAuthorInfo(requestId: string, viewerId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  // 檢查申請狀態
  const { data: request } = await supabase
    .from("decryption_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (!request) throw new Error("找不到此申請")
  if (request.status !== "fully_approved") throw new Error("此申請尚未完全核准")
  if (new Date(request.accessible_until) < new Date()) throw new Error("解密資訊已過期")

  // 解析發文/留言者的 profile ID
  // 優先從 target_id 直接查原始貼文/留言，確保資料正確
  // 若查不到則 fallback 到 decrypted_author_id（核准時預存）
  let authorProfileId: string | null = null

  if (request.target_type === "post") {
    const { data: post } = await supabase
      .from("community_posts")
      .select("author_id")
      .eq("id", request.target_id)
      .single()
    authorProfileId = post?.author_id ?? null
  } else if (request.target_type === "comment") {
    const { data: comment } = await supabase
      .from("post_comments")
      .select("author_id")
      .eq("id", request.target_id)
      .single()
    authorProfileId = comment?.author_id ?? null
  }

  // fallback：若 RLS 擋住或貼文已刪除，改用核准時記錄的 decrypted_author_id
  if (!authorProfileId) {
    authorProfileId = request.decrypted_author_id ?? null
  }

  if (!authorProfileId) throw new Error("無法解析發文者身份，貼文可能已刪除")

  // 取得作者 profile
  const { data: author } = await supabase
    .from("profiles")
    .select("id, name, unit_id, email, phone")
    .eq("id", authorProfileId)
    .single()

  if (!author) throw new Error("找不到發文者的個人資料")

  // 取得戶號（unit_number 在 units 表）
  let unitNumber: string | null = null
  if (author.unit_id) {
    const { data: unit } = await supabase
      .from("units")
      .select("unit_number, unit_code")
      .eq("id", author.unit_id)
      .single()
    unitNumber = unit?.unit_number || unit?.unit_code || null
  }

  await createAuditLog({
    operatorId: viewerId,
    operatorRole: "admin",
    actionType: "decryption_viewed",
    targetType: "decryption_request",
    targetId: requestId,
    reason: "查看解密資訊",
    afterState: { viewed_at: new Date().toISOString() },
    additionalData: { module: "decryption", status: "success" },
  })

  return {
    id: author.id,
    full_name: author.name,
    unit_number: unitNumber,
    email: author.email,
    phone: author.phone,
  }
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
