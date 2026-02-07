import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://oyydhfvgtmghvnbkvczr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWRoZnZndG1naHZuYmt2Y3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1OTMwMTIsImV4cCI6MjA3MzE2OTAxMn0.fgz_Vl7bZ1rtrttOAQcTlymMgHfhiY2NDo3qEnBT1og"
)

async function testLineUsersDetail() {
  try {
    // 所有 LINE 用戶
    const { data: lineUsersRaw, error: lineError } = await supabase
      .from("line_users")
      .select("line_user_id, display_name, profile_id")

    console.log("\n📱 LINE 綁定用戶:")
    console.log(`共 ${lineUsersRaw?.length || 0} 個`)
    if (lineUsersRaw) {
      lineUsersRaw.forEach((user) => {
        console.log(`  - ${user.display_name} (${user.line_user_id}) - profile_id: ${user.profile_id}`)
      })
    }

    // 所有個人資料 with LINE
    const { data: profilesWithLine } = await supabase
      .from("profiles")
      .select("id, name, unit_id, line_user_id, email")
      .not("line_user_id", "is", null)

    console.log("\n👤 個人資料中有 LINE 的住戶:")
    console.log(`共 ${profilesWithLine?.length || 0} 個`)
    if (profilesWithLine) {
      profilesWithLine.forEach((profile) => {
        console.log(`  - ${profile.name} (${profile.email}) - unit_id: ${profile.unit_id}`)
      })
    }

    // 所有個人資料 WITHOUT LINE
    const { data: profilesWithoutLine } = await supabase
      .from("profiles")
      .select("id, name, unit_id, email")
      .is("line_user_id", null)

    console.log("\n❌ 個人資料中沒有 LINE 的住戶 (未綁定):")
    console.log(`共 ${profilesWithoutLine?.length || 0} 個`)
    if (profilesWithoutLine) {
      profilesWithoutLine.slice(0, 10).forEach((profile) => {
        console.log(`  - ${profile.name} (${profile.email}) - unit_id: ${profile.unit_id}`)
      })
      if (profilesWithoutLine.length > 10) {
        console.log(`  ... 還有 ${profilesWithoutLine.length - 10} 個未顯示`)
      }
    }

    // 統計
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, line_user_id")

    console.log("\n📊 統計:")
    console.log(`  - 總 profiles: ${allProfiles?.length}`)
    console.log(`  - 有 LINE: ${allProfiles?.filter((p) => p.line_user_id).length}`)
    console.log(`  - 無 LINE: ${allProfiles?.filter((p) => !p.line_user_id).length}`)
  } catch (error) {
    console.error("❌ 錯誤:", error.message)
  }
}

testLineUsersDetail()
