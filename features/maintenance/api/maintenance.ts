import { getSupabaseClient } from "@/lib/supabase"

export interface MaintenanceRequest {
  id: string
  equipment: string
  item: string
  description: string
  status: "open" | "progress" | "done"
  reported_by: string
  created_by: string
  photo_url?: string | null
  handler?: string | null
  cost?: number | null
  created_at?: string
}

export interface MaintenanceFormData {
  type: string
  location: string
  description: string
  image: File | null
}

export async function fetchMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("maintenance").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching maintenance requests:", error)
    return []
  }

  return data || []
}

export async function fetchUserMaintenanceRequests(userId: string): Promise<MaintenanceRequest[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("maintenance")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching user maintenance requests:", error)
    return []
  }

  return data || []
}

export async function submitMaintenanceRequest(
  formData: MaintenanceFormData,
  userId: string,
  userName: string,
): Promise<{ success: boolean; error?: string; data?: MaintenanceRequest }> {
  const supabase = getSupabaseClient()

  try {
    let photoUrl = ""
    if (formData.image) {
      const reader = new FileReader()
      photoUrl = await new Promise((resolve, reject) => {
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
          reported_by: userName || "未知",
          created_by: userId,
          photo_url: photoUrl || null,
        },
      ])
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function updateMaintenanceRequest(
  id: string,
  updates: Partial<MaintenanceRequest>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("maintenance").update(updates).eq("id", id)

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
