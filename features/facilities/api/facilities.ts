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
  user_name: string
  user_room?: string
  booking_date: string
  start_time: string
  end_time: string
  notes?: string
  status: "confirmed" | "cancelled"
  created_at?: string
  facilities?: { name: string }
}

// Get all available facilities
export async function getFacilities(): Promise<Facility[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("facilities").select("*").eq("available", true).order("name")

  if (error) throw error
  return data || []
}

// Get all facilities (for admin)
export async function getAllFacilities(): Promise<Facility[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("facilities").select("*").order("name")

  if (error) throw error
  return data || []
}

// Get user's bookings
export async function getUserBookings(userId: string): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("*, facilities(name)")
    .eq("user_id", userId)
    .order("booking_date", { ascending: false })

  if (error) throw error
  return data || []
}

// Get all bookings (for admin)
export async function getAllBookings(): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("*, facilities(name)")
    .order("booking_date", { ascending: false })

  if (error) throw error
  return data || []
}

// Check for booking conflicts
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

// Create a booking
export async function createBooking(booking: {
  facility_id: string
  user_id: string
  user_name: string
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

// Cancel a booking
export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facility_bookings").update({ status: "cancelled" }).eq("id", bookingId)

  if (error) throw error
}

// Admin: Create facility
export async function createFacility(facility: Omit<Facility, "id" | "created_at">): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facilities").insert([facility])
  if (error) throw error
}

// Admin: Update facility
export async function updateFacility(id: string, facility: Partial<Facility>): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facilities").update(facility).eq("id", id)
  if (error) throw error
}

// Admin: Delete facility
export async function deleteFacility(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facilities").delete().eq("id", id)
  if (error) throw error
}

// Admin: Upload facility image
export async function uploadFacilityImage(file: File): Promise<string> {
  const supabase = getSupabaseClient()
  const fileName = `facility_${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from("facilities").upload(fileName, file)
  if (error) throw error

  const { data: urlData } = supabase.storage.from("facilities").getPublicUrl(fileName)
  return urlData.publicUrl
}
