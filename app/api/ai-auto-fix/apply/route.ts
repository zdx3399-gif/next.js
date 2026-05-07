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

type KnowledgeWriteResult = {
  id: number | string | null
  mode: "created" | "updated"
  embeddingUpdated: true
  warning?: string
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

async function writeKnowledge(
  supabase: any,
  payload: Record<string, unknown>,
  sourceKey: string,
): Promise<KnowledgeWriteResult> {
  let warning: string | undefined

  async function writePayload(targetId: number | string | null, nextPayload: Record<string, unknown>) {
    if (targetId) {
      return supabase.from("knowledge").update(nextPayload).eq("id", targetId).select("id").single()
    }

    return supabase.from("knowledge").insert([nextPayload]).select("id").single()
  }

  let targetId: number | string | null = null
  const lookup = await supabase
    .from("knowledge")
    .select("id")
    .eq("source", "ai_auto_fix")
    .eq("source_key", sourceKey)
    .maybeSingle()

  if (lookup.error) {
    throw new Error(`查詢既有 knowledge 失敗：${lookup.error.message}`)
  } else if (lookup.data?.id) {
    targetId = lookup.data.id
  }

  const result = await writePayload(targetId, payload)

  if (result.error) {
    throw new Error(`寫入 knowledge 失敗：${result.error.message}`)
  }

  return {
    id: result.data?.id || targetId || null,
    mode: targetId ? "updated" : "created",
    embeddingUpdated: true,
    warning,
  }
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
    if (!embedding) {
      throw new Error("Embedding 產生失敗，knowledge 未寫入。請確認 Vercel 已設定 COHERE_API_KEY。")
    }

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

    const written = await writeKnowledge(supabase, insertPayload, sourceKey)

    return NextResponse.json({
      success: true,
      data: {
        knowledgeId: written.id,
        mode: written.mode,
        embeddingUpdated: written.embeddingUpdated,
        warning: written.warning || null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "套用建議修改失敗。"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
