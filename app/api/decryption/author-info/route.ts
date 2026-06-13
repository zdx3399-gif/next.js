import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type TenantId = "tenant_a" | "tenant_b"

function toTenantId(value: unknown): TenantId {
  return value === "tenant_b" ? "tenant_b" : "tenant_a"
}

function getTenantServiceClient(tenantId: TenantId) {
  const isTenantA = tenantId === "tenant_a"
  const url = isTenantA
    ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.TENANT_A_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_URL || process.env.TENANT_B_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL

  const key = isTenantA
    ? process.env.TENANT_A_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.TENANT_B_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(`Missing Supabase service config for ${tenantId}`)
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, viewerId, viewerRole, tenantId } = body

    if (!requestId || !viewerId || !viewerRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (viewerRole !== "admin" && viewerRole !== "committee") {
      return NextResponse.json({ error: "Invalid viewerRole" }, { status: 400 })
    }

    const resolvedTenantId = toTenantId(tenantId)
    const supabaseServer = getTenantServiceClient(resolvedTenantId)

    // 使用 service role key 繞過 RLS
    const { data: decryptionRequest, error: reqError } = await supabaseServer
      .from("decryption_requests")
      .select("*")
      .eq("id", requestId)
      .single()

    if (reqError || !decryptionRequest) {
      return NextResponse.json({ error: "找不到此申請" }, { status: 404 })
    }

    if (decryptionRequest.status !== "fully_approved") {
      return NextResponse.json({ error: "此申請尚未完全核准" }, { status: 403 })
    }

    if (new Date(decryptionRequest.accessible_until) < new Date()) {
      return NextResponse.json({ error: "解密資訊已過期" }, { status: 403 })
    }

    // 解析發文/留言者的 profile ID
    let authorProfileId: string | null = null

    if (decryptionRequest.target_type === "post") {
      const { data: post } = await supabaseServer
        .from("community_posts")
        .select("author_id")
        .eq("id", decryptionRequest.target_id)
        .single()
      authorProfileId = post?.author_id ?? null
    } else if (decryptionRequest.target_type === "comment") {
      const { data: comment } = await supabaseServer
        .from("post_comments")
        .select("author_id")
        .eq("id", decryptionRequest.target_id)
        .single()
      authorProfileId = comment?.author_id ?? null
    }

    // fallback：若貼文/留言已刪除，改用核准時記錄的 decrypted_author_id
    if (!authorProfileId) {
      authorProfileId = decryptionRequest.decrypted_author_id ?? null
    }

    if (!authorProfileId) {
      return NextResponse.json({ error: "無法解析發文者身份，貼文可能已刪除" }, { status: 404 })
    }

    // 取得作者 profile
    const { data: author, error: authorError } = await supabaseServer
      .from("profiles")
      .select("id, name, unit_id, email, phone")
      .eq("id", authorProfileId)
      .single()

    if (authorError || !author) {
      return NextResponse.json({ error: "找不到發文者的個人資料" }, { status: 404 })
    }

    // 取得戶號（unit_number 在 units 表）
    let unitNumber: string | null = null
    if (author.unit_id) {
      const { data: unit } = await supabaseServer
        .from("units")
        .select("unit_number, unit_code")
        .eq("id", author.unit_id)
        .single()
      unitNumber = unit?.unit_number || unit?.unit_code || null
    }

    // 記錄稽核日誌（server-side 直接寫入，避免依賴瀏覽器 tenant config）
    try {
      await supabaseServer.from("audit_logs").insert([
        {
          operator_id: viewerId,
          operator_role: viewerRole,
          action_type: "decryption_viewed",
          target_type: "decryption_request",
          target_id: requestId,
          reason: "查看解密資訊",
          after_state: { viewed_at: new Date().toISOString() },
          additional_data: { module: "decryption", status: "success" },
        },
      ])
    } catch (auditError) {
      console.warn("Skip decryption audit log:", auditError)
    }

    return NextResponse.json({
      id: author.id,
      full_name: author.name,
      unit_number: unitNumber,
      email: author.email,
      phone: author.phone,
      accessible_until: decryptionRequest.accessible_until,
    })
  } catch (error: any) {
    console.error("Error fetching decrypted author info:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
