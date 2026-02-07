import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://oyydhfvgtmghvnbkvczr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6ImFub24iLCJpYXQiOjE3NTc1OTMwMTIsImV4cCI6MjA3MzE2OTAxMn0.fgz_Vl7bZ1rtrttOAQcTlymMgHfhiY2NDo3qEnBT1og"
)

try {
  // 取得 profile 資訊
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", "tenant@test.com")
    .single()

  console.log("📝 準備插入到 line_users 表...")

  // 插入到 line_users
  const { data, error } = await supabase.from("line_users").insert({
    line_user_id: profile.line_user_id,
    display_name: profile.line_display_name,
    profile_id: profile.id,
    avatar_url: profile.line_avatar_url,
    status_message: profile.line_status_message,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.log("❌ 插入失敗:", error.message)
    console.log("詳情:", error)
  } else {
    console.log("✅ 成功插入到 line_users 表!")
    console.log("  Line User ID:", profile.line_user_id)
    console.log("  Display Name:", profile.line_display_name)
    console.log("  Profile ID:", profile.id)
  }
} catch (error) {
  console.error("❌ 錯誤:", error.message)
}
