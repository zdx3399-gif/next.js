import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const supabaseUrl = process.env.TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL || ""
const supabaseKey = process.env.TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// GET: 獲取社區貼文列表
export async function GET(req: NextRequest) {
  try {
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
  try {
    const body = await req.json()
    const { author_id, category, display_mode, title, content, structured_data } = body

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
      // 備用規則：Alert 類別或低信用分需要審核
      aiResult.riskLevel = category === "alert" ? "high" : reputationScore < 60 ? "medium" : "low"
      aiResult.needsReview = aiResult.riskLevel === "high" || (aiResult.riskLevel === "medium" && reputationScore < 60)
    }

    // 決定初始狀態
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

    // 如果需要審核，加入審核隊列
    if (initialStatus === "pending") {
      const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小時內審核
      await supabase.from("moderation_queue").insert([
        {
          item_type: "post",
          item_id: data.id,
          priority: aiResult.riskLevel === "high" ? "urgent" : "medium",
          ai_risk_summary: `${category} 類別貼文，風險等級：${aiResult.riskLevel}${aiResult.risks ? `，風險：${aiResult.risks.join("、")}` : ""}`,
          due_at: dueAt,
        },
      ])
    }

    if (initialStatus === "published") {
      // 非同步處理 AI 分類和知識入庫評估
      processPostForKMS(data.id, title, content, category).catch((e) => console.error("[v0] KMS processing failed:", e))
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processPostForKMS(postId: string, title: string, content: string, category: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.log("[v0] GEMINI_API_KEY not set, skipping KMS processing")
    return
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
    const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0])
      console.log("[v0] KMS analysis:", analysis)

      // 如果適合加入知識庫，更新貼文標記
      if (analysis.suitableForKMS) {
        await supabase
          .from("community_posts")
          .update({
            structured_data: {
              kms_suggestion: {
                suitable: true,
                category: analysis.suggestedCategory,
                title: analysis.suggestedTitle,
                keyPoints: analysis.keyPoints,
              },
            },
          })
          .eq("id", postId)
      }
    }
  } catch (error) {
    console.error("[v0] KMS AI processing error:", error)
  }
}
