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
}

export interface EmergencyUpdatePayload {
  type?: string
  note?: string
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

export async function fetchEmergencies(filters?: { reportedById?: string }): Promise<Emergency[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []
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
  }
}

export async function deleteEmergency(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client unavailable")
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

  if (!updatePayload.type && !updatePayload.note) {
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
  if (!supabase) throw new Error("Supabase client unavailable")
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

export function getReportedByName(emergency: Emergency): string {
  return emergency.reported_by_name || "未知"
}
