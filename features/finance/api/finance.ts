import { getSupabaseClient } from "@/lib/supabase"

export interface FinanceRecord {
  id: string
  room: string
  amount: number
  due: string
  invoice?: string | null
  paid: boolean
  note?: string | null
  created_at?: string
}

export async function fetchAllFinanceRecords(): Promise<FinanceRecord[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("fees").select("*").order("due", { ascending: false })

  if (error) {
    console.error("Error fetching finance records:", error)
    return []
  }

  return data || []
}

export async function fetchUserFinanceRecords(userRoom: string): Promise<FinanceRecord[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("fees")
    .select("*")
    .eq("room", userRoom)
    .order("due", { ascending: false })

  if (error) {
    console.error("Error fetching user finance records:", error)
    return []
  }

  return data || []
}

export async function createFinanceRecord(
  record: Omit<FinanceRecord, "id" | "created_at">,
): Promise<{ success: boolean; error?: string; data?: FinanceRecord }> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.from("fees").insert([record]).select().single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function updateFinanceRecord(
  id: string,
  updates: Partial<FinanceRecord>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("fees").update(updates).eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteFinanceRecord(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("fees").delete().eq("id", id)

  if (error) {
    console.error("Error deleting finance record:", error)
    return false
  }

  return true
}
