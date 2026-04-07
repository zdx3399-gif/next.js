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
    const { meeting, notificationType } = body

    if (!meeting || !meeting.topic) {
      return Response.json({ error: "Missing meeting data" }, { status: 400 })
    }

    const { topic, time, location, key_takeaways, notes, pdf_file_url } = meeting

    // 取得所有已綁定 LINE 的住戶（line_users 已整併至 profiles）
    const { data: lineUsers, error: lineError } = await supabase
      .from("profiles")
      .select("line_user_id, line_display_name, name")
      .not("line_user_id", "is", null)

    if (lineError || !lineUsers || lineUsers.length === 0) {
      console.log("[Meeting Notify] No LINE users found")
      return Response.json({ success: true, sent: 0, message: "No LINE users to notify" })
    }

    // 根據通知類型選擇不同的消息內容
    const isPdfUpdateNotification = notificationType === "pdf_added"
    const isHttpPdfUrl = typeof pdf_file_url === "string" && /^https?:\/\//i.test(pdf_file_url)

    const formatDate = new Date(time).toLocaleString("zh-TW", { hour12: false })
    const takeawaysText =
      key_takeaways && key_takeaways.length > 0
        ? key_takeaways.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
        : []

    // 為所有用戶建立 Flex Message
    const flexMessage = {
      type: "flex",
      altText: isPdfUpdateNotification ? `📎 會議紀錄更新：${topic}` : `📢 會議紀錄通知：${topic}`,
      contents: {
        type: "bubble",
        hero: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: isPdfUpdateNotification ? "📎 會議紀錄已更新" : "📢 會議紀錄通知",
              weight: "bold",
              size: "xl",
              color: "#ffffff",
            },
          ],
          backgroundColor: isPdfUpdateNotification ? "#0066ff" : "#6c2166",
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
            ...(takeawaysText.length > 0 && !isPdfUpdateNotification
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
            ...(notes && !isPdfUpdateNotification
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
            ...(isHttpPdfUrl
              ? [
                  {
                    type: "separator",
                    margin: "md",
                  },
                  {
                    type: "button",
                    action: {
                      type: "uri",
                      label: isPdfUpdateNotification ? "📄 查看更新的會議紀錄" : "📄 下載完整會議紀錄",
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

    // 建立要發送的消息（每位住戶共用同一組內容）
    const messages = [flexMessage]
    if (pdf_file_url) {
      if (isPdfUpdateNotification) {
        messages.push({
          type: "text",
          text: isHttpPdfUrl
            ? `✅ 會議記錄已準備就緒\n📥 長按此訊息可保存檔案連結\n🔗 ${pdf_file_url}`
            : "✅ 會議記錄已更新\n目前檔案為系統內嵌格式，請至住戶端會議詳情頁下載完整 PDF。",
        })
      } else {
        messages.push({
          type: "text",
          text: "📎 會議紀錄檔案已上傳，點擊上方「下載完整會議紀錄」按鈕取得 PDF。\n\n💡 您也可以長按此訊息分享給其他住戶或保存至相簿。",
        })
        if (isHttpPdfUrl) {
          messages.push({
            type: "text",
            text: `🔗 直接連結：${pdf_file_url}`,
          })
        }
      }
    }

    // 發送給所有綁定的住戶（批次並行，避免逐筆等待過久）
    let successCount = 0
    let failureCount = 0

    const BATCH_SIZE = 20
    for (let i = 0; i < lineUsers.length; i += BATCH_SIZE) {
      const batch = lineUsers.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((lineUser) => client.pushMessage(lineUser.line_user_id, messages)),
      )

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successCount++
          return
        }

        failureCount++
        const failedUser = batch[index]
        console.error(
          `[Meeting Notify] Failed to send to ${failedUser.line_display_name || failedUser.name}:`,
          result.reason,
        )
      })
    }

    console.log(
      `[Meeting Notify] Notifications sent: ${successCount} success, ${failureCount} failed out of ${lineUsers.length} users`,
    )

    const notifyTypeLabel = isPdfUpdateNotification ? "PDF 更新通知" : "會議紀錄通知"
    return Response.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: lineUsers.length,
      message: `${notifyTypeLabel}已發送給 ${successCount} 位住戶${pdf_file_url ? '（含檔案分享）' : ''}`,
    })
  } catch (err) {
    console.error("[Meeting Notify] error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}