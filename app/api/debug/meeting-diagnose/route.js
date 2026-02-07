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
      timestamp: new Date().toISOString(),
      env: {
        hasUrl: !!process.env.SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_ANON_KEY,
        hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
      },
      database: {
        lineUsers: [],
        latestMeetings: [],
        errors: [],
      },
      lineTest: {
        success: false,
        message: "",
        details: {},
      },
    }

    // 檢查 LINE 用戶
    try {
      const { data, error } = await supabase.from("line_users").select("line_user_id, display_name, profile_id")

      if (error) {
        diagnostics.database.errors.push(`LINE users query error: ${error.message}`)
      } else {
        diagnostics.database.lineUsers = data || []
        diagnostics.database.lineUserCount = data?.length || 0
      }
    } catch (e) {
      diagnostics.database.errors.push(`Line users exception: ${e.message}`)
    }

    // 檢查最新的會議
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, topic, time, location, key_takeaways, created_at")
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) {
        diagnostics.database.errors.push(`Meetings query error: ${error.message}`)
      } else {
        diagnostics.database.latestMeetings = (data || []).map((m) => ({
          ...m,
          created_at_parsed: new Date(m.created_at).toLocaleString("zh-TW"),
        }))
      }
    } catch (e) {
      diagnostics.database.errors.push(`Meetings exception: ${e.message}`)
    }

    // 嘗試發送測試訊息
    if (diagnostics.database.lineUserCount > 0) {
      try {
        const testUser = diagnostics.database.lineUsers[0]
        const testMessage = {
          type: "text",
          text: `✅ 會議通知診斷測試 - ${new Date().toLocaleTimeString("zh-TW")}`,
        }

        await client.pushMessage(testUser.line_user_id, testMessage)
        diagnostics.lineTest.success = true
        diagnostics.lineTest.message = `成功發送測試訊息給 ${testUser.display_name}`
        diagnostics.lineTest.details = {
          userId: testUser.line_user_id,
          displayName: testUser.display_name,
        }
      } catch (e) {
        diagnostics.lineTest.success = false
        diagnostics.lineTest.message = `LINE 推送失敗`
        diagnostics.lineTest.details = {
          error: e.message,
          errorType: e.constructor.name,
        }
      }
    } else {
      diagnostics.lineTest.message = "沒有 LINE 用戶可以測試"
    }

    return Response.json(diagnostics, { status: 200 })
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