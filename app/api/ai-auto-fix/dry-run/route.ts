import { NextResponse } from "next/server"
import { runAutoFixDryRun } from "@/lib/ai-auto-fix/dry-run"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getBaseUrl(): string {
  const raw = process.env.AI_AUTO_FIX_BASE_URL || ""
  return raw.replace(/\/$/, "")
}

async function fetchExternalDryRun(baseUrl: string) {
  const url = `${baseUrl}/dry-run`
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload) {
    throw new Error(payload?.error || `AI Auto Fix external service failed (${response.status})`)
  }

  return payload
}

export async function GET(request: Request) {
  try {
    const baseUrl = getBaseUrl()
    const { searchParams } = new URL(request.url)
    const tenant = searchParams.get("tenant") === "tenant_b" ? "tenant_b" : "tenant_a"

    try {
      const data = await runAutoFixDryRun(tenant)
      return NextResponse.json({ success: true, data, source: "local" })
    } catch (localError) {
      if (!baseUrl) {
        throw localError
      }

      try {
        const payload = await fetchExternalDryRun(baseUrl)
        return NextResponse.json(payload)
      } catch (externalError) {
        const localMessage = localError instanceof Error ? localError.message : "Unknown local dry-run error"
        const externalMessage = externalError instanceof Error ? externalError.message : "Unknown external dry-run error"
        throw new Error(`Local dry-run failed: ${localMessage}; external fallback failed: ${externalMessage}`)
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "無法連線到 AI Auto Fix 服務"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
