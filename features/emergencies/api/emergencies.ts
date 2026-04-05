import { getSupabaseClient } from "@/lib/supabase"

export interface Emergency {
  id?: string
  type: string
  note: string
  time?: string
  reported_by_id?: string
  created_by?: string
  reported_by_name?: string
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

export async function fetchEmergencies(): Promise<Emergency[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("emergencies")
    .select(`
      *,
      reporter:profiles!emergencies_reported_by_id_fkey(name),
      creator:profiles!emergencies_created_by_fkey(name)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    // Fallback: 沒有 JOIN
    const { data: fallbackData } = await supabase
      .from("emergencies")
      .select("*")
      .order("created_at", { ascending: false })
    return fallbackData || []
  }

  return (data || []).map((item: any) => ({
    ...item,
    reported_by_name: item.reporter?.name || item.creator?.name || "未知",
    by: item.reporter?.name || item.creator?.name || "未知",
  }))
}

export async function triggerEmergency(
  type: string,
  note: string,
  userId?: string,
  userName?: string,
): Promise<TriggerEmergencyResult> {
  const res = await fetch("/api/emergency-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      note,
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
  const { error } = await supabase.from("emergencies").delete().eq("id", id)
  if (error) throw error
}

export async function editEmergency(id: string, payload: EmergencyUpdatePayload): Promise<void> {
  const updatePayload: EmergencyUpdatePayload = {}
  if (typeof payload.type === "string") updatePayload.type = payload.type
  if (typeof payload.note === "string") updatePayload.note = payload.note

  if (!updatePayload.type && !updatePayload.note) return

  const supabase = getSupabaseClient()
  const { error } = await supabase.from("emergencies").update(updatePayload).eq("id", id)
  if (error) throw error
}

export function getReportedByName(emergency: Emergency): string {
  return emergency.reported_by_name || "未知"
}
