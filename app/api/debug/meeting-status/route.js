import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    const client = new Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
    })

    const diagnostics = {
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
      },
      database: {
        meetingCount: 0,
        lineUserCount: 0,
      },
      lineTest: {
        success: false,
        message: "",
      },
    }

    // 檢查會議數量
    try {
      const { data: meetings, error: meetingError } = await supabase.from("meetings").select("id, topic, time")

      if (meetingError) {
        diagnostics.database.meetingError = meetingError.message
      } else {
        diagnostics.database.meetingCount = meetings?.length || 0
        diagnostics.database.meetings = meetings?.slice(0, 3)
      }
    } catch (e) {
      diagnostics.database.meetingError = e.message
    }

    // 檢查 LINE 用戶
    try {
      const { data: lineUsers, error: lineError } = await supabase.from("line_users").select("line_user_id, display_name")

      if (lineError) {
        diagnostics.database.lineError = lineError.message
      } else {
        diagnostics.database.lineUserCount = lineUsers?.length || 0
        diagnostics.database.lineUsers = lineUsers?.slice(0, 3)
      }
    } catch (e) {
      diagnostics.database.lineError = e.message
    }

    // 嘗試發送測試通知
    if (diagnostics.database.lineUserCount > 0 && diagnostics.env.hasLineToken) {
      try {
        const testUser = diagnostics.database.lineUsers[0]
        const testMessage = {
          type: "text",
          text: "✅ 會議通知診斷測試成功！",
        }

        await client.pushMessage(testUser.line_user_id, testMessage)
        diagnostics.lineTest.success = true
        diagnostics.lineTest.message = `成功發送測試訊息給 ${testUser.display_name}`
        diagnostics.lineTest.testUserId = testUser.line_user_id
      } catch (e) {
        diagnostics.lineTest.success = false
        diagnostics.lineTest.message = `LINE 推送失敗：${e.message}`
        diagnostics.lineTest.error = e.toString()
      }
    }

    return Response.json(diagnostics)
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: error.message,
        stack: error.toString(),
      },
      { status: 500 },
    )
  }
}