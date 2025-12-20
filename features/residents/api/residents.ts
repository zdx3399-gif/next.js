import { getSupabaseClient } from "@/lib/supabase"

export interface Resident {
  id?: string
  name: string
  room?: string // 顯示用，從 units.unit_code 來
  phone: string // 從 profiles 獲取
  email?: string // 從 profiles 獲取
  role?: "resident" | "committee" | "vendor"
  relationship?: "owner" | "family_member" | "tenant" | "household_member"
  created_at?: string
  updated_at?: string
  // FK 欄位
  unit_id?: string
  profile_id?: string
}

export async function fetchResidents(): Promise<Resident[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  // 先查詢 household_members
  const { data, error } = await supabase.from("household_members").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching residents:", error)
    return []
  }

  if (!data || data.length === 0) return []

  // 收集所有 profile_id 和 unit_id
  const profileIds = [...new Set(data.filter((r) => r.profile_id).map((r) => r.profile_id))]
  const unitIds = [...new Set(data.filter((r) => r.unit_id).map((r) => r.unit_id))]

  // 分開查詢 profiles
  let profilesMap: Record<string, { phone?: string; email?: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, phone, email").in("id", profileIds)
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, { phone: p.phone, email: p.email }]))
    }
  }

  // 分開查詢 units
  let unitsMap: Record<string, string> = {}
  if (unitIds.length > 0) {
    const { data: units } = await supabase.from("units").select("id, unit_code").in("id", unitIds)
    if (units) {
      unitsMap = Object.fromEntries(units.map((u) => [u.id, u.unit_code]))
    }
  }

  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    phone: r.profile_id ? profilesMap[r.profile_id]?.phone || "" : "",
    email: r.profile_id ? profilesMap[r.profile_id]?.email || "" : "",
    role: r.role,
    relationship: r.relationship,
    created_at: r.created_at,
    updated_at: r.updated_at,
    unit_id: r.unit_id,
    profile_id: r.profile_id,
    room: r.unit_id ? unitsMap[r.unit_id] || "" : "",
  }))
}

export async function createResident(
  resident: Omit<Resident, "id" | "created_at" | "updated_at">,
): Promise<Resident | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const insertData: Record<string, unknown> = {
    name: resident.name,
    relationship: resident.relationship || "household_member",
  }

  if (resident.unit_id) {
    insertData.unit_id = resident.unit_id
  }

  if (resident.profile_id) {
    insertData.profile_id = resident.profile_id

    // 同步更新 profiles 表的 phone/email
    if (resident.phone || resident.email) {
      const profileUpdates: Record<string, string> = {}
      if (resident.phone) profileUpdates.phone = resident.phone
      if (resident.email) profileUpdates.email = resident.email

      await supabase.from("profiles").update(profileUpdates).eq("id", resident.profile_id)
    }
  }

  const { data, error } = await supabase.from("household_members").insert([insertData]).select().single()

  if (error) {
    console.error("Error creating resident:", error)
    return null
  }
  return data
}

export async function updateResident(id: string, updates: Partial<Resident>): Promise<Resident | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { room, phone, email, profile_id, ...dbUpdates } = updates

  // 更新 household_members（不含 phone/email）
  const { data, error } = await supabase
    .from("household_members")
    .update(dbUpdates)
    .eq("id", id)
    .select(`*, profile_id`)
    .single()

  if (error) {
    console.error("Error updating resident:", error)
    return null
  }

  const targetProfileId = data?.profile_id || profile_id
  if (targetProfileId && (phone || email)) {
    const profileUpdates: Record<string, string> = {}
    if (phone) profileUpdates.phone = phone
    if (email) profileUpdates.email = email

    await supabase.from("profiles").update(profileUpdates).eq("id", targetProfileId)
  }

  return data
}

export async function deleteResident(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const { error } = await supabase.from("household_members").delete().eq("id", id)

  if (error) {
    console.error("Error deleting resident:", error)
    return false
  }
  return true
}

export async function fetchResidentsByRoom(room: string): Promise<Resident[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  // 先查詢 unit_id
  const { data: units } = await supabase.from("units").select("id").eq("unit_code", room).limit(1)

  if (!units || units.length === 0) {
    return []
  }

  const unitId = units[0].id

  const { data, error } = await supabase
    .from("household_members")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching residents by room:", error)
    return []
  }

  if (!data || data.length === 0) return []

  // 收集所有 profile_id
  const profileIds = [...new Set(data.filter((r) => r.profile_id).map((r) => r.profile_id))]

  let profilesMap: Record<string, { phone?: string; email?: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, phone, email").in("id", profileIds)
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, { phone: p.phone, email: p.email }]))
    }
  }

  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    phone: r.profile_id ? profilesMap[r.profile_id]?.phone || "" : "",
    email: r.profile_id ? profilesMap[r.profile_id]?.email || "" : "",
    role: r.role,
    relationship: r.relationship,
    created_at: r.created_at,
    updated_at: r.updated_at,
    unit_id: r.unit_id,
    profile_id: r.profile_id,
    room: room,
  }))
}

export async function fetchResidentsByUnitId(unitId: string): Promise<Resident[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("household_members")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching residents by unit:", error)
    return []
  }

  if (!data || data.length === 0) return []

  // 查詢 unit_code
  const { data: unitData } = await supabase.from("units").select("unit_code").eq("id", unitId).single()
  const unitCode = unitData?.unit_code || ""

  // 收集所有 profile_id
  const profileIds = [...new Set(data.filter((r) => r.profile_id).map((r) => r.profile_id))]

  let profilesMap: Record<string, { phone?: string; email?: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, phone, email").in("id", profileIds)
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, { phone: p.phone, email: p.email }]))
    }
  }

  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    phone: r.profile_id ? profilesMap[r.profile_id]?.phone || "" : "",
    email: r.profile_id ? profilesMap[r.profile_id]?.email || "" : "",
    role: r.role,
    relationship: r.relationship,
    created_at: r.created_at,
    updated_at: r.updated_at,
    unit_id: r.unit_id,
    profile_id: r.profile_id,
    room: unitCode,
  }))
}

// 單位相關
export interface Unit {
  id: string
  unit_number: string
  unit_code: string
  ping_size: number
  car_spots: number
  moto_spots: number
  monthly_fee: number
  created_at?: string
  updated_at?: string
}

export async function fetchUnits(): Promise<Unit[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("units").select("*").order("unit_number", { ascending: true })

  if (error) {
    console.error("Error fetching units:", error)
    return []
  }
  return data || []
}

export async function createUnit(unit: Omit<Unit, "id" | "created_at" | "updated_at">): Promise<Unit | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase.from("units").insert([unit]).select().single()

  if (error) {
    console.error("Error creating unit:", error)
    return null
  }
  return data
}

export async function updateUnit(id: string, updates: Partial<Unit>): Promise<Unit | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase.from("units").update(updates).eq("id", id).select().single()

  if (error) {
    console.error("Error updating unit:", error)
    return null
  }
  return data
}

export async function deleteUnit(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const { error } = await supabase.from("units").delete().eq("id", id)

  if (error) {
    console.error("Error deleting unit:", error)
    return false
  }
  return true
}
