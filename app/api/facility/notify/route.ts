import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type NotifyEvent = "booking_created" | "booking_cancelled"

interface NotifyRequestBody {
  eventType: NotifyEvent
  userId: string
  sendMode?: "test" | "official"
  payload?: {
    bookingId?: string
    facilityName?: string
    bookingDate?: string
    startTime?: string
    endTime?: string
    pointsSpent?: number
    refundAmount?: number
    feeAmount?: number
    remainingPoints?: number
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const dbKey = serviceRoleKey || anonKey

  if (!url || !dbKey) {
    throw new Error("Missing Supabase configuration: need URL and service role key or anon key")
  }

  return createClient(url, dbKey)
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

function toDateText(date?: string) {
  if (!date) return "-"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString("zh-TW")
}

function buildBookingCreatedFlex(name: string, payload: NotifyRequestBody["payload"] = {}) {
  return {
    type: "flex",
    altText: `🏢 設施預約成功：${payload.facilityName || "設施"}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F0FFF4",
        paddingAll: "14px",
        contents: [{ type: "text", text: "🏢 設施預約成功", weight: "bold", size: "lg", color: "#1DB446" }],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: `${name}您好，您的預約已成立。`, size: "sm", color: "#333333", wrap: true },
          { type: "separator", margin: "md" },
          { type: "text", text: `設施：${payload.facilityName || "設施"}`, size: "sm", color: "#333333", wrap: true },
          {
            type: "text",
            text: `時段：${toDateText(payload.bookingDate)} ${payload.startTime || "--:--"} - ${payload.endTime || "--:--"}`,
            size: "sm",
            color: "#333333",
            wrap: true,
          },
          { type: "text", text: `扣點：${Number(payload.pointsSpent || 0)} 點`, size: "sm", color: "#E67E22" },
          {
            type: "text",
            text: `剩餘點數：${Number(payload.remainingPoints || 0)} 點`,
            size: "sm",
            color: "#1DB446",
            weight: "bold",
          },
        ],
      },
    },
  }
}

function buildBookingCancelledFlex(name: string, payload: NotifyRequestBody["payload"] = {}) {
  return {
    type: "flex",
    altText: `↩️ 設施預約取消：${payload.facilityName || "設施"}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFF7ED",
        paddingAll: "14px",
        contents: [{ type: "text", text: "↩️ 設施預約已取消", weight: "bold", size: "lg", color: "#C2410C" }],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: `${name}您好，已為您取消預約。`, size: "sm", color: "#333333", wrap: true },
          { type: "separator", margin: "md" },
          { type: "text", text: `設施：${payload.facilityName || "設施"}`, size: "sm", color: "#333333", wrap: true },
          {
            type: "text",
            text: `時段：${toDateText(payload.bookingDate)} ${payload.startTime || "--:--"} - ${payload.endTime || "--:--"}`,
            size: "sm",
            color: "#333333",
            wrap: true,
          },
          { type: "text", text: `原扣點：${Number(payload.pointsSpent || 0)} 點`, size: "sm", color: "#666666" },
          { type: "text", text: `退還：${Number(payload.refundAmount || 0)} 點`, size: "sm", color: "#1DB446" },
          { type: "text", text: `手續費：${Number(payload.feeAmount || 0)} 點`, size: "sm", color: "#E11D48" },
          {
            type: "text",
            text: `剩餘點數：${Number(payload.remainingPoints || 0)} 點`,
            size: "sm",
            color: "#1DB446",
            weight: "bold",
          },
        ],
      },
    },
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NotifyRequestBody
    const { eventType, userId, payload, sendMode } = body || {}

    if (!eventType || !userId) {
      return NextResponse.json({ error: "Missing eventType or userId" }, { status: 400 })
    }

    const supabase = getSupabase()
    const client = getLineClient(sendMode)

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, line_user_id")
      .eq("id", userId)
      .maybeSingle()

    if (!profile?.line_user_id) {
      return NextResponse.json({ success: true, sent: false, message: "LINE 未綁定，略過通知" })
    }

    const residentName = profile.name || "住戶"
    const message =
      eventType === "booking_created"
        ? buildBookingCreatedFlex(residentName, payload)
        : buildBookingCancelledFlex(residentName, payload)

    await client.pushMessage(profile.line_user_id, message as any)

    return NextResponse.json({ success: true, sent: true })
  } catch (error: any) {
    console.error("[facility notify] error:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
