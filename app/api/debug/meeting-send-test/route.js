import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY")
  }
  return createClient(url, serviceRoleKey || anonKey)
}

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const channelSecret = process.env.LINE_CHANNEL_SECRET

  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET")
  }
  return new Client({ channelAccessToken, channelSecret })
}

export async function GET(req) {
  try {
    const supabase = getSupabase()
    const client = getLineClient()

    const result = {
      started: new Date().toISOString(),
      steps: [],
    }

    // Step 1: 取最新會議
    result.steps.push("Step 1: 取最新會議...")
    const { data: meetings, error: meetingError } = await supabase
      .from("meetings")
      .select("id, topic, time, location, key_takeaways, notes, pdf_file_url")
      .order("created_at", { ascending: false })
      .limit(1)

    if (meetingError) {
      result.steps.push(`❌ 會議查詢失敗: ${meetingError.message}`)
      return Response.json(result)
    }

    if (!meetings || meetings.length === 0) {
      result.steps.push("❌ 沒有會議記錄")
      return Response.json(result)
    }

    const meeting = meetings[0]
    result.steps.push(`✅ 找到會議: ${meeting.topic}`)
    result.meeting = meeting

    // Step 2: 取 LINE 用戶
    result.steps.push("Step 2: 取 LINE 用戶...")
    const { data: lineUsers, error: lineError } = await supabase
      .from("line_users")
      .select("line_user_id, display_name")

    if (lineError) {
      result.steps.push(`❌ LINE 用戶查詢失敗: ${lineError.message}`)
      return Response.json(result)
    }

    if (!lineUsers || lineUsers.length === 0) {
      result.steps.push("❌ 沒有 LINE 用戶")
      return Response.json(result)
    }

    result.steps.push(`✅ 找到 ${lineUsers.length} 個 LINE 用戶`)
    result.lineUsers = lineUsers

    // Step 3: 建立 Flex Message
    result.steps.push("Step 3: 建立 Flex Message...")
    const formatDate = new Date(meeting.time).toLocaleString("zh-TW", { hour12: false })
    const takeawaysText =
      meeting.key_takeaways && Array.isArray(meeting.key_takeaways)
        ? meeting.key_takeaways.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
        : []

    const flexMessage = {
      type: "flex",
      altText: `📢 會議紀錄：${meeting.topic}`,
      contents: {
        type: "bubble",
        hero: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "📢 會議紀錄通知",
              weight: "bold",
              size: "xl",
              color: "#ffffff",
            },
          ],
          backgroundColor: "#6c2166",
          paddingAll: "20px",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: meeting.topic,
              size: "lg",
              weight: "bold",
              color: "#1db446",
              margin: "md",
            },
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "text",
              text: `🕒 ${formatDate}`,
              size: "sm",
              color: "#666666",
              margin: "md",
            },
            {
              type: "text",
              text: `📍 ${meeting.location}`,
              size: "sm",
              color: "#666666",
              margin: "sm",
            },
            ...(takeawaysText.length > 0
              ? [
                  {
                    type: "separator",
                    margin: "md",
                  },
                  {
                    type: "text",
                    text: "📌 重點摘要",
                    weight: "bold",
                    size: "sm",
                    color: "#1db446",
                    margin: "md",
                  },
                  ...takeawaysText.slice(0, 5).map((item) => ({
                    type: "text",
                    text: `• ${item}`,
                    size: "xs",
                    color: "#666666",
                    margin: "xs",
                  })),
                ]
              : []),
          ],
        },
      },
    }

    result.steps.push("✅ Flex Message 建立成功")

    // Step 4: 發送通知
    result.steps.push("Step 4: 發送通知給所有用戶...")
    let successCount = 0
    let failureCount = 0
    const failures = []

    for (const lineUser of lineUsers) {
      try {
        await client.pushMessage(lineUser.line_user_id, flexMessage)
        successCount++
        result.steps.push(`✅ 發送給 ${lineUser.display_name}`)
      } catch (pushError) {
        failureCount++
        failures.push({
          user: lineUser.display_name,
          error: pushError.message,
        })
        result.steps.push(`❌ 發送給 ${lineUser.display_name} 失敗: ${pushError.message}`)
      }
    }

    result.sendResult = {
      success: successCount,
      failed: failureCount,
      total: lineUsers.length,
      failures,
    }

    result.completed = new Date().toISOString()
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