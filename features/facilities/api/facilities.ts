import { getSupabaseClient } from "@/lib/supabase"

export interface Facility {
  id: string
  name: string
  description?: string
  location?: string
  capacity?: number
  available: boolean
  image_url?: string
  created_at?: string
}

export interface FacilityBooking {
  id: string
  facility_id: string
  user_id: string
  unit_id?: string
  user_name?: string
  user_room?: string
  booking_date: string
  start_time: string
  end_time: string
  notes?: string
  status: "confirmed" | "cancelled"
  created_at?: string
  facilities?: { name: string }
}

export async function getFacilities(): Promise<Facility[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, description, location, capacity, available, image_url, created_at")
    .eq("available", true)
    .order("name")

  if (error) {
    console.error("Error fetching facilities:", error)
    return []
  }
  return data || []
}

export async function getAllFacilities(): Promise<Facility[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, description, location, capacity, available, image_url, created_at")
    .order("name")

  if (error) {
    console.error("Error fetching all facilities:", error)
    return []
  }
  return data || []
}

export async function getUserBookings(userId: string): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(`
      *,
      facilities(name),
      user:profiles!facility_bookings_user_id_fkey(name),
      unit:units!facility_bookings_unit_id_fkey(unit_code)
    `)
    .eq("user_id", userId)
    .order("booking_date", { ascending: false })

  if (error) {
    // Fallback
    const { data: fallbackData } = await supabase
      .from("facility_bookings")
      .select("*, facilities(name)")
      .eq("user_id", userId)
      .order("booking_date", { ascending: false })
    return fallbackData || []
  }

  return (data || []).map((item: any) => ({
    ...item,
    user_name: item.user?.name || "未知",
    user_room: item.unit?.unit_code || "未知",
  }))
}

export async function getAllBookings(): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(`
      *,
      facilities(name),
      user:profiles!facility_bookings_user_id_fkey(name),
      unit:units!facility_bookings_unit_id_fkey(unit_code)
    `)
    .order("booking_date", { ascending: false })

  if (error) {
    const { data: fallbackData } = await supabase
      .from("facility_bookings")
      .select("*, facilities(name)")
      .order("booking_date", { ascending: false })
    return fallbackData || []
  }

  return (data || []).map((item: any) => ({
    ...item,
    user_name: item.user?.name || "未知",
    user_room: item.unit?.unit_code || "未知",
  }))
}

export async function checkBookingConflicts(
  facilityId: string,
  bookingDate: string,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data: conflicts } = await supabase
    .from("facility_bookings")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("booking_date", bookingDate)
    .eq("status", "confirmed")

  if (conflicts && conflicts.length > 0) {
    const newStartTime = new Date(`1970-01-01T${startTime}:00`)
    const newEndTime = new Date(`1970-01-01T${endTime}:00`)

    return conflicts.some((booking) => {
      const existingStart = new Date(`1970-01-01T${booking.start_time}:00`)
      const existingEnd = new Date(`1970-01-01T${booking.end_time}:00`)
      return newStartTime < existingEnd && newEndTime > existingStart
    })
  }

  return false
}

export async function createBooking(booking: {
  facility_id: string
  user_id: string
  unit_id?: string
  user_name?: string
  user_room?: string
  booking_date: string
  start_time: string
  end_time: string
  notes?: string
}): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facility_bookings").insert([
    {
      ...booking,
      status: "confirmed",
    },
  ])

  if (error) throw error
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facility_bookings").update({ status: "cancelled" }).eq("id", bookingId)

  if (error) throw error
}

export async function createFacility(facility: Omit<Facility, "id" | "created_at">): Promise<void> {
  const supabase = getSupabaseClient()

  console.log("[v0] createFacility called with:", {
    ...facility,
    image_url: facility.image_url?.substring(0, 50) + "...",
  })

  const { error } = await supabase.from("facilities").insert([facility])

  if (error) {
    console.error("[v0] createFacility error:", error)
    throw error
  }

  console.log("[v0] createFacility success")
}

export async function updateFacility(id: string, facility: Partial<Facility>): Promise<void> {
  const supabase = getSupabaseClient()

  console.log("[v0] updateFacility called with:", {
    id,
    hasImageUrl: !!facility.image_url,
    image_url_length: facility.image_url?.length || 0,
  })

  const updateData: Record<string, any> = {}
  if (facility.name !== undefined) updateData.name = facility.name
  if (facility.description !== undefined) updateData.description = facility.description
  if (facility.location !== undefined) updateData.location = facility.location
  if (facility.capacity !== undefined) updateData.capacity = facility.capacity
  if (facility.available !== undefined) updateData.available = facility.available
  if (facility.image_url !== undefined) updateData.image_url = facility.image_url

  console.log("[v0] updateData keys:", Object.keys(updateData))

  const { data, error } = await supabase.from("facilities").update(updateData).eq("id", id).select()

  if (error) {
    console.error("[v0] updateFacility error:", error)
    throw error
  }

  console.log("[v0] updateFacility result data:", data)
  if (data && data[0]) {
    console.log("[v0] Saved image_url length:", data[0].image_url?.length || 0)
  }

  console.log("[v0] updateFacility success")
}

export async function deleteFacility(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facilities").delete().eq("id", id)
  if (error) throw error
}

export async function uploadFacilityImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      const maxSize = 400
      let width = img.width
      let height = img.height

      if (width > height && width > maxSize) {
        height = (height * maxSize) / width
        width = maxSize
      } else if (height > maxSize) {
        width = (width * maxSize) / height
        height = maxSize
      }

      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)

      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.5)
      console.log("[v0] Compressed image size:", compressedBase64.length, "bytes")

      if (compressedBase64.length > 500000) {
        const smallerBase64 = canvas.toDataURL("image/jpeg", 0.3)
        console.log("[v0] Re-compressed image size:", smallerBase64.length, "bytes")
        resolve(smallerBase64)
      } else {
        resolve(compressedBase64)
      }
    }

    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}

export function getUserName(booking: FacilityBooking): string {
  return booking.user_name || "未知"
}

export function getUserRoom(booking: FacilityBooking): string {
  return booking.user_room || "未知"
}
