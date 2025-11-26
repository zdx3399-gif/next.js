import { getSupabaseClient } from "@/lib/supabase"

export interface Emergency {
  id?: number
  type: string
  note: string
  time?: string
  by: string
  created_at?: string
}

// 獲取緊急事件列表（管理員用）
export async function fetchEmergencies(): Promise<Emergency[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("emergencies").select("*").order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

// 送出緊急事件
export async function triggerEmergency(type: string, note: string, userName: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("emergencies").insert([
    {
      type,
      note,
      time: new Date().toISOString(),
      by: userName || "未知",
    },
  ])

  if (error) throw error
}

// 刪除緊急事件（管理員用）
export async function deleteEmergency(id: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("emergencies").delete().eq("id", id)
  if (error) throw error
}
