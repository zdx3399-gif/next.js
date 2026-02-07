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

// 重試函數
async function retryPush(client, lineUserId, message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.pushMessage(lineUserId, message)
      return true
    } catch (e) {
      if (i === maxRetries - 1) throw e
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  return false
}

// POST: 新增會議記錄並發送通知
export async function POST(req) {
  try {
    const supabase = getSupabase()
    const client = getLineClient()

    const body = await req.json()
    const { topic, time, location, key_takeaways, notes, pdf_file_url, created_by } = body

    if (!topic || !time || !location) {
      return Response.json({ error: "Missing required fields: topic, time, location" }, { status: 400 })
    }

    // 新增會議到資料庫
    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert([
        {
          topic,
          time,
          location,
          key_takeaways: key_takeaways || [],
          notes: notes || "",
          pdf_file_url: pdf_file_url || "",
          created_by: created_by || null,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("[meeting] POST error:", error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    // 發送 LINE 通知給所有有綁定的住戶
    try {
      const { data: lineUsers } = await supabase.from("line_users").select("line_user_id, display_name")

      if (lineUsers && lineUsers.length > 0) {
        const formatDate = new Date(time).toLocaleString("zh-TW", { hour12: false })
        const takeawaysText =
          key_takeaways && key_takeaways.length > 0
            ? key_takeaways.map((t) => t.trim()).filter(Boolean)
            : []

        // 建立 Flex Message
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
                      ...takeawaysText.map((item) => ({
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
                        text: notes,
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
            await retryPush(client, lineUser.line_user_id, flexMessage, 2)
            successCount++
          } catch (pushError) {
            console.error(`[Meeting LINE] Failed to send to ${lineUser.display_name}:`, pushError)
            failureCount++
          }
        }

        console.log(
          `[Meeting LINE] Notifications sent: ${successCount} success, ${failureCount} failed out of ${lineUsers.length} users`,
        )
      }
    } catch (lineError) {
      console.error("[Meeting LINE] Failed to send notifications:", lineError)
      // 不要因為 LINE 通知失敗而中斷會議建立
    }

    return Response.json({ success: true, id: meeting.id })
  } catch (err) {
    console.error("[meeting] POST error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}