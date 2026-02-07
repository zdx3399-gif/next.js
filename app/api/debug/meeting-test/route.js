import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  })

  try {
    // 測試會議通知
    const flexMessage = {
      type: "flex",
      altText: "📢 會議紀錄：2026年度社區大會",
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
              text: "2026年度社區大會",
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
              text: `🕒 ${new Date().toLocaleString("zh-TW", { hour12: false })}`,
              size: "sm",
              color: "#666666",
              margin: "md",
            },
            {
              type: "text",
              text: "📍 社區大會議室",
              size: "sm",
              color: "#666666",
              margin: "sm",
            },
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
            {
              type: "text",
              text: "• 預算審核 2026年社區維護費用",
              size: "xs",
              color: "#666666",
              margin: "xs",
            },
            {
              type: "text",
              text: "• 管委會改選及任期安排",
              size: "xs",
              color: "#666666",
              margin: "xs",
            },
            {
              type: "text",
              text: "• 公共設施更新案討論",
              size: "xs",
              color: "#666666",
              margin: "xs",
            },
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "button",
              action: {
                type: "uri",
                label: "📄 下載完整會議紀錄",
                uri: "https://example.com/meeting-2026.pdf",
              },
              style: "link",
              color: "#17c950",
              margin: "md",
            },
          ],
        },
      },
    }

    // 尋找第一個有 LINE 綁定的使用者
    const { data: lineUsers } = await supabase.from("line_users").select("line_user_id").limit(1).single()

    if (!lineUsers?.line_user_id) {
      return Response.json({
        status: "error",
        message: "No LINE user found in database",
      })
    }

    const lineUserId = lineUsers.line_user_id

    // 發送測試訊息
    await client.pushMessage(lineUserId, flexMessage)

    return Response.json({
      status: "success",
      message: "Test meeting notification sent",
      lineUserId,
    })
  } catch (error) {
    console.error("Error:", error)
    return Response.json(
      {
        status: "error",
        message: error.message,
      },
      { status: 500 },
    )
  }
}