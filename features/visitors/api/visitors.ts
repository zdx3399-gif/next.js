import { getSupabaseClient } from "@/lib/supabase"

export interface Visitor {
  id: string
  name: string
  phone?: string
  purpose?: string
  reservation_time?: string
  checked_in_at?: string
  checked_out_at?: string
  status: "reserved" | "checked_in" | "checked_out"
  created_at: string
  unit_id?: string
  reserved_by_id?: string
  room?: string
  reserved_by?: string
  reserved_by_name?: string
}

export interface VisitorReservation {
  name: string
  phone: string
  purpose: string
  reservation_time: string
}

export async function fetchVisitors(room?: string | null, isAdmin?: boolean, userUnitId?: string): Promise<Visitor[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("visitors")
    .select(`
      id, name, phone, purpose, reservation_time, checked_in_at, checked_out_at, 
      status, created_at, unit_id, reserved_by_id,
      units ( id, unit_code, building, floor, room_number )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching visitors:", error)
    return []
  }

  const visitors: Visitor[] = (data || []).map((v: any) => {
    const unit = v.units
    return {
      id: v.id,
      name: v.name,
      phone: v.phone,
      purpose: v.purpose,
      reservation_time: v.reservation_time,
      checked_in_at: v.checked_in_at,
      checked_out_at: v.checked_out_at,
      status: v.status,
      created_at: v.created_at,
      unit_id: v.unit_id,
      reserved_by_id: v.reserved_by_id,
      room: unit?.unit_code || "",
    }
  })

  if (!isAdmin && userUnitId) {
    return visitors.filter((v) => v.unit_id === userUnitId)
  }

  if (room && !isAdmin) {
    return visitors.filter((v) => v.room === room)
  }

  return visitors
}

export async function createVisitorReservation(
  reservation: VisitorReservation,
  room: string,
  reservedBy: string,
  unitId?: string,
  reservedById?: string,
): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase not configured")

  const insertData: Record<string, unknown> = {
    name: reservation.name,
    phone: reservation.phone,
    purpose: reservation.purpose,
    reservation_time: reservation.reservation_time,
    status: "reserved",
  }

  if (unitId) {
    insertData.unit_id = unitId
  }

  if (reservedById) {
    insertData.reserved_by_id = reservedById
  }

  const { error } = await supabase.from("visitors").insert([insertData])

  if (error) {
    console.error("Error creating reservation:", error)
    throw error
  }
}

export async function checkInVisitor(visitorId: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase not configured")

  const { error } = await supabase
    .from("visitors")
    .update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
    })
    .eq("id", visitorId)

  if (error) {
    console.error("Error checking in visitor:", error)
    throw error
  }
}

export async function checkOutVisitor(visitorId: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase not configured")

  const { error } = await supabase
    .from("visitors")
    .update({
      status: "checked_out",
      checked_out_at: new Date().toISOString(),
    })
    .eq("id", visitorId)

  if (error) {
    console.error("Error checking out visitor:", error)
    throw error
  }
}

export function getReservedByName(visitor: Visitor): string {
  return visitor.reserved_by_name || visitor.reserved_by || ""
}

export function getRoom(visitor: Visitor): string {
  return visitor.room || ""
}
