import { getSupabaseClient } from "@/lib/supabase"

export interface ProfileData {
  name: string
  unit_id?: string
  room?: string // 加入 room 欄位用於表單顯示
  phone: string
  email: string
  password?: string
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: string
  unit_id?: string
  room?: string // 顯示用，從 units.unit_code 來
  unit_number?: string
  ping_size?: number
  car_spots?: number
  moto_spots?: number
  monthly_fee?: number
}

export async function updateProfile(userId: string, data: ProfileData): Promise<User> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase not configured")

  const updateData: Record<string, string | undefined> = {
    name: data.name,
    phone: data.phone,
    email: data.email,
  }

  if (data.unit_id) {
    updateData.unit_id = data.unit_id
  }

  if (data.password) {
    updateData.password = data.password
  }

  const { error } = await supabase.from("profiles").update(updateData).eq("id", userId)

  if (error) throw error

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select(`
      *,
      units ( id, unit_code, unit_number, ping_size, car_spots, moto_spots, monthly_fee )
    `)
    .eq("id", userId)
    .single()

  if (fetchError) throw fetchError

  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role || "",
    status: profile.status || "active",
    unit_id: profile.unit_id,
    room: profile.units?.unit_code || "",
    unit_number: profile.units?.unit_number,
    ping_size: profile.units?.ping_size,
    car_spots: profile.units?.car_spots,
    moto_spots: profile.units?.moto_spots,
    monthly_fee: profile.units?.monthly_fee,
  }
}

export async function getProfile(userId: string): Promise<User | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      *,
      units ( id, unit_code, unit_number, ping_size, car_spots, moto_spots, monthly_fee )
    `)
    .eq("id", userId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    status: data.status,
    unit_id: data.unit_id,
    room: data.units?.unit_code || "",
    unit_number: data.units?.unit_number,
    ping_size: data.units?.ping_size,
    car_spots: data.units?.car_spots,
    moto_spots: data.units?.moto_spots,
    monthly_fee: data.units?.monthly_fee,
  }
}

export async function getUnits() {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("units").select("id, unit_code, unit_number").order("unit_number")

  if (error) throw error
  return data || []
}
