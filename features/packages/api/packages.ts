import { getSupabaseClient } from "@/lib/supabase"

export interface Package {
  id: string
  courier: string
  recipient_name: string
  recipient_room: string
  tracking_number?: string
  arrived_at: string
  picked_up_at?: string
  picked_up_by?: string
  status: "pending" | "picked_up"
}

export async function fetchPackages(userRoom?: string, isAdmin = false): Promise<Package[]> {
  const supabase = getSupabaseClient()
  let query = supabase.from("packages").select("*")

  if (userRoom && !isAdmin) {
    query = query.eq("recipient_room", userRoom)
  }

  const { data, error } = await query.order("arrived_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading packages:", error)
    return []
  }

  console.log("[v0] Fetched packages:", data?.length, "userRoom:", userRoom, "isAdmin:", isAdmin)
  return data || []
}

export async function addPackage(packageData: {
  courier: string
  recipient_name: string
  recipient_room: string
  tracking_number?: string
  arrived_at: string
}): Promise<Package | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from("packages")
    .insert([
      {
        ...packageData,
        tracking_number: packageData.tracking_number || null,
        status: "pending",
      },
    ])
    .select()
    .single()

  if (error) {
    console.error("[v0] Error adding package:", error)
    throw new Error(error.message)
  }

  return data
}

export async function markPackageAsPickedUp(packageId: string, pickedUpBy: string): Promise<Package | null> {
  const supabase = getSupabaseClient()
  const pickedUpTime = new Date().toISOString()

  const { data, error } = await supabase
    .from("packages")
    .update({
      status: "picked_up",
      picked_up_at: pickedUpTime,
      picked_up_by: pickedUpBy,
    })
    .eq("id", packageId)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error marking package as picked up:", error)
    throw new Error(error.message)
  }

  return data
}
