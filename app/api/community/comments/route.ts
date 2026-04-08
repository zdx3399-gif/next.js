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

// GET: 獲取貼文的留言
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const postId = searchParams.get("postId")

    if (!postId) {
      return NextResponse.json({ error: "缺少 postId 參數" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .eq("status", "published")
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error fetching comments:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: 建立留言
export async function POST(req: NextRequest) {
  let auditMeta: { operatorId?: string; targetId?: string } = {}

  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { post_id, author_id, parent_comment_id, content, display_mode } = body
    auditMeta.operatorId = author_id

    if (!post_id || !author_id || !content?.trim()) {
      await writeServerAuditLog({
        supabase,
        operatorId: author_id,
        operatorRole: "resident",
        actionType: "create_comment",
        targetType: "comment",
        targetId: post_id || author_id,
        reason: "建立留言缺少必要欄位",
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
    //   .eq("platform_user_id", author_id)
    //   .eq("status", "active")
    //   .single()
    //
    // if (!binding) {
    //   return NextResponse.json({ error: "需要先綁定 LINE 才能留言" }, { status: 403 })
    // }
    // ===== LINE 綁定檢查結束 =====

    // 生成顯示名稱
    let display_name = null
    if (display_mode === "semi_anonymous") {
      display_name = `住戶#${author_id.slice(0, 4)}`
    } else if (display_mode === "anonymous") {
      display_name = `匿名用戶`
    }

    const { data, error } = await supabase
      .from("post_comments")
      .insert([
        {
          post_id,
          author_id,
          parent_comment_id,
          content,
          display_mode,
          display_name,
        },
      ])
      .select()
      .single()

    if (error) throw error
    auditMeta.targetId = data.id

    // 更新貼文留言數
    await supabase.rpc("increment_comment_count", { post_id })

    await writeServerAuditLog({
      supabase,
      operatorId: author_id,
      operatorRole: "resident",
      actionType: "create_comment",
      targetType: "comment",
      targetId: data.id,
      reason: content.slice(0, 120),
      module: "community",
      status: "success",
      afterState: { post_id, parent_comment_id: parent_comment_id || null, display_mode },
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error creating comment:", error)
    try {
      const supabase = getSupabase()
      await writeServerAuditLog({
        supabase,
        operatorId: auditMeta.operatorId,
        operatorRole: "resident",
        actionType: "create_comment",
        targetType: "comment",
        targetId: auditMeta.targetId || auditMeta.operatorId,
        reason: "建立留言失敗",
        module: "community",
        status: "failed",
        errorCode: error?.message || "create_comment_failed",
      })
    } catch {}
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
