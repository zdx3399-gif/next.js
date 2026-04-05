import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_COMMANDS = new Set(["V", "P", "E", "C"])

function getBaseUrl() {
  const baseUrl = process.env.IOT_DEVICE_BASE_URL
  if (!baseUrl) {
    throw new Error("缺少 IOT_DEVICE_BASE_URL 環境變數")
  }
  return baseUrl.replace(/\/$/, "")
}

async function requestWithTimeout(url: string, init?: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function GET() {
  try {
    const baseUrl = getBaseUrl()
    const res = await requestWithTimeout(`${baseUrl}/ping`, { method: "GET" })

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `IOT 無回應，狀態碼 ${res.status}` },
        { status: 502 },
      )
    }

    const text = (await res.text()).trim()
    return NextResponse.json({ success: true, message: text || "OK" })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "IOT 連線檢查失敗",
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { cmd } = await req.json()
    const normalizedCmd = String(cmd || "").trim().toUpperCase()

    if (!VALID_COMMANDS.has(normalizedCmd)) {
      return NextResponse.json(
        { success: false, error: "無效指令，只允許 V/P/E/C" },
        { status: 400 },
      )
    }

    const baseUrl = getBaseUrl()
    const res = await requestWithTimeout(`${baseUrl}/cmd`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cmd: normalizedCmd }),
    })

    if (!res.ok) {
      const bodyText = await res.text()
      return NextResponse.json(
        { success: false, error: bodyText || `IOT 命令失敗，狀態碼 ${res.status}` },
        { status: 502 },
      )
    }

    let payload: unknown = null
    try {
      payload = await res.json()
    } catch {
      payload = await res.text()
    }

    return NextResponse.json({ success: true, cmd: normalizedCmd, device: payload })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "轉發命令失敗",
      },
      { status: 500 },
    )
  }
}
