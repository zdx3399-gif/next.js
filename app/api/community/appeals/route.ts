import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { writeServerAuditLog } from "@/lib/audit-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseKey = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase env")
  }

  return createClient(supabaseUrl, supabaseKey)
}

const APPEAL_COOLDOWN_MINUTES = 60

export async function POST(req: NextRequest) {
  let auditMeta: { operatorId?: string; targetId?: string; reason?: string } = {}

  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { postId, authorId, reason } = body || {}
    auditMeta.operatorId = authorId
    auditMeta.targetId = postId
    auditMeta.reason = reason?.trim()

    if (!postId || !authorId || !reason?.trim()) {
      await writeServerAuditLog({
        supabase,
        operatorId: authorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: postId || authorId,
        reason: "提出申訴缺少必要欄位",
        module: "community",
        status: "blocked",
        errorCode: "missing_required_fields",
      })
      return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 })
    }

    const { data: post, error: postError } = await supabase
      .from("community_posts")
      .select("id, author_id, status")
      .eq("id", postId)
      .single()

    if (postError || !post) {
      await writeServerAuditLog({
        supabase,
        operatorId: authorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: postId,
        reason: "找不到貼文",
        module: "community",
        status: "blocked",
        errorCode: "post_not_found",
      })
      return NextResponse.json({ error: "找不到貼文" }, { status: 404 })
    }

    if (post.author_id !== authorId) {
      await writeServerAuditLog({
        supabase,
        operatorId: authorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: postId,
        reason: "只能為自己的貼文提出申訴",
        module: "community",
        status: "blocked",
        errorCode: "forbidden",
      })
      return NextResponse.json({ error: "只能為自己的貼文提出申訴" }, { status: 403 })
    }

    if (!["removed", "shadow", "redacted"].includes(post.status)) {
      await writeServerAuditLog({
        supabase,
        operatorId: authorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: postId,
        reason: "僅限被處置貼文可提出申訴",
        module: "community",
        status: "blocked",
        errorCode: "invalid_post_status",
        beforeState: { status: post.status },
      })
      return NextResponse.json({ error: "僅限被處置貼文可提出申訴" }, { status: 400 })
    }

    const { data: existingOpen } = await supabase
      .from("moderation_appeals")
      .select("id")
      .eq("post_id", postId)
      .eq("author_id", authorId)
      .in("status", ["pending", "reviewing"])
      .limit(1)

    if (existingOpen && existingOpen.length > 0) {
      await writeServerAuditLog({
        supabase,
        operatorId: authorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: postId,
        reason: "已有處理中的申訴案件",
        module: "community",
        status: "blocked",
        errorCode: "appeal_already_open",
      })
      return NextResponse.json({ error: "已有處理中的申訴案件" }, { status: 409 })
    }

    const { data: existingRejected } = await supabase
      .from("moderation_appeals")
      .select("id")
      .eq("post_id", postId)
      .eq("author_id", authorId)
      .eq("status", "rejected")
      .limit(1)

    if (existingRejected && existingRejected.length > 0) {
      await writeServerAuditLog({
        supabase,
        operatorId: authorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: postId,
        reason: "此貼文申訴已被駁回，無法再次申請",
        module: "community",
        status: "blocked",
        errorCode: "appeal_rejected_final",
      })
      return NextResponse.json({ error: "此貼文申訴已被駁回，無法再次申請" }, { status: 409 })
    }

    const { data: latest } = await supabase
      .from("moderation_appeals")
      .select("created_at")
      .eq("post_id", postId)
      .eq("author_id", authorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest?.created_at) {
      const lastTs = new Date(latest.created_at).getTime()
      const nowTs = Date.now()
      const diffMinutes = Math.floor((nowTs - lastTs) / (60 * 1000))
      if (diffMinutes < APPEAL_COOLDOWN_MINUTES) {
        const waitMinutes = APPEAL_COOLDOWN_MINUTES - diffMinutes
        await writeServerAuditLog({
          supabase,
          operatorId: authorId,
          operatorRole: "resident",
          actionType: "appeal_submit",
          targetType: "community_post",
          targetId: postId,
          reason: `申訴冷卻中，請於 ${waitMinutes} 分鐘後再試`,
          module: "community",
          status: "blocked",
          errorCode: "appeal_cooldown",
        })
        return NextResponse.json({ error: `申訴冷卻中，請於 ${waitMinutes} 分鐘後再試` }, { status: 429 })
      }
    }

    const { data: appeal, error: appealError } = await supabase
      .from("moderation_appeals")
      .insert([
        {
          post_id: postId,
          author_id: authorId,
          reason: reason.trim(),
          status: "pending",
        },
      ])
      .select("*")
      .single()

    if (appealError || !appeal) {
      await writeServerAuditLog({
        supabase,
        operatorId: authorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: postId,
        reason: appealError?.message || "建立申訴失敗",
        module: "community",
        status: "failed",
        errorCode: appealError?.message || "appeal_insert_failed",
      })
      return NextResponse.json({ error: appealError?.message || "建立申訴失敗" }, { status: 500 })
    }

    await supabase.from("moderation_queue").insert([
      {
        item_type: "post",
        item_id: postId,
        priority: "high",
        ai_risk_summary: "住戶申訴案件：請人工複審",
        ai_suggested_action: "review_appeal",
        status: "pending",
      },
    ])

    await writeServerAuditLog({
      supabase,
      operatorId: authorId,
      operatorRole: "resident",
      actionType: "appeal_submit",
      targetType: "community_post",
      targetId: postId,
      reason: reason.trim(),
      module: "community",
      status: "success",
      relatedRequestId: appeal.id,
      afterState: { status: "pending" },
    })

    return NextResponse.json({
      success: true,
      appeal,
      message: "已建立申訴案件，管理員將進行人工複審",
    })
  } catch (error: any) {
    try {
      const supabase = getSupabase()
      await writeServerAuditLog({
        supabase,
        operatorId: auditMeta.operatorId,
        operatorRole: "resident",
        actionType: "appeal_submit",
        targetType: "community_post",
        targetId: auditMeta.targetId || auditMeta.operatorId,
        reason: auditMeta.reason || "申訴提交失敗",
        module: "community",
        status: "failed",
        errorCode: error?.message || "appeal_submit_failed",
      })
    } catch {}
    return NextResponse.json({ error: error?.message || "申訴提交失敗" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const authorId = searchParams.get("authorId")
    const status = searchParams.get("status")

    let query = supabase.from("moderation_appeals").select("*").order("created_at", { ascending: false })

    if (authorId) {
      query = query.eq("author_id", authorId)
    }
    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "讀取申訴失敗" }, { status: 500 })
  }
}
