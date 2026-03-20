import { NextResponse } from "next/server"
import { runAutoFixDryRun } from "@/lib/ai-auto-fix/dry-run"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getBaseUrl(): string {
  const raw = process.env.AI_AUTO_FIX_BASE_URL || ""
  return raw.replace(/\/$/, "")
}

export async function GET(request: Request) {
  try {
    const baseUrl = getBaseUrl()
    const { searchParams } = new URL(request.url)
    const tenant = searchParams.get("tenant") === "tenant_b" ? "tenant_b" : "tenant_a"

    if (baseUrl) {
      const url = `${baseUrl}/dry-run`
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        })

        const payload = await response.json().catch(() => null)
        if (response.ok && payload) {
          return NextResponse.json(payload)
        }
      } catch {
        // Fallback to local mode below when external service is unavailable.
      }
    }

    const data = await runAutoFixDryRun(tenant)

    return NextResponse.json({ success: true, data, source: "local" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法連線到 AI Auto Fix 服務"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
