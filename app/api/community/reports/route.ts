import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const supabaseUrl = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// POST: 建立檢舉
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reporter_id, target_type, target_id, reason, description } = body

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

    // 加入審核隊列
    await supabase.from("moderation_queue").insert([
      {
        item_type: "report",
        item_id: data.id,
        priority: reason === "pii" || reason === "defamation" ? "high" : "medium",
        ai_risk_summary: `${reason} 檢舉`,
        due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
    ])

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error creating report:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: 獲取用戶的檢舉記錄
export async function GET(req: NextRequest) {
  try {
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
