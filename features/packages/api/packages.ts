import { getSupabaseClient } from "@/lib/supabase"

export interface Package {
  id: string
  courier: string
  tracking_number?: string
  arrived_at: string
  picked_up_at?: string
  status: "pending" | "picked_up"
  notes?: string
  recipient_id?: string
  unit_id?: string
  picked_up_by_id?: string
  recipient_name: string
  recipient_room: string
  picked_up_by?: string
  picked_up_by_name?: string
}

export interface AddPackageData {
  courier: string
  recipient_name: string
  recipient_room: string
  tracking_number?: string
  arrived_at: string
  unit_id?: string
}

export async function fetchPackages(room?: string, isAdmin = false, userUnitId?: string): Promise<Package[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data: packagesData, error } = await supabase
    .from("packages")
    .select("*")
    .order("arrived_at", { ascending: false })

  if (error) {
    console.error("Error loading packages:", error)
    return []
  }

  if (!packagesData || packagesData.length === 0) {
    return []
  }

  const unitIds = [...new Set(packagesData.map((p) => p.unit_id).filter(Boolean))]
  const recipientIds = [...new Set(packagesData.map((p) => p.recipient_id).filter(Boolean))]

  const unitsMap: Record<string, string> = {}
  if (unitIds.length > 0) {
    const { data: unitsData } = await supabase.from("units").select("id, unit_code").in("id", unitIds)

    if (unitsData) {
      for (const u of unitsData) {
        unitsMap[u.id] = u.unit_code
      }
    }
  }

  const recipientNamesMap: Record<string, string> = {}
  if (recipientIds.length > 0) {
    const { data: membersData } = await supabase.from("household_members").select("id, name").in("id", recipientIds)

    if (membersData) {
      for (const m of membersData) {
        recipientNamesMap[m.id] = m.name
      }
    }
  }

  const unitOwnerMap: Record<string, string> = {}
  if (unitIds.length > 0) {
    const { data: ownersData } = await supabase
      .from("household_members")
      .select("unit_id, name, relationship")
      .in("unit_id", unitIds)

    if (ownersData) {
      for (const o of ownersData) {
        if (o.unit_id) {
          // 優先使用戶主，如果已有則不覆蓋
          if (o.relationship === "戶長" || o.relationship === "owner") {
            unitOwnerMap[o.unit_id] = o.name
          } else if (!unitOwnerMap[o.unit_id]) {
            unitOwnerMap[o.unit_id] = o.name
          }
        }
      }
    }
  }

  const packages: Package[] = packagesData.map((pkg: any) => {
    const recipientName =
      (pkg.recipient_id ? recipientNamesMap[pkg.recipient_id] : null) ||
      (pkg.unit_id ? unitOwnerMap[pkg.unit_id] : null) ||
      ""

    const recipientRoom = pkg.unit_id ? unitsMap[pkg.unit_id] : ""

    return {
      id: pkg.id,
      courier: pkg.courier,
      tracking_number: pkg.tracking_number,
      arrived_at: pkg.arrived_at,
      picked_up_at: pkg.picked_up_at,
      status: pkg.status,
      notes: pkg.notes,
      recipient_id: pkg.recipient_id,
      unit_id: pkg.unit_id,
      picked_up_by_id: pkg.picked_up_by_id,
      recipient_name: recipientName,
      recipient_room: recipientRoom,
      picked_up_by: pkg.picked_up_by || "",
      picked_up_by_name: pkg.picked_up_by_name || "",
    }
  })

  if (!isAdmin && userUnitId) {
    return packages.filter((p) => p.unit_id === userUnitId)
  }

  if (room && !isAdmin) {
    return packages.filter((p) => p.recipient_room === room)
  }

  return packages
}

export async function addPackage(packageData: AddPackageData): Promise<Package | null> {
  // Call the API route which handles both database insert AND LINE notification
  const response = await fetch("/api/packages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      courier: packageData.courier,
      recipient_name: packageData.recipient_name,
      recipient_room: packageData.recipient_room,
      tracking_number: packageData.tracking_number || null,
      arrived_at: packageData.arrived_at || new Date().toISOString(),
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error("[v0] Error adding package:", result.error)
    throw new Error(result.error || "新增包裹失敗")
  }

  console.log("[v0] Package added successfully via API:", result)

  // Return a minimal package object (the list will reload anyway)
  return {
    id: result.id || "",
    courier: packageData.courier,
    tracking_number: packageData.tracking_number,
    arrived_at: packageData.arrived_at || new Date().toISOString(),
    status: "pending",
    recipient_name: packageData.recipient_name || "",
    recipient_room: packageData.recipient_room || "",
  }
}

export async function markPackageAsPickedUp(
  packageId: string,
  pickedUpBy: string,
  pickedUpById?: string,
): Promise<Package | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const pickedUpTime = new Date().toISOString()

  const updateData: Record<string, unknown> = {
    status: "picked_up",
    picked_up_at: pickedUpTime,
    picked_up_by: pickedUpBy, // 領取人名字
  }

  if (pickedUpById) {
    updateData.picked_up_by_id = pickedUpById
  }

  console.log("[v0] Marking package as picked up:", packageId, updateData)

  const { data, error } = await supabase.from("packages").update(updateData).eq("id", packageId).select().single()

  if (error) {
    console.log("[v0] First attempt failed, trying without picked_up_by column")
    const fallbackData: Record<string, unknown> = {
      status: "picked_up",
      picked_up_at: pickedUpTime,
    }
    if (pickedUpById) {
      fallbackData.picked_up_by_id = pickedUpById
    }

    const { data: data2, error: error2 } = await supabase
      .from("packages")
      .update(fallbackData)
      .eq("id", packageId)
      .select()
      .single()

    if (error2) {
      console.error("[v0] Error marking package as picked up:", error2.message)
      throw new Error(error2.message)
    }

    return {
      ...data2,
      picked_up_by: pickedUpBy,
    }
  }

  console.log("[v0] Package marked as picked up:", data)

  return {
    ...data,
    picked_up_by: pickedUpBy,
  }
}

export function getPickedUpByName(pkg: Package): string {
  return pkg.picked_up_by || pkg.picked_up_by_name || "未知"
}

export function getRecipientName(pkg: Package): string {
  return pkg.recipient_name || ""
}

export function getRecipientRoom(pkg: Package): string {
  return pkg.recipient_room || ""
}
