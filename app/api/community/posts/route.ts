import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { writeServerAuditLog } from "@/lib/audit-server"
import { generateGeminiContent } from "@/lib/gemini-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseKey = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "supabaseUrl is required. Missing env: NEXT_PUBLIC_TENANT_A_SUPABASE_URL / NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY or SUPABASE_URL / SUPABASE_ANON_KEY.",
    )
  }

  return createClient(supabaseUrl, supabaseKey)
}

function hasDeterministicHighRiskSignals(text: string) {
  const hasPii =
    /[A-Z][12]\d{8}/i.test(text) ||
    /09\d{2}[- ]?\d{3}[- ]?\d{3}/.test(text) ||
    /[A-Za-z]棟\s*\d{1,4}/i.test(text) ||
    /\d{1,4}(號|室)/.test(text)

  const hasAbusiveOrDefamatory = /(白癡|智障|腦殘|騙子|小偷|去死|垃圾|廢物|詐騙)/.test(text)
  const hasSpecificTarget = /(A棟|B棟|C棟|\d{1,3}樓|\d{1,4}號|\d{1,4}室)/i.test(text)

  return hasPii || (hasSpecificTarget && hasAbusiveOrDefamatory)
}

function isInstructionalContent(text: string) {
  return /(SOP|流程|步驟|教學|指南|注意事項|分級|回報|登記|時段|處理方式)/i.test(text)
}

// GET: 獲取社區貼文列表
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()

    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const userId = searchParams.get("userId")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    let query = supabase.from("community_posts").select("*").order("created_at", { ascending: false })

    if (category) query = query.eq("category", category)
    if (status) query = query.eq("status", status)
    else query = query.in("status", ["published", "redacted"])
    if (userId) query = query.eq("author_id", userId)

    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error fetching posts:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: 建立新貼文（含 AI 審核）
export async function POST(req: NextRequest) {
  let auditMeta: {
    operatorId?: string
    targetId?: string
    reason?: string
  } = {}

  try {
    const supabase = getSupabase()

    const body = await req.json()
    const { author_id, category, display_mode, title, content, structured_data } = body
    auditMeta.operatorId = author_id
    auditMeta.reason = title || "建立社群貼文"

    if (!author_id || !category || !display_mode || !title?.trim() || !content?.trim()) {
      await writeServerAuditLog({
        supabase,
        operatorId: author_id,
        operatorRole: "resident",
        actionType: "create_post",
        targetType: "post",
        targetId: author_id,
        reason: "建立貼文缺少必要欄位",
        module: "community",
        status: "blocked",
        errorCode: "missing_required_fields",
        additionalData: { category, display_mode },
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
    //   return NextResponse.json({ error: "需要先綁定 LINE 才能發文" }, { status: 403 })
    // }
    // ===== LINE 綁定檢查結束 =====

    // 檢查信用分
    const { data: reputation } = await supabase
      .from("reputation_scores")
      .select("score")
      .eq("user_id", author_id)
      .single()

    const reputationScore = reputation?.score || 100

    // 生成顯示名稱（如果是半匿名或匿名）
    let display_name = null
    if (display_mode === "semi_anonymous") {
      const { data: profile } = await supabase.from("profiles").select("unit_id").eq("id", author_id).single()
      display_name = `住戶#${author_id.slice(0, 4)}`
    } else if (display_mode === "anonymous") {
      display_name = `匿名用戶`
    }

    let aiResult = {
      riskLevel: "low" as "low" | "medium" | "high",
      risks: null as string[] | null,
      suggestions: null as string[] | null,
      reasoning: null as string | null,
      needsReview: false,
    }

    try {
      // 呼叫 Gemini AI 檢查 API
      const aiCheckResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/moderation/ai-check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${title}\n\n${content}`,
            category,
            checkType: "pre_post",
          }),
        },
      )

      if (aiCheckResponse.ok) {
        const aiData = await aiCheckResponse.json()
        aiResult = {
          riskLevel: aiData.riskLevel || "low",
          risks: aiData.risks || null,
          suggestions: aiData.suggestions || null,
          reasoning: aiData.reasoning || null,
          needsReview: aiData.needsReview || false,
        }
        console.log("[v0] Gemini AI check result:", aiResult)
      }
    } catch (aiError) {
      console.error("[v0] AI check failed, using fallback:", aiError)
      // 備用規則：僅對明確高風險訊號送審，避免 reputation 單點造成大量誤判
      const textForFallback = `${title}\n${content}`
      const highRisk = hasDeterministicHighRiskSignals(textForFallback)
      aiResult.riskLevel = highRisk ? "high" : "low"
      aiResult.needsReview = highRisk
      aiResult.reasoning = highRisk ? "備援規則判定：偵測到高風險個資/指控訊號" : "備援規則判定：未偵測到高風險訊號"
    }

    // 誤判保護：教學/SOP 型內容且無高風險訊號時，不進入待審
    const moderationText = `${title}\n${content}`
    if (aiResult.needsReview && category !== "alert") {
      const highRiskSignals = hasDeterministicHighRiskSignals(moderationText)
      if (!highRiskSignals && isInstructionalContent(moderationText)) {
        aiResult.needsReview = false
        aiResult.riskLevel = "low"
        aiResult.reasoning = aiResult.reasoning
          ? `${aiResult.reasoning}；系統保護：判定為教學/SOP且無高風險訊號，降為可發布`
          : "系統保護：判定為教學/SOP且無高風險訊號，降為可發布"
      }
    }

    // 決定初始狀態：AI 認為需複審 → pending（可進申訴流程），否則直接發布
    const initialStatus = aiResult.needsReview ? "pending" : "published"

    // 設定可編輯期限（30分鐘內可編輯）
    const canEditUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from("community_posts")
      .insert([
        {
          author_id,
          category,
          display_mode,
          display_name,
          title,
          content,
          structured_data,
          status: initialStatus,
          ai_risk_level: aiResult.riskLevel,
          ai_risk_reason: aiResult.reasoning,
          ai_suggestions: aiResult.suggestions,
          can_edit_until: canEditUntil,
        },
      ])
      .select()
      .single()

    if (error) throw error
    auditMeta.targetId = data.id

    // AI 標記需複審：status = pending，住戶可在申訴專區看到「未申訴」並選擇提出申訴
    // 申訴送出後才建立 moderation_appeals 並進入人工複查隊列

    if (initialStatus === "published") {
      // 非同步處理 AI 分類和知識入庫評估
      processPostForKMS(data.id, title, content, category).catch((e) => console.error("[v0] KMS processing failed:", e))
    }

    await writeServerAuditLog({
      supabase,
      operatorId: author_id,
      operatorRole: "resident",
      actionType: "create_post",
      targetType: "post",
      targetId: data.id,
      reason: title,
      module: "community",
      status: "success",
      afterState: {
        status: initialStatus,
        category,
        display_mode,
        ai_risk_level: aiResult.riskLevel,
      },
    })

    return NextResponse.json({
      data,
      aiResult: {
        riskLevel: aiResult.riskLevel,
        suggestions: aiResult.suggestions,
        needsReview: aiResult.needsReview,
      },
    })
  } catch (error: any) {
    console.error("[v0] Error creating post:", error)
    try {
      const supabase = getSupabase()
      await writeServerAuditLog({
        supabase,
        operatorId: auditMeta.operatorId,
        operatorRole: "resident",
        actionType: "create_post",
        targetType: "post",
        targetId: auditMeta.targetId || auditMeta.operatorId,
        reason: auditMeta.reason || "建立社群貼文失敗",
        module: "community",
        status: "failed",
        errorCode: error?.message || "create_post_failed",
      })
    } catch {}
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function inferKmsCategory(text: string) {
  if (/(包裹|宅配|物流|取件|寄件)/.test(text)) return "package"
  if (/(訪客|臨停|車牌|警衛|門禁)/.test(text)) return "visitor"
  if (/(報修|漏水|冷氣|電梯|維修|故障)/.test(text)) return "repair"
  if (/(設施|公設|健身房|停車場|中庭|會議室)/.test(text)) return "facility"
  if (/(管理費|費用|繳費|帳單|逾期)/.test(text)) return "fee"
  if (/(緊急|火警|停電|地震|救護|災害)/.test(text)) return "emergency"
  if (/(規章|規定|罰則|守則|公約)/.test(text)) return "rules"
  return "other"
}

function buildFallbackKmsSuggestion(title: string, content: string, category: string) {
  const text = `${title}\n${content}`
  const hasPii =
    /[A-Z][12]\d{8}/i.test(text) ||
    /09\d{2}[- ]?\d{3}[- ]?\d{3}/.test(text) ||
    /[A-Za-z]棟\s*\d{1,4}/i.test(text) ||
    /\d{1,4}(號|室)/.test(text)
  const hasHarshWords = /(白癡|智障|騙子|垃圾|去死|幹|媽的|詐騙|小偷)/.test(text)
  const looksInstructional = /(SOP|流程|步驟|指南|注意事項|處理|回報|登記|建議|如何)/i.test(text)
  const longEnough = content.trim().length >= 30

  const categoryFallbackMap: Record<string, string> = {
    howto: "rules",
    case: "repair",
    alert: "emergency",
    opinion: "other",
  }

  const suitable = looksInstructional && longEnough && !hasPii && !hasHarshWords
  const keyPoints = content
    .split(/[。；\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)

  return {
    suitable,
    reason: suitable
      ? "Fallback 判定為可重用的流程/指南內容"
      : "Fallback 判定不符合入庫條件（可能缺少流程性或含風險訊號）",
    suggestedCategory: inferKmsCategory(text) || categoryFallbackMap[category] || "other",
    suggestedTitle: title,
    keyPoints: keyPoints.length ? keyPoints : null,
    summary: keyPoints.length ? keyPoints.join("；") : content.slice(0, 120),
  }
}

async function saveKmsSuggestion(
  postId: string,
  suggestion: {
    suitable: boolean
    reason?: string | null
    suggestedCategory?: string | null
    suggestedTitle?: string | null
    keyPoints?: string[] | null
    summary?: string | null
    provider?: string
  },
) {
  const supabase = getSupabase()
  const { data: currentPost } = await supabase.from("community_posts").select("structured_data").eq("id", postId).single()

  await supabase
    .from("community_posts")
    .update({
      structured_data: {
        ...(currentPost?.structured_data || {}),
        kms_suggestion: {
          suitable: suggestion.suitable,
          reason: suggestion.reason || null,
          suggested_category: suggestion.suggestedCategory || null,
          suggested_title: suggestion.suggestedTitle || null,
          summary: suggestion.summary || null,
          category: suggestion.suggestedCategory || null,
          title: suggestion.suggestedTitle || null,
          keyPoints: suggestion.keyPoints || null,
          provider: suggestion.provider || "unknown",
        },
      },
    })
    .eq("id", postId)
}

async function processPostForKMS(postId: string, title: string, content: string, category: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const fallback = buildFallbackKmsSuggestion(title, content, category)
    if (fallback.suitable) {
      console.log("[v0] GEMINI_API_KEY not set, using fallback KMS suggestion")
      await saveKmsSuggestion(postId, {
        suitable: true,
        reason: fallback.reason,
        suggestedCategory: fallback.suggestedCategory,
        suggestedTitle: fallback.suggestedTitle,
        keyPoints: fallback.keyPoints,
        summary: fallback.summary,
        provider: "fallback_no_api_key",
      })
    } else {
      console.log("[v0] GEMINI_API_KEY not set, fallback judged not suitable for KMS")
    }
    return
  }

  try {
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `你是社區知識管理助理。請分析以下社區討論貼文，判斷是否適合整理成知識卡加入知識庫。

貼文標題：${title}
貼文類別：${category}
貼文內容：
${content}

請以 JSON 格式回覆：
{
  "suitableForKMS": true/false,
  "reason": "判斷理由",
  "suggestedCategory": "包裹/訪客/報修/設施/管理費/緊急/規章/其他",
  "suggestedTitle": "建議的知識卡標題（如適合）",
  "keyPoints": ["重點1", "重點2"] 或 null
}

適合加入知識庫的條件：
1. 解決具體問題的經驗分享
2. 有價值的操作步驟或指南
3. 重要規定或注意事項
4. 常見問題的解答`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }

    const { data } = await generateGeminiContent({
      apiKey,
      payload,
      debugLabel: "KMS",
    })

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
    const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0])
      console.log("[v0] KMS analysis:", analysis)

      // 如果適合加入知識庫，更新貼文標記
      if (analysis.suitableForKMS) {
        const keyPoints = Array.isArray(analysis.keyPoints) ? analysis.keyPoints : null
        const summaryFromKeyPoints = keyPoints?.length ? keyPoints.join("；") : null
        await saveKmsSuggestion(postId, {
          suitable: true,
          reason: analysis.reason || null,
          suggestedCategory: analysis.suggestedCategory || inferKmsCategory(`${title}\n${content}`),
          suggestedTitle: analysis.suggestedTitle || title,
          keyPoints,
          summary: summaryFromKeyPoints,
          provider: "gemini",
        })
      }
    }
  } catch (error) {
    console.error("[v0] KMS AI processing error:", error)
    const fallback = buildFallbackKmsSuggestion(title, content, category)
    if (fallback.suitable) {
      await saveKmsSuggestion(postId, {
        suitable: true,
        reason: fallback.reason,
        suggestedCategory: fallback.suggestedCategory,
        suggestedTitle: fallback.suggestedTitle,
        keyPoints: fallback.keyPoints,
        summary: fallback.summary,
        provider: "fallback_on_error",
      })
    }
  }
}
