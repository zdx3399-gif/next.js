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
  if (!supabase) {
    return { data: [], error: undefined }
  }

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching announcements:", error)
    return { data: [], error: { message: error.message || "Failed to fetch announcements" } }
  }

  if (!data || data.length === 0) return { data: [], error: undefined }

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
    error: undefined,
  }
}

export async function fetchAllAnnouncements() {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: [], error: undefined }
  }

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Error fetching all announcements:", error)
    return { data: [], error: { message: error.message || "Failed to fetch announcements" } }
  }

  if (!data || data.length === 0) return { data: [], error: undefined }

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
    error: undefined,
  }
}

export async function createAnnouncement(data: Partial<Announcement>, userId?: string) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: null, error: { message: "請先登入" } }
  }

  const { id, author_name, ...rest } = data as any
  const insertData = {
    ...rest,
    created_by: userId || null,
  }

  console.log("[v0] Creating announcement with data:", insertData)

  const { data: result, error } = await supabase.from("announcements").insert([insertData]).select().single()

  if (error) {
    console.error("[v0] Error creating announcement:", error)
    return { data: null, error }
  }

  console.log("[v0] Announcement created successfully:", result)
  return { data: result, error: null }
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: null, error: { message: "請先登入" } }
  }

  const { author_name, ...dbData } = data as any
  delete dbData.id // 確保不會更新 id

  console.log("[v0] Updating announcement", id, "with data:", dbData)

  const { data: result, error } = await supabase.from("announcements").update(dbData).eq("id", id).select().single()

  if (error) {
    console.error("[v0] Error updating announcement:", error)
    return { data: null, error }
  }

  console.log("[v0] Announcement updated successfully:", result)
  return { data: result, error: null }
}

export async function deleteAnnouncement(id: string) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: null, error: { message: "請先登入" } }
  }

  console.log("[v0] Deleting announcement:", id)

  const { error } = await supabase.from("announcements").delete().eq("id", id)

  if (error) {
    console.error("[v0] Error deleting announcement:", error)
    return { data: null, error }
  }

  console.log("[v0] Announcement deleted successfully")
  return { data: { id }, error: null }
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
  if (!supabase) {
    return { error: null } // Return null error to prevent crashes
  }

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
  if (!supabase) {
    return new Set()
  }
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
