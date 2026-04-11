import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

export interface Emergency {
  id?: string
  type: string
  note: string
  time?: string
  status?: string
  source?: string
  reported_by_id?: string
  created_by?: string
  reported_by_name?: string
  location?: string
  description?: string
  created_at?: string
  by?: string
}

export interface TriggerEmergencyResult {
  iotSent: boolean
  lineSent: number
  lineFailed: number
  iotError?: string
  lineError?: string
  requiresCommitteeReview?: boolean
  incidentStatus?: string
}

export interface EmergencyUpdatePayload {
  type?: string
  note?: string
}

export type EmergencyReviewAction = "approve" | "reject"

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

export async function fetchEmergencies(filters?: { reportedById?: string }): Promise<Emergency[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .from("emergency_incidents")
    .select(`
      *,
      reporter:profiles!emergency_incidents_reporter_profile_id_fkey(name)
    `)
    .order("created_at", { ascending: false })

  if (filters?.reportedById) {
    query = query.eq("reporter_profile_id", filters.reportedById)
  }

  const { data, error } = await query

  if (error) {
    // Fallback: 沒有 JOIN
    let fallbackQuery = supabase
      .from("emergency_incidents")
      .select("*")
      .order("created_at", { ascending: false })
    if (filters?.reportedById) {
      fallbackQuery = fallbackQuery.eq("reporter_profile_id", filters.reportedById)
    }
    const { data: fallbackData } = await fallbackQuery
    return (fallbackData || []).map((item: any) => ({
      id: item.id,
      type: item.event_type || "未分類",
      note: item.description || "",
      description: item.description || undefined,
      location: item.location || undefined,
      time: item.created_at || item.updated_at || undefined,
      source: item.source || undefined,
      status: item.status || undefined,
      reported_by_id: item.reporter_profile_id || undefined,
      reported_by_name: "未知",
      by: "未知",
      created_at: item.created_at || undefined,
    }))
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    type: item.event_type || "未分類",
    note: item.description || "",
    description: item.description || undefined,
    location: item.location || undefined,
    time: item.created_at || item.updated_at || undefined,
    source: item.source || undefined,
    status: item.status || undefined,
    reported_by_id: item.reporter_profile_id || undefined,
    reported_by_name: item.reporter?.name || "未知",
    by: item.reporter?.name || "未知",
    created_at: item.created_at || undefined,
  }))
}

export async function triggerEmergency(
  type: string,
  note: string,
  userId?: string,
  userName?: string,
  location?: string,
  description?: string,
): Promise<TriggerEmergencyResult> {
  const res = await fetch("/api/emergency-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      note,
      location,
      description,
      reported_by_id: userId || null,
      reported_by_name: userName || "未知",
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `緊急事件送出失敗（${res.status}）`)
  }

  return {
    iotSent: !!data?.iotSent,
    lineSent: Number(data?.lineSent || 0),
    lineFailed: Number(data?.lineFailed || 0),
    iotError: data?.iotError,
    lineError: data?.lineError,
    requiresCommitteeReview: !!data?.requiresCommitteeReview,
    incidentStatus: data?.incidentStatus,
  }
}

export async function deleteEmergency(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  const { error } = await supabase.from("emergency_incidents").delete().eq("id", id)
  if (error) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_emergency",
        targetType: "emergency",
        targetId: id,
        reason: error.message || "刪除緊急事件失敗",
        additionalData: { module: "emergency", status: "failed", error_code: error.message },
      })
    }
    throw error
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_emergency",
      targetType: "emergency",
      targetId: id,
      reason: "刪除緊急事件",
      additionalData: { module: "emergency", status: "success" },
    })
  }
}

export async function editEmergency(id: string, payload: EmergencyUpdatePayload): Promise<void> {
  const updatePayload: Record<string, string> = {}
  if (typeof payload.type === "string") updatePayload.event_type = payload.type
  if (typeof payload.note === "string") updatePayload.description = payload.note

  const operator = getCurrentOperator()

  if (!updatePayload.event_type && !updatePayload.description) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_emergency",
        targetType: "emergency",
        targetId: id,
        reason: "更新緊急事件缺少變更內容",
        additionalData: { module: "emergency", status: "blocked", error_code: "empty_update_payload" },
      })
    }
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from("emergency_incidents").update(updatePayload).eq("id", id)
  if (error) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_emergency",
        targetType: "emergency",
        targetId: id,
        reason: error.message || "更新緊急事件失敗",
        afterState: updatePayload,
        additionalData: { module: "emergency", status: "failed", error_code: error.message },
      })
    }
    throw error
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "update_emergency",
      targetType: "emergency",
      targetId: id,
      reason: "更新緊急事件",
      afterState: updatePayload,
      additionalData: { module: "emergency", status: "success" },
    })
  }
}

export async function reviewEmergency(id: string, action: EmergencyReviewAction, reviewerId: string): Promise<void> {
  const res = await fetch("/api/emergency-incidents/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidentId: id, action, reviewerId }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `審核失敗（${res.status}）`)
  }

  if (action === "approve") {
    const iotInfo = data?.iotSent ? "IOT 已觸發" : `IOT 未觸發（${data?.iotError || "未知"}）`
    const lineInfo = `LINE 已送 ${Number(data?.lineSent || 0)} 人${Number(data?.lineFailed || 0) > 0 ? `，失敗 ${Number(data?.lineFailed || 0)} 人` : ""}`
    alert(`審核通過並已啟動正式通知\n${iotInfo}\n${lineInfo}`)
  }
}

export function getReportedByName(emergency: Emergency): string {
  return emergency.reported_by_name || "未知"
}
