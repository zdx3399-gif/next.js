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

export interface UpdatePackageData {
  id: string
  courier: string
  recipient_name: string
  recipient_room: string
  tracking_number?: string
  arrived_at: string
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
          if (o.relationship === "household_member" || o.relationship === "戶長") {
            unitOwnerMap[o.unit_id] = o.name
          } else if (!unitOwnerMap[o.unit_id]) {
            unitOwnerMap[o.unit_id] = o.name
          }
        }
      }
    }
  }

  const packages: Package[] = packagesData.map((pkg: any) => {
    // 優先使用資料庫上儲存的 recipient_name / recipient_room（server route 或 insert 時可能已寫入）
    const recipientName =
      (pkg.recipient_name && pkg.recipient_name !== "")
        ? pkg.recipient_name
        : (pkg.recipient_id ? recipientNamesMap[pkg.recipient_id] : null) ||
          (pkg.unit_id ? unitOwnerMap[pkg.unit_id] : null) ||
          ""

    const recipientRoom =
      (pkg.recipient_room && pkg.recipient_room !== "")
        ? pkg.recipient_room
        : pkg.unit_id
        ? unitsMap[pkg.unit_id]
        : ""

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
  const res = await fetch("/api/packages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(packageData),
  })

  const result = await res.json().catch(() => ({}))

  if (!res.ok) {
    console.error("[v0] Error adding package via API:", result)
    throw new Error(result?.error || "新增包裹失敗")
  }

  return {
    id: result.id,
    courier: packageData.courier,
    tracking_number: packageData.tracking_number,
    arrived_at: packageData.arrived_at,
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
  const res = await fetch("/api/packages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId, picked_up_by: pickedUpBy, picked_up_by_id: pickedUpById }),
  })

  const result = await res.json().catch(() => ({}))

  if (!res.ok) {
    console.error("[v0] Error marking package as picked up via API:", result)
    throw new Error(result?.error || "標記領取失敗")
  }

  return {
    id: packageId,
    recipient_name: "",
    recipient_room: "",
    courier: "",
    arrived_at: new Date().toISOString(),
    status: "picked_up",
    picked_up_by: pickedUpBy,
  }
}

export async function updatePackage(packageData: UpdatePackageData): Promise<boolean> {
  const res = await fetch("/api/packages", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(packageData),
  })

  const result = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error("[v0] Error updating package via API:", result)
    throw new Error(result?.error || "編輯包裹失敗")
  }

  return true
}

export async function deletePackage(packageId: string): Promise<boolean> {
  const res = await fetch(`/api/packages?id=${encodeURIComponent(packageId)}`, {
    method: "DELETE",
  })

  const result = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error("[v0] Error deleting package via API:", result)
    throw new Error(result?.error || "刪除包裹失敗")
  }

  return true
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

