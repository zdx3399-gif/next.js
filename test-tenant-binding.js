import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://oyydhfvgtmghvnbkvczr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWRoZnZndG1naHZuYmt2Y3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1OTMwMTIsImV4cCI6MjA3MzE2OTAxMn0.fgz_Vl7bZ1rtrttOAQcTlymMgHfhiY2NDo3qEnBT1og"
)

// 查詢 鄭得諼 的資料
const { data: profile } = await supabase.from("profiles").select("*").eq("email", "tenant@test.com").single()

console.log("📄 Profiles 表中的資料:")
console.log("  Profile ID:", profile?.id)
console.log("  Email:", profile?.email)
console.log("  Name:", profile?.name)
console.log("  LINE User ID:", profile?.line_user_id)
console.log("  LINE Display Name:", profile?.line_display_name)

// 查詢 line_users 表中是否有這個 LINE ID
const { data: lineUser } = await supabase
  .from("line_users")
  .select("*")
  .eq("line_user_id", profile?.line_user_id)
  .single()

console.log("\n📱 LINE Users 表中的資料:")
if (lineUser) {
  console.log("  ✅ 找到!")
  console.log("  Line User ID:", lineUser.line_user_id)
  console.log("  Display Name:", lineUser.display_name)
  console.log("  Profile ID:", lineUser.profile_id)
} else {
  console.log("  ❌ 找不到! 這就是問題")
  console.log("  你的 line_user_id:", profile?.line_user_id)
  console.log("  需要在 line_users 表中補充這筆記錄")
}
