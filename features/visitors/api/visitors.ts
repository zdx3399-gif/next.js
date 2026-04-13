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

export interface UpdateVisitorReservation extends VisitorReservation {
  id: string
}

function toIsoFromLocalDateTime(value: string): string {
  if (!value) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

export async function fetchVisitors(room?: string | null, isAdmin?: boolean, userUnitId?: string): Promise<Visitor[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("visitors")
    .select(`
      id, name, phone, purpose, reservation_time, checked_in_at, checked_out_at, 
      status, created_at, unit_id, reserved_by_id,
      units ( id, unit_code, unit_number )
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
  const res = await fetch("/api/visitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: reservation.name,
      phone: reservation.phone,
      purpose: reservation.purpose,
      reservation_time: toIsoFromLocalDateTime(reservation.reservation_time),
      unit_id: unitId,
      reserved_by: reservedBy,
      reserved_by_id: reservedById,
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    console.error("Error creating reservation:", error)
    throw new Error(error.error || "Failed to create reservation")
  }
}

export async function checkInVisitor(visitorId: string): Promise<void> {
  const res = await fetch("/api/visitor", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitor_id: visitorId,
      action: "check_in",
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    console.error("Error checking in visitor:", error)
    throw new Error(error.error || "Failed to check in visitor")
  }
}

export async function checkOutVisitor(visitorId: string): Promise<void> {
  const res = await fetch("/api/visitor", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitor_id: visitorId,
      action: "check_out",
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    console.error("Error checking out visitor:", error)
    throw new Error(error.error || "Failed to check out visitor")
  }
}

export async function updateVisitorReservation(
  reservation: UpdateVisitorReservation,
  actorId?: string,
  actorRole?: string,
): Promise<void> {
  const res = await fetch("/api/visitor", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitor_id: reservation.id,
      name: reservation.name,
      phone: reservation.phone,
      purpose: reservation.purpose,
      reservation_time: toIsoFromLocalDateTime(reservation.reservation_time),
      actor_id: actorId,
      actor_role: actorRole,
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error || "修改預約失敗")
  }
}

export async function deleteVisitorReservation(visitorId: string, actorId?: string, actorRole?: string): Promise<void> {
  const query = new URLSearchParams({
    visitor_id: visitorId,
    actor_id: actorId || "",
    actor_role: actorRole || "",
  })

  const res = await fetch(`/api/visitor?${query.toString()}`, {
    method: "DELETE",
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error || "刪除預約失敗")
  }
}

export function getReservedByName(visitor: Visitor): string {
  return visitor.reserved_by_name || visitor.reserved_by || ""
}

export function getRoom(visitor: Visitor): string {
  return visitor.room || ""
}
