import { NextResponse } from "next/server"
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

function getNotificationToken(sendMode?: "test" | "official") {
  const mode = sendMode || process.env.LINE_BOT_NOTIFICATION_MODE || "official"
  return mode === "test"
    ? (process.env.LINE_CHANNEL_ACCESS_TOKEN_BOT2 || process.env.LINE_CHANNEL_ACCESS_TOKEN)
    : process.env.LINE_CHANNEL_ACCESS_TOKEN
}

function getLineClient(sendMode?: "test" | "official") {
  const channelAccessToken = getNotificationToken(sendMode)
  const channelSecret = process.env.LINE_CHANNEL_SECRET

  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET")
  }

  return new Client({ channelAccessToken, channelSecret })
}

export async function POST(req: Request) {
  try {
    const { maintenanceId, sendMode } = (await req.json()) as {
      maintenanceId?: string
      sendMode?: "test" | "official"
    }

    if (!maintenanceId) {
      return NextResponse.json({ error: "Missing maintenanceId" }, { status: 400 })
    }

    const supabase = getSupabase()
    const client = getLineClient(sendMode)

    const { data: maintenance } = await supabase
      .from("maintenance")
      .select("id, equipment, item, description, reported_by_id, created_at")
      .eq("id", maintenanceId)
      .maybeSingle()

    if (!maintenance?.reported_by_id) {
      return NextResponse.json({ success: true, sent: false, message: "找不到報修住戶" })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, line_user_id")
      .eq("id", maintenance.reported_by_id)
      .maybeSingle()

    if (!profile?.line_user_id) {
      return NextResponse.json({ success: true, sent: false, message: "住戶未綁定 LINE" })
    }

    const residentName = profile.name || "住戶"
    const createdText = maintenance.created_at
      ? new Date(maintenance.created_at).toLocaleString("zh-TW", { hour12: false })
      : new Date().toLocaleString("zh-TW", { hour12: false })

    const flexMessage = {
      type: "flex",
      altText: `🧾 報修申請已建立：M-${String(maintenance.id).slice(0, 8)}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#ECFDF3",
          paddingAll: "14px",
          contents: [{ type: "text", text: "🧾 報修申請已送出", weight: "bold", size: "lg", color: "#1DB446" }],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: `${residentName}您好，已收到您的報修申請。`, size: "sm", color: "#333333", wrap: true },
            { type: "separator", margin: "md" },
            { type: "text", text: `報修編號：M-${String(maintenance.id).slice(0, 8)}`, size: "sm", color: "#333333" },
            { type: "text", text: `設備類型：${maintenance.equipment || "未分類"}`, size: "sm", color: "#333333", wrap: true },
            { type: "text", text: `位置項目：${maintenance.item || "未填寫"}`, size: "sm", color: "#333333", wrap: true },
            {
              type: "text",
              text: `問題描述：${(maintenance.description || "").slice(0, 80) || "未填寫"}`,
              size: "sm",
              color: "#666666",
              wrap: true,
            },
            { type: "text", text: `申請時間：${createdText}`, size: "xs", color: "#888888", wrap: true },
            { type: "text", text: "目前狀態：待處理", size: "sm", color: "#E67E22", weight: "bold" },
          ],
        },
      },
    }

    await client.pushMessage(profile.line_user_id, flexMessage as any)

    return NextResponse.json({ success: true, sent: true })
  } catch (error: any) {
    console.error("[maintenance request notify] error:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
