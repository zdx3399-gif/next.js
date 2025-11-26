import { getSupabaseClient } from "@/lib/supabase"

export interface Visitor {
  id: string
  name: string
  phone?: string
  room: string
  purpose?: string
  reservation_time?: string
  checked_in_at?: string
  checked_out_at?: string
  status: "reserved" | "checked_in" | "checked_out"
  reserved_by?: string
  created_at: string
}

export interface VisitorReservation {
  name: string
  phone: string
  purpose: string
  reservation_time: string
}

// 獲取訪客列表
export async function fetchVisitors(userRoom?: string | null, isAdmin?: boolean): Promise<Visitor[]> {
  const supabase = getSupabaseClient()
  let query = supabase.from("visitors").select("*")

  // 住戶只能看自己房號的訪客
  if (userRoom && !isAdmin) {
    query = query.eq("room", userRoom)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching visitors:", error)
    throw error
  }

  return data || []
}

// 預約訪客
export async function createVisitorReservation(
  reservation: VisitorReservation,
  room: string,
  reservedBy: string,
): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.from("visitors").insert([
    {
      name: reservation.name,
      phone: reservation.phone,
      room: room,
      purpose: reservation.purpose,
      reservation_time: reservation.reservation_time,
      status: "reserved",
      reserved_by: reservedBy,
    },
  ])

  if (error) {
    console.error("Error creating reservation:", error)
    throw error
  }
}

// 訪客簽到
export async function checkInVisitor(visitorId: string): Promise<void> {
  const supabase = getSupabaseClient()

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

// 訪客簽退
export async function checkOutVisitor(visitorId: string): Promise<void> {
  const supabase = getSupabaseClient()

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
