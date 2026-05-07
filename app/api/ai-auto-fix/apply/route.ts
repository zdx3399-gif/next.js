import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getEmbedding } from "@/lib/grok/embedding"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TenantId = "tenant_a" | "tenant_b"
type KnowledgeConflict = {
  id: number | string
  content: string
  similarity: number | null
}

function normalizeQuestion(question: unknown): string {
  return String(question || "").trim().toLowerCase()
}

function buildSourceKey(question: unknown): string {
  return normalizeQuestion(question).replace(/\s+/g, " ")
}

function getSupabaseConfig(tenant: TenantId) {
  const isTenantA = tenant !== "tenant_b"
  const url = isTenantA
    ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL
    : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_URL || process.env.TENANT_B_SUPABASE_URL || process.env.SUPABASE_URL

  const key = isTenantA
    ? process.env.TENANT_A_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY ||
      process.env.TENANT_A_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY
    : process.env.TENANT_B_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_ANON_KEY ||
      process.env.TENANT_B_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(`Missing Supabase env for ${tenant}`)
  }

  return { url, key }
}

async function findKnowledgeConflicts(
  supabase: any,
  embedding: number[] | null,
  sourceKey: string,
): Promise<KnowledgeConflict[]> {
  if (!embedding) return []

  const threshold = Number(process.env.AI_AUTO_FIX_KNOWLEDGE_CONFLICT_THRESHOLD || 0.78)
  const { data, error } = await supabase.rpc("search_knowledge", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 5,
  })

  if (error || !Array.isArray(data) || data.length === 0) {
    return []
  }

  const ids = data.map((row: any) => row.id).filter(Boolean)
  const similarityById = new Map(ids.map((id: any) => [String(id), data.find((row: any) => String(row.id) === String(id))?.similarity ?? null]))

  const detail = await supabase
    .from("knowledge")
    .select("id, content, source, source_key")
    .in("id", ids)

  if (!detail.error && Array.isArray(detail.data)) {
    return detail.data
      .filter((row: any) => !(row.source === "ai_auto_fix" && row.source_key === sourceKey))
      .map((row: any) => ({
        id: row.id,
        content: String(row.content || ""),
        similarity: similarityById.get(String(row.id)) ?? null,
      }))
      .filter((row: KnowledgeConflict) => row.content)
  }

  return data
    .map((row: any) => ({
      id: row.id,
      content: String(row.content || ""),
      similarity: typeof row.similarity === "number" ? row.similarity : null,
    }))
    .filter((row: KnowledgeConflict) => row.content)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const tenant: TenantId = body?.tenant === "tenant_b" ? "tenant_b" : "tenant_a"
    const clusterKey = normalizeQuestion(body?.clusterKey)
    const issueType = String(body?.issueType || "").trim()
    const answer = String(body?.answer || "").trim()
    const questionText = String(body?.questionText || body?.clusterKey || "").trim()
    const sourceKey = buildSourceKey(questionText || clusterKey)
    const force = Boolean(body?.force)

    if (!clusterKey) {
      return NextResponse.json({ success: false, error: "缺少問題群組。" }, { status: 400 })
    }

    if (!issueType) {
      return NextResponse.json({ success: false, error: "缺少問題類型。" }, { status: 400 })
    }

    if (!answer) {
      return NextResponse.json({ success: false, error: "請先輸入要寫入資料庫的答案。" }, { status: 400 })
    }

    const { url, key } = getSupabaseConfig(tenant)
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const knowledgeContent = [`問題：${questionText}`, `答案：${answer}`].join("\n")
    const embedding = await getEmbedding(knowledgeContent, "search_document")
    const insertPayload: Record<string, unknown> = {
      source: "ai_auto_fix",
      source_key: sourceKey,
      question: questionText,
      content: knowledgeContent,
      updated_at: new Date().toISOString(),
    }

    if (embedding) {
      insertPayload.embedding = embedding
    }

    if (!force) {
      const conflicts = await findKnowledgeConflicts(supabase, embedding, sourceKey)
      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            success: false,
            code: "knowledge_conflict",
            error: "找到可能衝突的既有 knowledge，請確認後再寫入。",
            data: { conflicts },
          },
          { status: 409 },
        )
      }
    }

    let { data: inserted, error: insertError } = await supabase
      .from("knowledge")
      .upsert(insertPayload, { onConflict: "source,source_key" })
      .select("id")
      .single()

    let embeddingUpdated = Boolean(embedding)

    if (insertError && embedding) {
      const fallbackPayload = { ...insertPayload }
      delete fallbackPayload.embedding

      const fallback = await supabase
        .from("knowledge")
        .upsert(fallbackPayload, { onConflict: "source,source_key" })
        .select("id")
        .single()

      inserted = fallback.data
      insertError = fallback.error
      embeddingUpdated = false
    }

    if (insertError) {
      throw new Error(`寫入 knowledge 失敗：${insertError.message}`)
    }

    return NextResponse.json({
      success: true,
      data: {
        knowledgeId: inserted?.id || null,
        embeddingUpdated,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "套用建議修改失敗。"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
