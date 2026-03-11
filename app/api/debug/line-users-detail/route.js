import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

    const result = {
      timestamp: new Date().toISOString(),
      sections: [],
    }

    // 所有 LINE 用戶
    const { data: lineUsersRaw } = await supabase
      .from("line_users")
      .select("line_user_id, display_name, profile_id")

    result.sections.push({
      title: "📱 所有 LINE 綁定用戶",
      count: lineUsersRaw?.length || 0,
      data: lineUsersRaw || [],
    })

    // 有 profile_id 的 LINE 用戶
    const { data: lineUsersWithProfile } = await supabase
      .from("line_users")
      .select("line_users (line_user_id, display_name), profiles (id, name, unit_id)")
      .not("profile_id", "is", null)

    // 所有個人資料 with LINE
    const { data: profilesWithLine } = await supabase
      .from("profiles")
      .select("id, name, unit_id, line_user_id, line_display_name")
      .not("line_user_id", "is", null)

    result.sections.push({
      title: "👤 個人資料中有 LINE 的住戶",
      count: profilesWithLine?.length || 0,
      data: profilesWithLine || [],
    })

    // 所有戶簿成員（可能包含未綁定的住戶）
    const { data: allHouseholdMembers } = await supabase
      .from("household_members")
      .select("id, name, unit_id, profile_id, profiles (line_user_id, line_display_name)")

    result.sections.push({
      title: "👥 所有戶簿成員",
      count: allHouseholdMembers?.length || 0,
      lineBindingCount: allHouseholdMembers?.filter((m) => m.profiles?.line_user_id).length || 0,
      sample: allHouseholdMembers?.slice(0, 5) || [],
    })

    // 所有個人資料（用於尋找可能的重複或缺失）
    const { data: allProfiles } = await supabase.from("profiles").select("id, name, unit_id, line_user_id")

    result.sections.push({
      title: "📋 所有個人資料",
      count: allProfiles?.length || 0,
      lineBindingCount: allProfiles?.filter((p) => p.line_user_id).length || 0,
      noLineCount: allProfiles?.filter((p) => !p.line_user_id).length || 0,
    })

    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        error: error.message,
        stack: error.toString(),
      },
      { status: 500 },
    )
  }
}