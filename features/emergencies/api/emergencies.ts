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
}

export async function fetchEmergencies(): Promise<Emergency[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("emergencies")
    .select(`
      *,
      reporter:profiles!emergencies_reported_by_id_fkey(name)
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
    reported_by_name: item.reporter?.name || "未知",
  }))
}

export async function triggerEmergency(type: string, note: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("emergencies").insert([
    {
      type,
      note,
      time: new Date().toISOString(),
      reported_by_id: userId,
      created_by: userId,
    },
  ])

  if (error) throw error
}

export async function deleteEmergency(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("emergencies").delete().eq("id", id)
  if (error) throw error
}

export function getReportedByName(emergency: Emergency): string {
  return emergency.reported_by_name || "未知"
}
