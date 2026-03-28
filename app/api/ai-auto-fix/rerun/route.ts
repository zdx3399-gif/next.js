import { NextResponse } from "next/server"
import { rerunAutoFixItem } from "@/lib/ai-auto-fix/dry-run"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RequestBody = {
  tenant?: string
  clusterKey?: string
  questionText?: string
  issueType?: string
  feedbackTopItems?: Array<{ text: string; count: number }>
  feedbackCategoryTopItems?: Array<{ key: string; label: string; count: number; examples?: string[] }>
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody
    const tenant = body.tenant === "tenant_b" ? "tenant_b" : "tenant_a"
    const clusterKey = String(body.clusterKey || "").trim()
    const questionText = String(body.questionText || clusterKey).trim()
    const issueType = String(body.issueType || "unknown").trim()

    if (!clusterKey || !questionText) {
      return NextResponse.json({ success: false, error: "缺少補跑所需的題目資訊" }, { status: 400 })
    }

    const data = await rerunAutoFixItem(tenant, {
      clusterKey,
      questionText,
      issueType,
      feedbackTopItems: Array.isArray(body.feedbackTopItems) ? body.feedbackTopItems : [],
      feedbackCategoryTopItems: Array.isArray(body.feedbackCategoryTopItems)
        ? body.feedbackCategoryTopItems.map((item) => ({
            key: item.key,
            label: item.label,
            count: item.count,
            examples: Array.isArray(item.examples) ? item.examples : [],
          }))
        : [],
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "AI 補跑失敗"

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
