import { getSupabaseClient } from "@/lib/supabase"

export interface Announcement {
  id: string
  title: string
  content: string
  image_url?: string
  created_by?: string
  author_name?: string
  created_at: string
  status: string
}

export async function fetchAnnouncements() {
  const supabase = getSupabaseClient()
  if (!supabase) return { data: [], error: null }

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching announcements:", error)
    return { data: [], error }
  }

  if (!data || data.length === 0) return { data: [], error: null }

  // 收集所有 created_by IDs
  const authorIds = [...new Set(data.filter((a) => a.created_by).map((a) => a.created_by))]

  // 批量查詢作者名稱
  let authorsMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", authorIds)
    if (profiles) {
      authorsMap = Object.fromEntries(profiles.map((p) => [p.id, p.name || "管理員"]))
    }
  }

  return {
    data: data.map((item: any) => ({
      ...item,
      author_name: item.created_by ? authorsMap[item.created_by] || "管理員" : "管理員",
    })),
    error: null,
  }
}

export async function fetchAllAnnouncements() {
  const supabase = getSupabaseClient()
  if (!supabase) return { data: [], error: null }

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Error fetching all announcements:", error)
    return { data: [], error }
  }

  if (!data || data.length === 0) return { data: [], error: null }

  // 收集所有 created_by IDs
  const authorIds = [...new Set(data.filter((a) => a.created_by).map((a) => a.created_by))]

  // 批量查詢作者名稱
  let authorsMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", authorIds)
    if (profiles) {
      authorsMap = Object.fromEntries(profiles.map((p) => [p.id, p.name || "管理員"]))
    }
  }

  return {
    data: data.map((item: any) => ({
      ...item,
      author_name: item.created_by ? authorsMap[item.created_by] || "管理員" : "管理員",
    })),
    error: null,
  }
}

export async function createAnnouncement(data: Partial<Announcement>) {
  const supabase = getSupabaseClient()
  const { id, author_name, ...rowWithoutId } = data as any
  return supabase.from("announcements").insert([rowWithoutId])
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>) {
  const supabase = getSupabaseClient()
  const { author_name, ...dbData } = data as any
  return supabase.from("announcements").update(dbData).eq("id", id)
}

export async function deleteAnnouncement(id: string) {
  const supabase = getSupabaseClient()
  return supabase.from("announcements").delete().eq("id", id)
}

export async function uploadAnnouncementImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(new Error("圖片讀取失敗"))
    }
    reader.readAsDataURL(file)
  })
}

export async function markAnnouncementAsRead(announcementId: string, userId: string) {
  const supabase = getSupabaseClient()

  // 使用 announcement_reads 表
  const { error } = await supabase
    .from("announcement_reads")
    .upsert([{ announcement_id: announcementId, user_id: userId }], {
      onConflict: "announcement_id,user_id",
    })

  if (error) {
    console.error("Error marking announcement as read:", error)
    return { error }
  }

  return { error: null }
}

export async function fetchUserReadAnnouncements(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("announcement_reads").select("announcement_id").eq("user_id", userId)

  if (error) {
    console.error("Error fetching read announcements:", error)
    return new Set()
  }

  return new Set(data?.map((r) => r.announcement_id) || [])
}

export function getAuthorName(announcement: Announcement): string {
  return announcement.author_name || "管理員"
}
