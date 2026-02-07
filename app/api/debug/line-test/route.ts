import { NextRequest, NextResponse } from "next/server"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { line_user_id, message } = await req.json()

    if (!line_user_id) {
      return NextResponse.json({ error: "line_user_id is required" }, { status: 400 })
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const channelSecret = process.env.LINE_CHANNEL_SECRET

    if (!channelAccessToken || !channelSecret) {
      return NextResponse.json(
        { error: "Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET" },
        { status: 500 },
      )
    }

    const client = new Client({ channelAccessToken, channelSecret })

    const payload = {
      type: "text",
      text: message || "LINE 測試推播成功",
    } as const

    await client.pushMessage(line_user_id, payload)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
        details: error || null,
      },
      { status: 500 },
    )
  }
}
