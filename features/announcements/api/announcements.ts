import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

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

function getCurrentOperator() {
  if (typeof window === "undefined") return { id: "", role: "unknown" }

  try {
    const raw = localStorage.getItem("currentUser")
    if (!raw) return { id: "", role: "unknown" }
    const parsed = JSON.parse(raw)
    return { id: parsed?.id || "", role: parsed?.role || "unknown" }
  } catch {
    return { id: "", role: "unknown" }
  }
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
  const operator = getCurrentOperator()
  if (!data?.title || !data?.content) {
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_announcement",
        targetType: "announcement",
        targetId: operator.id,
        reason: "建立公告缺少必要欄位",
        additionalData: { module: "announcements", status: "blocked", error_code: "missing_required_fields" },
      })
    }
    return { data: null, error: { message: "缺少必要欄位：標題或內容" } }
  }

  // Admin 角色在此專案是預覽模式，getSupabaseClient() 會回傳 null。
  // 這種情況改由後端 /api/announce 一次完成「寫入 + 推播」。
  if (!supabase) {
    try {
      console.log("[Announce] Supabase client unavailable, fallback to /api/announce");
      const response = await fetch("/api/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          image_url: data.image_url,
          author: data.author_name,
          pushOnly: false,
          test: false,
        }),
      })

      const payload = await response.json().catch(() => ({} as any))
      if (!response.ok) {
        return { data: null, error: { message: payload?.error || "公告發布失敗" } }
      }

      return { data: payload, error: null }
    } catch (error: any) {
      return { data: null, error: { message: error?.message || "公告發布失敗" } }
    }
  }

  const { id, author_name, ...rest } = data as any
  const insertData = {
    ...rest,
    created_by: userId || null,
    status: "published", // 新增公告強制設為已發布
  }

  console.log("[Announce] 📤 新增公告，強制設為已發布狀態");
  console.log("[Announce] 📊 公告內容:", { title: data.title, content: data.content?.substring(0, 50) + "...", author: data.author_name });

  // 先寫入資料庫
  const { data: result, error } = await supabase.from("announcements").insert([insertData]).select().single()

  if (error) {
    console.error("[Announce] ❌ 資料庫寫入失敗:", error);
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_announcement",
        targetType: "announcement",
        targetId: operator.id,
        reason: error.message || "建立公告失敗",
        additionalData: { module: "announcements", status: "failed", error_code: error.message },
      })
    }
    return { data: null, error }
  }

  if (operator.id && result?.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "create_announcement",
      targetType: "announcement",
      targetId: result.id,
      reason: data.title,
      afterState: { status: "published" },
      additionalData: { module: "announcements", status: "success" },
    })
  }

  console.log("[Announce] ✅ 公告寫入成功");

  // 然後立即推播給所有人
  try {
    console.log("[Announce] 📤 準備推播給所有已綁定住戶...");
    const response = await fetch("/api/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        content: data.content,
        image_url: data.image_url,
        author: data.author_name,
        pushOnly: true, // 只推播，不重複寫入資料庫
        test: false,
      }),
    })

    const payload = await response.json()
    console.log("[Announce] 📥 推播結果:", payload);

    if (!response.ok) {
      console.warn("[Announce] ⚠️  推播失敗:", payload?.error);
      // 但不影響公告建立的成功狀態
    } else {
      console.log("[Announce] ✅ 推播給", payload?.pushed || 0, "人");
    }
  } catch (error: any) {
    console.error("[Announce] 💥 推播請求失敗:", error);
    // 但不影響公告建立的成功狀態
  }

  return { data: result, error: null }
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>) {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) {
    return { data: null, error: { message: "請先登入" } }
  }

  // 讀取舊狀態，判斷是否 draft -> published
  const { data: currentAnnouncement } = await supabase
    .from("announcements")
    .select("id, status")
    .eq("id", id)
    .maybeSingle()

  const { author_name, ...dbData } = data as any
  delete dbData.id // 確保不會更新 id

  console.log("[v0] Updating announcement", id, "with data:", dbData)

  const { data: result, error } = await supabase.from("announcements").update(dbData).eq("id", id).select().single()

  if (error) {
    console.error("[v0] Error updating announcement:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_announcement",
        targetType: "announcement",
        targetId: id,
        reason: error.message || "更新公告失敗",
        additionalData: { module: "announcements", status: "failed", error_code: error.message },
      })
    }
    return { data: null, error }
  }

  // 只有在草稿轉已發布時觸發 LINE 推播
  const becamePublished = currentAnnouncement?.status !== "published" && result?.status === "published"
  console.log("[Announce] 狀態檢查 - 舊狀態:", currentAnnouncement?.status, "新狀態:", result?.status, "是否發布:", becamePublished);

  if (becamePublished) {
    try {
      console.log("[Announce] 📤 檢測到從草稿→已發布，準備呼叫 /api/announce");
      const response = await fetch("/api/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          content: result.content,
          image_url: result.image_url,
          author: result.author_name,
          pushOnly: true,
          test: false,
        }),
      })

      const payload = await response.json();
      if (!response.ok) {
        console.error("[Announce] ❌ 推播失敗:", payload);
      } else {
        console.log("[Announce] ✅ 草稿轉發布成功推播，推播給", payload?.pushed || 0, "人");
      }
    } catch (pushError) {
      console.error("[Announce] 💥 推播請求失敗:", pushError);
    }
  }

  console.log("[v0] Announcement updated successfully:", result)
  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: result?.status === "published" && currentAnnouncement?.status !== "published" ? "publish_announcement" : "update_announcement",
      targetType: "announcement",
      targetId: id,
      reason: result?.title || "更新公告",
      beforeState: { status: currentAnnouncement?.status || null },
      afterState: { status: result?.status || null },
      additionalData: { module: "announcements", status: "success" },
    })
  }
  return { data: result, error: null }
}

export async function deleteAnnouncement(id: string) {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) {
    return { data: null, error: { message: "請先登入" } }
  }

  console.log("[v0] Deleting announcement:", id)

  const { error } = await supabase.from("announcements").delete().eq("id", id)

  if (error) {
    console.error("[v0] Error deleting announcement:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_announcement",
        targetType: "announcement",
        targetId: id,
        reason: error.message || "刪除公告失敗",
        additionalData: { module: "announcements", status: "failed", error_code: error.message },
      })
    }
    return { data: null, error }
  }

  console.log("[v0] Announcement deleted successfully")
  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_announcement",
      targetType: "announcement",
      targetId: id,
      reason: "刪除公告",
      afterState: { deleted: true },
      additionalData: { module: "announcements", status: "success" },
    })
  }
  return { data: { id }, error: null }
}

export async function uploadAnnouncementImage(file: File): Promise<string> {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: form,
  })

  let payload: any = {}
  try { payload = await res.json() } catch {}

  if (!res.ok) {
    throw new Error(payload?.error || "圖片上傳失敗")
  }
  if (!payload?.url) {
    throw new Error("圖片上傳失敗：未收到圖片網址")
  }
  return payload.url
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
