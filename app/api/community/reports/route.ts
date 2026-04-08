import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { writeServerAuditLog } from "@/lib/audit-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseKey = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "supabaseUrl is required. Missing env: NEXT_PUBLIC_TENANT_A_SUPABASE_URL / NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY or SUPABASE_URL / SUPABASE_ANON_KEY."
    )
  }

  return createClient(supabaseUrl, supabaseKey)
}

// POST: 建立檢舉
export async function POST(req: NextRequest) {
  let auditMeta: { operatorId?: string; targetId?: string; reason?: string } = {}

  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { reporter_id, target_type, target_id, reason, description } = body
    auditMeta.operatorId = reporter_id
    auditMeta.reason = reason

    if (!reporter_id || !target_type || !target_id || !reason) {
      await writeServerAuditLog({
        supabase,
        operatorId: reporter_id,
        operatorRole: "resident",
        actionType: "create_report",
        targetType: "report",
        targetId: target_id || reporter_id,
        reason: "建立檢舉缺少必要欄位",
        module: "community",
        status: "blocked",
        errorCode: "missing_required_fields",
      })
      return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 })
    }

    // ===== LINE 綁定檢查（暫時停用）=====
    // const { data: binding } = await supabase
    //   .from("line_bindings")
    //   .select("id")
    //   .eq("platform_user_id", reporter_id)
    //   .eq("status", "active")
    //   .single()
    //
    // if (!binding) {
    //   return NextResponse.json({ error: "需要先綁定 LINE 才能檢舉" }, { status: 403 })
    // }
    // ===== LINE 綁定檢查結束 =====

    // AI 初判（簡化版）
    const aiAssessment = reason === "spam" ? "valid" : "needs_review"

    const { data, error } = await supabase
      .from("reports")
      .insert([
        {
          reporter_id,
          target_type,
          target_id,
          reason,
          description,
          ai_assessment: aiAssessment,
        },
      ])
      .select()
      .single()

    if (error) throw error
    auditMeta.targetId = data.id

    // 加入審核隊列
    const { error: qErr } = await supabase.from("moderation_queue").insert([
      {
        item_type: "report",
        item_id: data.id,
        priority: reason === "pii" || reason === "defamation" ? "high" : "medium",
        ai_risk_summary: `${reason} 檢舉`,
        due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
    ])

    if (qErr) throw qErr

    await writeServerAuditLog({
      supabase,
      operatorId: reporter_id,
      operatorRole: "resident",
      actionType: "create_report",
      targetType: "report",
      targetId: data.id,
      reason,
      module: "community",
      status: "success",
      afterState: { target_type, target_id, ai_assessment: aiAssessment },
      additionalData: { description: description || null },
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error creating report:", error)
    try {
      const supabase = getSupabase()
      await writeServerAuditLog({
        supabase,
        operatorId: auditMeta.operatorId,
        operatorRole: "resident",
        actionType: "create_report",
        targetType: "report",
        targetId: auditMeta.targetId || auditMeta.operatorId,
        reason: auditMeta.reason || "建立檢舉失敗",
        module: "community",
        status: "failed",
        errorCode: error?.message || "create_report_failed",
      })
    } catch {}
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: 獲取用戶的檢舉記錄
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "缺少 userId 參數" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error fetching reports:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
