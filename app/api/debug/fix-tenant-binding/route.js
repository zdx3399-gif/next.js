import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // 1. 獲取 tenant@test.com 的資料
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", "tenant@test.com")
      .single()

    if (profileError) {
      return Response.json({ error: "無法找到 tenant@test.com", details: profileError.message }, { status: 400 })
    }

    // 2. 檢查 line_users 表中是否已存在
    const { data: existingLineUser } = await supabase
      .from("line_users")
      .select("*")
      .eq("line_user_id", profile.line_user_id)
      .single()

    if (existingLineUser) {
      return Response.json({
        success: false,
        message: "記錄已存在於 line_users 表中",
        data: existingLineUser,
      })
    }

    // 3. 插入新記錄
    const { data: inserted, error: insertError } = await supabase
      .from("line_users")
      .insert({
        line_user_id: profile.line_user_id,
        display_name: profile.line_display_name || profile.name,
        profile_id: profile.id,
        avatar_url: profile.line_avatar_url,
        status_message: profile.line_status_message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()

    if (insertError) {
      return Response.json(
        {
          success: false,
          error: "插入失敗",
          details: insertError.message,
          code: insertError.code,
        },
        { status: 500 }
      )
    }

    // 4. 驗證插入成功
    const { data: verifyLineUser } = await supabase
      .from("line_users")
      .select("*")
      .eq("line_user_id", profile.line_user_id)
      .single()

    return Response.json({
      success: true,
      message: "✅ 已成功修復! 鄭得諼現在會收到會議通知",
      profile: {
        name: profile.name,
        email: profile.email,
        lineUserId: profile.line_user_id,
        displayName: profile.line_display_name,
      },
      lineUserBinding: verifyLineUser,
      nextSteps: [
        "1. 重新整理瀏覽器 (Ctrl+R)",
        "2. 重新建立一個會議或編輯現有會議",
        "3. 你應該會收到 LINE 通知",
      ],
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
        stack: error.toString(),
      },
      { status: 500 }
    )
  }
}
