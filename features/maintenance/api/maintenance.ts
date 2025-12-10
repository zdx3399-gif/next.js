import { getSupabaseClient } from "@/lib/supabase"

export interface MaintenanceRequest {
  id: string
  equipment: string
  item: string
  description: string
  status: "open" | "progress" | "closed"
  reported_by_id?: string
  handler_id?: string
  assignee_id?: string
  unit_id?: string
  reported_by_name?: string
  handler_name?: string
  image_url?: string | null
  cost?: number | null
  created_at?: string
  time?: string
  note?: string
}

export interface MaintenanceFormData {
  type: string
  location: string
  description: string
  image: File | null
}

export async function fetchMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("maintenance").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching maintenance requests:", error)
    return []
  }

  if (!data || data.length === 0) return []

  // 收集所有 reporter 和 handler IDs
  const reporterIds = [...new Set(data.filter((m) => m.reported_by_id).map((m) => m.reported_by_id))]
  const handlerIds = [...new Set(data.filter((m) => m.handler_id).map((m) => m.handler_id))]
  const allProfileIds = [...new Set([...reporterIds, ...handlerIds])]

  // 批量查詢所有 profiles
  let profilesMap: Record<string, string> = {}
  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", allProfileIds)

    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p.name || "未知"]))
    }
  }

  return data.map((item: any) => ({
    ...item,
    reported_by_name:
      item.reported_by_name || (item.reported_by_id ? profilesMap[item.reported_by_id] : null) || "未知",
    handler_name: item.handler_name || (item.handler_id ? profilesMap[item.handler_id] : null) || "未指派",
    image_url: item.image_url || item.photo_url || null,
  }))
}

export async function fetchUserMaintenanceRequests(userId: string): Promise<MaintenanceRequest[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("maintenance")
    .select("*")
    .eq("reported_by_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching user maintenance requests:", error)
    return []
  }

  if (!data || data.length === 0) return []

  // 收集所有 reporter 和 handler IDs
  const reporterIds = [...new Set(data.filter((m) => m.reported_by_id).map((m) => m.reported_by_id))]
  const handlerIds = [...new Set(data.filter((m) => m.handler_id).map((m) => m.handler_id))]
  const allProfileIds = [...new Set([...reporterIds, ...handlerIds])]

  // 批量查詢所有 profiles
  let profilesMap: Record<string, string> = {}
  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", allProfileIds)
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p.name || "未知"]))
    }
  }

  return data.map((item: any) => ({
    ...item,
    reported_by_name:
      item.reported_by_name || (item.reported_by_id ? profilesMap[item.reported_by_id] : null) || "未知",
    handler_name: item.handler_name || (item.handler_id ? profilesMap[item.handler_id] : null) || "未指派",
    image_url: item.image_url || item.photo_url || null,
  }))
}

export async function submitMaintenanceRequest(
  formData: MaintenanceFormData,
  userId: string,
  userName: string,
): Promise<{ success: boolean; error?: string; data?: MaintenanceRequest }> {
  const supabase = getSupabaseClient()

  try {
    let imageUrl = ""
    if (formData.image) {
      const reader = new FileReader()
      imageUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(formData.image!)
      })
    }

    const { data, error } = await supabase
      .from("maintenance")
      .insert([
        {
          equipment: formData.type,
          item: formData.location,
          description: formData.description,
          status: "open",
          reported_by_id: userId,
          reported_by_name: userName,
          time: new Date().toISOString(),
          image_url: imageUrl || null,
        },
      ])
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: { ...data, reported_by_name: userName } }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error"
    return { success: false, error: errorMessage }
  }
}

export async function updateMaintenanceRequest(
  id: string,
  updates: Partial<MaintenanceRequest>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  const { reported_by_name, handler_name, image_url, ...dbUpdates } = updates as any
  const { error } = await supabase.from("maintenance").update(dbUpdates).eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteMaintenanceRequest(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("maintenance").delete().eq("id", id)

  if (error) {
    console.error("Error deleting maintenance request:", error)
    return false
  }

  return true
}

export function getReportedByName(request: MaintenanceRequest): string {
  return request.reported_by_name || "未知"
}

export function getHandlerName(request: MaintenanceRequest): string {
  return request.handler_name || "未指派"
}
