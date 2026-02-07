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

// POST: 發送會議 LINE 通知給所有綁定用戶
export async function POST(req) {
  try {
    const supabase = getSupabase()
    const client = getLineClient()

    const body = await req.json()
    const { meeting } = body

    if (!meeting || !meeting.topic) {
      return Response.json({ error: "Missing meeting data" }, { status: 400 })
    }

    const { topic, time, location, key_takeaways, notes, pdf_file_url } = meeting

    // 取得所有綁定的 LINE 用戶
    const { data: lineUsers, error: lineError } = await supabase
      .from("line_users")
      .select("line_user_id, display_name")

    if (lineError || !lineUsers || lineUsers.length === 0) {
      console.log("[Meeting Notify] No LINE users found")
      return Response.json({ success: true, sent: 0, message: "No LINE users to notify" })
    }

    // 建立 Flex Message
    const formatDate = new Date(time).toLocaleString("zh-TW", { hour12: false })
    const takeawaysText =
      key_takeaways && key_takeaways.length > 0
        ? key_takeaways.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
        : []

    const flexMessage = {
      type: "flex",
      altText: `📢 會議紀錄：${topic}`,
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
              text: topic,
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
              text: `📍 ${location}`,
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
            ...(notes
              ? [
                  {
                    type: "separator",
                    margin: "md",
                  },
                  {
                    type: "text",
                    text: "📝 備註",
                    weight: "bold",
                    size: "sm",
                    color: "#1db446",
                    margin: "md",
                  },
                  {
                    type: "text",
                    text: notes.substring(0, 100),
                    size: "xs",
                    color: "#666666",
                    wrap: true,
                    margin: "sm",
                  },
                ]
              : []),
            ...(pdf_file_url
              ? [
                  {
                    type: "separator",
                    margin: "md",
                  },
                  {
                    type: "button",
                    action: {
                      type: "uri",
                      label: "📄 下載完整會議紀錄",
                      uri: pdf_file_url,
                    },
                    style: "link",
                    color: "#17c950",
                    margin: "md",
                  },
                ]
              : []),
          ],
        },
      },
    }

    // 發送給所有綁定的住戶
    let successCount = 0
    let failureCount = 0

    for (const lineUser of lineUsers) {
      try {
        await client.pushMessage(lineUser.line_user_id, flexMessage)
        successCount++
      } catch (pushError) {
        console.error(`[Meeting Notify] Failed to send to ${lineUser.display_name}:`, pushError)
        failureCount++
      }
    }

    console.log(
      `[Meeting Notify] Notifications sent: ${successCount} success, ${failureCount} failed out of ${lineUsers.length} users`,
    )

    return Response.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: lineUsers.length,
    })
  } catch (err) {
    console.error("[Meeting Notify] error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}