import { getSupabaseClient } from "@/lib/supabase"

export interface FinanceRecord {
  id: string
  amount: number
  due: string
  invoice?: string | null
  paid: boolean
  paid_at?: string | null
  note?: string | null
  created_at?: string
  unit_id?: string
  room?: string
  ping_size?: number
  car_spots?: number
  moto_spots?: number
  monthly_fee?: number
}

export async function fetchAllFinanceRecords(): Promise<FinanceRecord[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("fees").select("*").order("due", { ascending: false })

  if (error) {
    console.error("Error fetching finance records:", error)
    return []
  }

  if (!data || data.length === 0) return []

  const unitIds = [...new Set(data.filter((f) => f.unit_id).map((f) => f.unit_id))]

  let unitsMap: Record<string, any> = {}
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("units")
      .select("id, unit_code, unit_number, ping_size, monthly_fee, car_spots, moto_spots")
      .in("id", unitIds)
    if (units) {
      unitsMap = Object.fromEntries(units.map((u) => [u.id, u]))
    }
  }

  return data.map((f: any) => {
    const unit = f.unit_id ? unitsMap[f.unit_id] : null
    return {
      id: f.id,
      amount: f.amount,
      due: f.due,
      invoice: f.invoice,
      paid: f.paid,
      paid_at: f.paid_at,
      note: f.note,
      created_at: f.created_at,
      unit_id: f.unit_id,
      room: unit?.unit_code || "-",
      ping_size: unit?.ping_size || 0,
      car_spots: unit?.car_spots || 0,
      moto_spots: unit?.moto_spots || 0,
      monthly_fee: unit?.monthly_fee || 0,
    }
  })
}

export async function fetchUserFinanceRecords(room: string, userUnitId?: string): Promise<FinanceRecord[]> {
  const records = await fetchAllFinanceRecords()

  if (userUnitId) {
    return records.filter((f) => f.unit_id === userUnitId)
  }

  return records.filter((f) => f.room === room)
}

export async function fetchFinanceRecordsByRoom(room: string): Promise<FinanceRecord[]> {
  return fetchUserFinanceRecords(room)
}

export async function createFinanceRecord(
  record: Omit<FinanceRecord, "id" | "created_at">,
): Promise<{ success: boolean; error?: string; data?: FinanceRecord }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, error: "Supabase not configured" }

  const insertData: Record<string, unknown> = {
    amount: record.amount,
    due: record.due,
    paid: record.paid,
    invoice: record.invoice,
    note: record.note,
  }

  if (record.unit_id) {
    insertData.unit_id = record.unit_id
  }

  const { data, error } = await supabase.from("fees").insert([insertData]).select().single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function updateFinanceRecord(
  id: string,
  updates: Partial<FinanceRecord>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, error: "Supabase not configured" }

  console.log("[v0] updateFinanceRecord called with:", { id, updates })

  const { room, ping_size, car_spots, moto_spots, monthly_fee, unit_id, ...safeUpdates } = updates

  if (monthly_fee !== undefined && unit_id) {
    console.log("[v0] Updating unit monthly_fee:", { unit_id, monthly_fee })
    const { error: unitError } = await supabase.from("units").update({ monthly_fee }).eq("id", unit_id)

    if (unitError) {
      console.error("[v0] Error updating unit monthly_fee:", unitError)
      return { success: false, error: unitError.message }
    }
    console.log("[v0] Unit monthly_fee updated successfully")
  }

  console.log("[v0] Updating fees table with:", safeUpdates)
  const { error } = await supabase.from("fees").update(safeUpdates).eq("id", id)

  if (error) {
    console.error("[v0] Error updating fees:", error)
    return { success: false, error: error.message }
  }

  console.log("[v0] Fees updated successfully")
  return { success: true }
}

export async function deleteFinanceRecord(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const { error } = await supabase.from("fees").delete().eq("id", id)

  if (error) {
    console.error("Error deleting finance record:", error)
    return false
  }

  return true
}

export function getRoomDisplay(record: FinanceRecord): string {
  return record.room || ""
}

export function getPingSize(record: FinanceRecord): number {
  return record.ping_size ?? 0
}

export function getCarSpots(record: FinanceRecord): number {
  return record.car_spots ?? 0
}

export function getMotoSpots(record: FinanceRecord): number {
  return record.moto_spots ?? 0
}
