import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

export interface Resident {
  id?: string
  name: string
  room?: string // 顯示用，從 units.unit_code 來
  phone: string // 從 profiles 獲取
  email?: string // 從 profiles 獲取
  emergency_contact_name?: string
  emergency_contact_phone?: string
  role?: "resident" | "committee" | "guard"
  relationship?: "owner" | "family_member" | "tenant" | "household_member"
  created_at?: string
  updated_at?: string
  // FK 欄位
  unit_id?: string
  profile_id?: string
}

type EmergencyContactInfo = {
  emergency_contact_name?: string
  emergency_contact_phone?: string
}

async function fetchEmergencyContactMap(supabase: any, profileIds: string[]): Promise<Record<string, EmergencyContactInfo>> {
  if (!profileIds.length) return {}

  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("resident_profile_id, contact_name, contact_phone, created_at")
    .in("resident_profile_id", profileIds)
    .order("created_at", { ascending: false })

  if (error || !data) return {}

  const map: Record<string, EmergencyContactInfo> = {}
  for (const row of data) {
    const profileId = row.resident_profile_id
    if (!profileId || map[profileId]) continue
    map[profileId] = {
      emergency_contact_name: row.contact_name || "",
      emergency_contact_phone: row.contact_phone || "",
    }
  }
  return map
}

async function syncEmergencyContact(
  supabase: any,
  profileId: string,
  name: string | undefined,
  phone: string | undefined,
) {
  if (!profileId) return

  const contactName = (name || "").trim()
  const contactPhone = (phone || "").trim()

  if (!contactName && !contactPhone) {
    await supabase.from("emergency_contacts").delete().eq("resident_profile_id", profileId)
    return
  }

  const { data: existing } = await supabase
    .from("emergency_contacts")
    .select("id")
    .eq("resident_profile_id", profileId)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from("emergency_contacts")
      .update({
        contact_name: contactName || "緊急聯絡人",
        contact_phone: contactPhone || "",
      })
      .eq("id", existing.id)
    return
  }

  await supabase.from("emergency_contacts").insert([
    {
      resident_profile_id: profileId,
      contact_name: contactName || "緊急聯絡人",
      contact_phone: contactPhone || "",
    },
  ])
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
  let profilesMap: Record<string, { phone?: string; email?: string; role?: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, phone, email, role").in("id", profileIds)
    if (profiles) {
      profilesMap = Object.fromEntries(
        profiles.map((p) => [
          p.id,
          {
            phone: p.phone,
            email: p.email,
            role: p.role,
          },
        ]),
      )
    }
  }

  const emergencyMap = await fetchEmergencyContactMap(supabase, profileIds)

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
    emergency_contact_name: r.profile_id ? emergencyMap[r.profile_id]?.emergency_contact_name || "" : "",
    emergency_contact_phone: r.profile_id ? emergencyMap[r.profile_id]?.emergency_contact_phone || "" : "",
    role: r.role || (r.profile_id ? (profilesMap[r.profile_id]?.role as any) : undefined),
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
  const operator = getCurrentOperator()
  if (!supabase) return null

  const normalizedRole = resident.role

  const insertData: Record<string, unknown> = {
    name: resident.name,
    role: normalizedRole || "resident",
    relationship: resident.relationship || "household_member",
  }

  if (resident.unit_id) {
    insertData.unit_id = resident.unit_id
  }

  if (resident.profile_id) {
    insertData.profile_id = resident.profile_id

    // 同步更新 profiles 表的 phone/email/role
    if (
      resident.phone !== undefined ||
      resident.email !== undefined ||
      normalizedRole !== undefined ||
      resident.emergency_contact_name !== undefined ||
      resident.emergency_contact_phone !== undefined
    ) {
      const profileUpdates: Record<string, string> = {}
      if (resident.phone !== undefined) profileUpdates.phone = resident.phone || ""
      if (resident.email !== undefined) profileUpdates.email = resident.email || ""
      if (normalizedRole !== undefined) profileUpdates.role = normalizedRole

      await supabase.from("profiles").update(profileUpdates).eq("id", resident.profile_id)
      if (resident.emergency_contact_name !== undefined || resident.emergency_contact_phone !== undefined) {
        await syncEmergencyContact(
          supabase,
          resident.profile_id,
          resident.emergency_contact_name,
          resident.emergency_contact_phone,
        )
      }
    }
  }

  let { data, error } = await supabase.from("household_members").insert([insertData]).select().single()

  if (error && insertData.role) {
    const { role: _role, ...fallbackInsert } = insertData
    const retry = await supabase.from("household_members").insert([fallbackInsert]).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error("Error creating resident:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_resident",
        targetType: "user",
        targetId: resident.profile_id || resident.unit_id || operator.id,
        reason: error.message,
        afterState: insertData as Record<string, any>,
        additionalData: { module: "residents", status: "failed", error_code: error.message },
      })
    }
    return null
  }
  if (operator.id && data?.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "create_resident",
      targetType: "user",
      targetId: data.id,
      reason: resident.name,
      afterState: insertData as Record<string, any>,
      additionalData: { module: "residents", status: "success" },
    })
  }
  return data
}

export async function updateResident(id: string, updates: Partial<Resident>): Promise<Resident | null> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) return null

  const normalizedRole = updates.role
  const {
    room,
    phone,
    email,
    profile_id,
    role,
    emergency_contact_name,
    emergency_contact_phone,
    ...dbUpdates
  } = updates

  if (normalizedRole !== undefined) {
    dbUpdates.role = normalizedRole
  }

  // 更新 household_members（不含 phone/email）
  let { data, error } = await supabase
    .from("household_members")
    .update(dbUpdates)
    .eq("id", id)
    .select(`*, profile_id`)
    .single()

  if (error && dbUpdates.role !== undefined) {
    const { role: _role, ...fallbackDbUpdates } = dbUpdates
    const retry = await supabase
      .from("household_members")
      .update(fallbackDbUpdates)
      .eq("id", id)
      .select(`*, profile_id`)
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error("Error updating resident:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_resident",
        targetType: "user",
        targetId: id,
        reason: error.message,
        afterState: dbUpdates as Record<string, any>,
        additionalData: { module: "residents", status: "failed", error_code: error.message },
      })
    }
    return null
  }

  const targetProfileId = data?.profile_id || profile_id
  if (
    targetProfileId &&
    (phone !== undefined ||
      email !== undefined ||
      normalizedRole !== undefined ||
      emergency_contact_name !== undefined ||
      emergency_contact_phone !== undefined)
  ) {
    const profileUpdates: Record<string, string> = {}
    if (phone !== undefined) profileUpdates.phone = phone || ""
    if (email !== undefined) profileUpdates.email = email || ""
    if (normalizedRole !== undefined) profileUpdates.role = normalizedRole

    await supabase.from("profiles").update(profileUpdates).eq("id", targetProfileId)
    if (emergency_contact_name !== undefined || emergency_contact_phone !== undefined) {
      await syncEmergencyContact(supabase, targetProfileId, emergency_contact_name, emergency_contact_phone)
    }
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "update_resident",
      targetType: "user",
      targetId: id,
      reason: updates.name || "更新住戶",
      afterState: { ...dbUpdates, profile_id: targetProfileId || undefined },
      additionalData: { module: "residents", status: "success" },
    })
  }

  return data
}

export async function deleteResident(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) return false

  const { error } = await supabase.from("household_members").delete().eq("id", id)

  if (error) {
    console.error("Error deleting resident:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_resident",
        targetType: "user",
        targetId: id,
        reason: error.message,
        additionalData: { module: "residents", status: "failed", error_code: error.message },
      })
    }
    return false
  }
  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_resident",
      targetType: "user",
      targetId: id,
      reason: "刪除住戶",
      additionalData: { module: "residents", status: "success" },
    })
  }
  return true
}

export async function fetchResidentsByRoom(room: string): Promise<Resident[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  // 先嘗試以 unit_code 或 unit_number 精確比對 room（UI 可能傳不同格式）
  let unitsResult: any = null
  try {
    const res = await supabase
      .from("units")
      .select("id")
      .or(`unit_code.eq.${room},unit_number.eq.${room}`)
      .limit(1)
    unitsResult = res
  } catch (e) {
    console.warn("Exact unit match failed, will try fallback:", e)
  }

  let units = unitsResult?.data || []

  // 若找不到，再用模糊比對 unit_code（容錯不同分隔或格式）
  if ((!units || units.length === 0) && room) {
    try {
      const { data: unitsLike } = await supabase.from("units").select("id").ilike("unit_code", `%${room}%`).limit(1)
      units = unitsLike || []
    } catch (e) {
      console.warn("Fuzzy unit match failed:", e)
    }
  }

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

  let profilesMap: Record<string, { phone?: string; email?: string; role?: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, phone, email, role").in("id", profileIds)
    if (profiles) {
      profilesMap = Object.fromEntries(
        profiles.map((p) => [
          p.id,
          {
            phone: p.phone,
            email: p.email,
            role: p.role,
          },
        ]),
      )
    }
  }

  const emergencyMap = await fetchEmergencyContactMap(supabase, profileIds)

  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    phone: r.profile_id ? profilesMap[r.profile_id]?.phone || "" : "",
    email: r.profile_id ? profilesMap[r.profile_id]?.email || "" : "",
    emergency_contact_name: r.profile_id ? emergencyMap[r.profile_id]?.emergency_contact_name || "" : "",
    emergency_contact_phone: r.profile_id ? emergencyMap[r.profile_id]?.emergency_contact_phone || "" : "",
    role: r.role || (r.profile_id ? (profilesMap[r.profile_id]?.role as any) : undefined),
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

  let profilesMap: Record<string, { phone?: string; email?: string; role?: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, phone, email, role").in("id", profileIds)
    if (profiles) {
      profilesMap = Object.fromEntries(
        profiles.map((p) => [
          p.id,
          {
            phone: p.phone,
            email: p.email,
            role: p.role,
          },
        ]),
      )
    }
  }

  const emergencyMap = await fetchEmergencyContactMap(supabase, profileIds)

  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    phone: r.profile_id ? profilesMap[r.profile_id]?.phone || "" : "",
    email: r.profile_id ? profilesMap[r.profile_id]?.email || "" : "",
    emergency_contact_name: r.profile_id ? emergencyMap[r.profile_id]?.emergency_contact_name || "" : "",
    emergency_contact_phone: r.profile_id ? emergencyMap[r.profile_id]?.emergency_contact_phone || "" : "",
    role: r.role || (r.profile_id ? (profilesMap[r.profile_id]?.role as any) : undefined),
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
  const operator = getCurrentOperator()
  if (!supabase) return null

  const { data, error } = await supabase.from("units").insert([unit]).select().single()

  if (error) {
    console.error("Error creating unit:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_unit",
        targetType: "system",
        targetId: unit.unit_code,
        reason: error.message,
        afterState: unit as Record<string, any>,
        additionalData: { module: "residents", status: "failed", error_code: error.message },
      })
    }
    return null
  }
  if (operator.id && data?.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "create_unit",
      targetType: "system",
      targetId: data.id,
      reason: unit.unit_code,
      afterState: unit as Record<string, any>,
      additionalData: { module: "residents", status: "success" },
    })
  }
  return data
}

export async function updateUnit(id: string, updates: Partial<Unit>): Promise<Unit | null> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) return null

  const { data, error } = await supabase.from("units").update(updates).eq("id", id).select().single()

  if (error) {
    console.error("Error updating unit:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_unit",
        targetType: "system",
        targetId: id,
        reason: error.message,
        afterState: updates as Record<string, any>,
        additionalData: { module: "residents", status: "failed", error_code: error.message },
      })
    }
    return null
  }
  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "update_unit",
      targetType: "system",
      targetId: id,
      reason: updates.unit_code || "更新單位",
      afterState: updates as Record<string, any>,
      additionalData: { module: "residents", status: "success" },
    })
  }
  return data
}

export async function deleteUnit(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) return false

  const { error } = await supabase.from("units").delete().eq("id", id)

  if (error) {
    console.error("Error deleting unit:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_unit",
        targetType: "system",
        targetId: id,
        reason: error.message,
        additionalData: { module: "residents", status: "failed", error_code: error.message },
      })
    }
    return false
  }
  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_unit",
      targetType: "system",
      targetId: id,
      reason: "刪除單位",
      additionalData: { module: "residents", status: "success" },
    })
  }
  return true
}
