import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

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
  try {
    const response = await fetch("/api/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: record.room,
        amount: record.amount,
        due: record.due,
        invoice: record.invoice,
        paid: record.paid,
        note: record.note,
        unit_id: record.unit_id,
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      return { success: false, error: payload?.error || "建立管理費失敗" }
    }

    return { success: true, data: payload.record }
  } catch (err: any) {
    return { success: false, error: err?.message || "建立管理費失敗" }
  }
}

export async function updateFinanceRecord(
  id: string,
  updates: Partial<FinanceRecord>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) return { success: false, error: "Supabase not configured" }

  console.log("[v0] updateFinanceRecord called with:", { id, updates })

  const { room, ping_size, car_spots, moto_spots, monthly_fee, unit_id, ...safeUpdates } = updates

  if (monthly_fee !== undefined && unit_id) {
    console.log("[v0] Updating unit monthly_fee:", { unit_id, monthly_fee })
    const { error: unitError } = await supabase.from("units").update({ monthly_fee }).eq("id", unit_id)

    if (unitError) {
      console.error("[v0] Error updating unit monthly_fee:", unitError)
      if (operator.id) {
        await createAuditLog({
          operatorId: operator.id,
          operatorRole: operator.role,
          actionType: "update_finance_record",
          targetType: "system",
          targetId: unit_id,
          reason: unitError.message,
          additionalData: { module: "finance", status: "failed", error_code: unitError.message },
        })
      }
      return { success: false, error: unitError.message }
    }
    console.log("[v0] Unit monthly_fee updated successfully")
  }

  console.log("[v0] Updating fees table with:", safeUpdates)
  const { error } = await supabase.from("fees").update(safeUpdates).eq("id", id)

  if (error) {
    console.error("[v0] Error updating fees:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_finance_record",
        targetType: "system",
        targetId: id,
        reason: error.message,
        afterState: safeUpdates,
        additionalData: { module: "finance", status: "failed", error_code: error.message },
      })
    }
    return { success: false, error: error.message }
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "update_finance_record",
      targetType: "system",
      targetId: id,
      reason: "更新財務紀錄",
      afterState: { ...safeUpdates, monthly_fee, unit_id },
      additionalData: { module: "finance", status: "success" },
    })
  }

  console.log("[v0] Fees updated successfully")
  return { success: true }
}

export async function deleteFinanceRecord(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) return false

  const { error } = await supabase.from("fees").delete().eq("id", id)

  if (error) {
    console.error("Error deleting finance record:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_finance_record",
        targetType: "system",
        targetId: id,
        reason: error.message,
        additionalData: { module: "finance", status: "failed", error_code: error.message },
      })
    }
    return false
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_finance_record",
      targetType: "system",
      targetId: id,
      reason: "刪除財務紀錄",
      additionalData: { module: "finance", status: "success" },
    })
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
