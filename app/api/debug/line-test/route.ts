import { NextRequest, NextResponse } from "next/server"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function sendLineMessage(lineUserId: string, message?: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const channelSecret = process.env.LINE_CHANNEL_SECRET

  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET")
  }

  if (!lineUserId) {
    throw new Error("line_user_id is required")
  }

  const client = new Client({ channelAccessToken, channelSecret })

  const payload = {
    type: "text",
    text: message || "LINE 推播測試",
  } as const

  console.log(`[LINE Test] Sending to: ${lineUserId}`)
  await client.pushMessage(lineUserId, payload)
  console.log(`[LINE Test] Success`)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const line_user_id = searchParams.get("line_user_id")
    const message = searchParams.get("message")

    await sendLineMessage(line_user_id || "", message || undefined)

    return NextResponse.json({ success: true, message: "推播成功" })
  } catch (error: any) {
    console.error("[LINE Test GET] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
        details: error?.response?.data || error.toString(),
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { line_user_id, message } = body

    await sendLineMessage(line_user_id, message)

    return NextResponse.json({ success: true, message: "推播成功" })
  } catch (error: any) {
    console.error("[LINE Test POST] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
        details: error?.response?.data || error.toString(),
      },
      { status: 500 },
    )
  }
}
