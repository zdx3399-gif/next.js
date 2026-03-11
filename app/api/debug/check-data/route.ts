import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

    // 1. 檢查 units 表
    const { data: units } = await supabase.from("units").select("id, unit_code, unit_number").limit(10)

    // 2. 檢查 household_members 表
    const { data: members } = await supabase.from("household_members").select("id, name, unit_id, profile_id").limit(10)

    // 3. 檢查 profiles 表的 LINE 綁定狀態
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email, unit_id, line_user_id, line_display_name")
      .limit(10)

    // 4. 檢查 packages 表最近的包裹
    const { data: packages } = await supabase
      .from("packages")
      .select("id, courier, recipient_name, recipient_room, unit_id, status")
      .order("created_at", { ascending: false })
      .limit(5)

    return NextResponse.json({
      units: units || [],
      household_members: members || [],
      profiles: profiles || [],
      packages: packages || [],
      summary: {
        units_count: units?.length || 0,
        members_count: members?.length || 0,
        profiles_with_line: profiles?.filter((p) => p.line_user_id).length || 0,
        profiles_with_unit: profiles?.filter((p) => p.unit_id).length || 0,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
