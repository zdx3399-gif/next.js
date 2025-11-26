import { getSupabaseClient } from "@/lib/supabase"

export interface ProfileData {
  name: string
  room: string
  phone: string
  email: string
  password?: string
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  room: string
  role: string
  status: string
}

export async function updateProfile(userId: string, data: ProfileData): Promise<User> {
  const supabase = getSupabaseClient()

  const updateData: Record<string, string> = {
    name: data.name,
    room: data.room,
    phone: data.phone,
    email: data.email,
  }

  if (data.password) {
    updateData.password = data.password
  }

  const { error } = await supabase.from("profiles").update(updateData).eq("id", userId)

  if (error) throw error

  return {
    id: userId,
    name: data.name,
    email: data.email,
    phone: data.phone,
    room: data.room,
    role: "",
    status: "active", // 加入預設 status
  }
}
