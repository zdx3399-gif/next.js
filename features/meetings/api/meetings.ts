import { getSupabaseClient } from "@/lib/supabase"

export interface Meeting {
  id?: string
  topic: string
  time: string
  location: string
  notes?: string
  created_at?: string
}

const supabase = getSupabaseClient()

export async function getMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase.from("meetings").select("*").order("time", { ascending: false })

  if (error) {
    console.error("Error fetching meetings:", error)
    return []
  }
  return data || []
}

export async function createMeeting(meeting: Omit<Meeting, "id" | "created_at">): Promise<Meeting | null> {
  const { data, error } = await supabase.from("meetings").insert([meeting]).select().single()

  if (error) {
    console.error("Error creating meeting:", error)
    return null
  }
  return data
}

export async function updateMeeting(id: string, meeting: Partial<Meeting>): Promise<Meeting | null> {
  const { data, error } = await supabase.from("meetings").update(meeting).eq("id", id).select().single()

  if (error) {
    console.error("Error updating meeting:", error)
    return null
  }
  return data
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const { error } = await supabase.from("meetings").delete().eq("id", id)

  if (error) {
    console.error("Error deleting meeting:", error)
    return false
  }
  return true
}
