import { getSupabaseClient } from "@/lib/supabase"

export interface Announcement {
  id: string
  title: string
  content: string
  image_url: string
  author: string
  created_at: string
  status: string
}

export async function fetchAnnouncements() {
  const supabase = getSupabaseClient()
  return supabase
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
}

export async function fetchAllAnnouncements() {
  const supabase = getSupabaseClient()
  return supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
}

export async function createAnnouncement(data: Partial<Announcement>) {
  const supabase = getSupabaseClient()
  const { id, ...rowWithoutId } = data as any
  return supabase.from("announcements").insert([rowWithoutId])
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>) {
  const supabase = getSupabaseClient()
  return supabase.from("announcements").update(data).eq("id", id)
}

export async function deleteAnnouncement(id: string) {
  const supabase = getSupabaseClient()
  return supabase.from("announcements").delete().eq("id", id)
}
