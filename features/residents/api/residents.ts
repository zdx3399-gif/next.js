import { createClient } from "@/lib/supabase/client"

export interface Resident {
  id?: number
  name: string
  room: string
  phone: string
  email: string
  role: "resident" | "committee" | "guard" | "admin"
  created_at?: string
}

const supabase = createClient()

export async function fetchResidents(): Promise<Resident[]> {
  const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching residents:", error)
    return []
  }
  return data || []
}

export async function createResident(resident: Omit<Resident, "id" | "created_at">): Promise<Resident | null> {
  const { data, error } = await supabase.from("users").insert([resident]).select().single()

  if (error) {
    console.error("Error creating resident:", error)
    return null
  }
  return data
}

export async function updateResident(id: number, updates: Partial<Resident>): Promise<Resident | null> {
  const { data, error } = await supabase.from("users").update(updates).eq("id", id).select().single()

  if (error) {
    console.error("Error updating resident:", error)
    return null
  }
  return data
}

export async function deleteResident(id: number): Promise<boolean> {
  const { error } = await supabase.from("users").delete().eq("id", id)

  if (error) {
    console.error("Error deleting resident:", error)
    return false
  }
  return true
}
