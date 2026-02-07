import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    channelSecret: process.env.LINE_CHANNEL_SECRET!,
  })

  try {
    // 測試預約通知
    const flexMessage = {
      type: "flex",
      altText: "👤 訪客預約通知 - 測試用戶",
      contents: {
        type: "bubble",
        hero: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "👤 訪客預約通知",
              weight: "bold",
              size: "xl",
              color: "#ffffff",
            },
          ],
          backgroundColor: "#0084ff",
          paddingAll: "20px",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "訪客：張三",
              margin: "md",
              size: "md",
              weight: "bold",
            },
            {
              type: "text",
              text: "電話：0912345678",
              margin: "sm",
              color: "#666666",
            },
            { type: "separator", margin: "md" },
            {
              type: "text",
              text: "到訪目的：拜訪朋友",
              margin: "md",
              color: "#333333",
            },
            {
              type: "text",
              text: `預約時間：${new Date().toLocaleString("zh-TW", { hour12: false })}`,
              margin: "sm",
              color: "#666666",
              size: "sm",
            },
            { type: "separator", margin: "md" },
            {
              type: "text",
              text: "訪客將在此時間到達管理室簽到",
              margin: "md",
              color: "#0084ff",
              weight: "bold",
              align: "center",
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
      message: "Test visitor reservation notification sent",
      lineUserId,
    })
  } catch (error: any) {
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
