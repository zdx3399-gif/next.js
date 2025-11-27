import { createClient } from "@/lib/supabase/client"

export interface Resident {
  id?: string
  name: string
  room: string
  phone: string
  email: string
  role: "resident" | "committee" | "guard" | "admin"
  relationship?: "owner" | "household_member" | "tenant"
  created_at?: string
  updated_at?: string
}

const supabase = createClient()

export async function fetchResidents(): Promise<Resident[]> {
  const { data, error } = await supabase.from("residents").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching residents:", error)
    return []
  }
  return data || []
}

export async function createResident(
  resident: Omit<Resident, "id" | "created_at" | "updated_at">,
): Promise<Resident | null> {
  const { data, error } = await supabase.from("residents").insert([resident]).select().single()

  if (error) {
    console.error("Error creating resident:", error)
    return null
  }
  return data
}

export async function updateResident(id: string, updates: Partial<Resident>): Promise<Resident | null> {
  const { data, error } = await supabase.from("residents").update(updates).eq("id", id).select().single()

  if (error) {
    console.error("Error updating resident:", error)
    return null
  }
  return data
}

export async function deleteResident(id: string): Promise<boolean> {
  const { error } = await supabase.from("residents").delete().eq("id", id)

  if (error) {
    console.error("Error deleting resident:", error)
    return false
  }
  return true
}

export async function fetchResidentsByRoom(room: string): Promise<Resident[]> {
  const { data, error } = await supabase
    .from("residents")
    .select("*")
    .eq("room", room)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching residents by room:", error)
    return []
  }
  return data || []
}
