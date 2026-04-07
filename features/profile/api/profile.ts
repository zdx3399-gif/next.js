import { getSupabaseClient } from "@/lib/supabase"

export interface ProfileData {
  name: string
  unit_id?: string
  room?: string // 加入 room 欄位用於表單顯示
  phone: string
  email: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  line_avatar_url?: string
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
  emergency_contact_name?: string
  emergency_contact_phone?: string
  line_avatar_url?: string
}

export async function updateProfile(userId: string, data: ProfileData): Promise<User> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase not configured")

  const updateData: Record<string, string | undefined> = {
    name: data.name,
    phone: data.phone,
    email: data.email,
    emergency_contact_name: data.emergency_contact_name,
    emergency_contact_phone: data.emergency_contact_phone,
  }

  if (data.line_avatar_url !== undefined) {
    updateData.line_avatar_url = data.line_avatar_url
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
    emergency_contact_name: profile.emergency_contact_name || undefined,
    emergency_contact_phone: profile.emergency_contact_phone || undefined,
    line_avatar_url: profile.line_avatar_url || undefined,
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
    emergency_contact_name: data.emergency_contact_name || undefined,
    emergency_contact_phone: data.emergency_contact_phone || undefined,
    line_avatar_url: data.line_avatar_url || undefined,
  }
}

export async function uploadProfileAvatar(file: File): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  form.append("folder", "profile-avatars")

  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: form,
  })

  let payload: any = {}
  try {
    payload = await res.json()
  } catch {}

  if (!res.ok) {
    throw new Error(payload?.error || "頭像上傳失敗")
  }
  if (!payload?.url) {
    throw new Error("頭像上傳失敗：未收到圖片網址")
  }
  return payload.url
}

export async function getBoundLineAvatarUrl(userId: string): Promise<string> {
  const supabase = getSupabaseClient()
  if (!supabase) return ""

  const { data, error } = await supabase
    .from("line_users")
    .select("avatar_url")
    .eq("profile_id", userId)
    .maybeSingle()

  if (error) {
    console.warn("[Profile] 無法取得 LINE 頭貼:", error.message)
    return ""
  }

  return data?.avatar_url || ""
}

export async function getUnits() {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("units").select("id, unit_code, unit_number").order("unit_number")

  if (error) throw error
  return data || []
}
