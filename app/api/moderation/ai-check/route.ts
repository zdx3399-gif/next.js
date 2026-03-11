import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  console.log("========================================")
  console.log("[v0] AI 審核 API 被呼叫")
  console.log("========================================")

  try {
    const body = await req.json()
    const { text, category, checkType } = body

    console.log("[v0] 審核內容:", text?.substring(0, 100))
    console.log("[v0] 內容類別:", category)
    console.log("[v0] 檢查類型:", checkType)

    if (!text) {
      return NextResponse.json({ error: "內容不能為空" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY

    console.log("[v0] GEMINI_API_KEY 是否設定:", !!apiKey)

    if (!apiKey) {
      console.warn("[v0] GEMINI_API_KEY 未設定，使用規則檢查")
      const result = fallbackRuleBasedCheck(text, category, checkType)
      return result
    }

    try {
      console.log("[v0] 正在呼叫 Gemini API...")

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `你是社區管理委員會的內容審核助理。請分析以下內容是否適合發布在社區討論板上。

內容類別：${category === "alert" ? "警示公告（需特別嚴格審核）" : category === "discussion" ? "一般討論" : "問答"}

需要檢查的內容：
${text}

請以 JSON 格式回覆，包含以下欄位：
{
  "riskLevel": "low/medium/high",
  "risks": ["風險1", "風險2"] 或 null,
  "suggestions": ["建議1", "建議2"] 或 null,
  "reasoning": "簡短說明判斷理由"
}

審核重點（請嚴格檢查）：
1. 個人資料洩露：身分證、手機號碼、住址、戶號、門牌號碼（如 A棟101、B棟202 等）
2. 不當用語或人身攻擊（包含「擾民」、「吵死人」等負面指控）
3. 虛假資訊或謠言
4. 商業廣告或詐騙
5. 如果內容同時包含「具體位置」+「負面指控」，應判定為 high 風險`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              topK: 32,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
          }),
        },
      )

      console.log("[v0] Gemini API 回應狀態:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Gemini API 錯誤:", errorText)
        throw new Error(`Gemini API error: ${response.statusText}`)
      }

      const data = await response.json()
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text

      console.log("[v0] Gemini 原始回應:", aiResponse)

      if (!aiResponse) {
        throw new Error("No response from Gemini")
      }

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response")
      }

      const analysis = JSON.parse(jsonMatch[0])

      console.log("========================================")
      console.log("[v0] Gemini AI 分析結果:")
      console.log("[v0] - 風險等級:", analysis.riskLevel)
      console.log("[v0] - 風險項目:", analysis.risks)
      console.log("[v0] - 建議:", analysis.suggestions)
      console.log("[v0] - 判斷理由:", analysis.reasoning)
      console.log("========================================")

      const result = {
        riskLevel: analysis.riskLevel || "low",
        risks: analysis.risks || null,
        suggestions: analysis.suggestions || null,
        reasoning: analysis.reasoning || null,
        shouldBlock: analysis.riskLevel === "high" && checkType === "pre_post",
        needsReview: analysis.riskLevel === "high" || (analysis.riskLevel === "medium" && category === "alert"),
        aiProvider: "gemini",
      }

      console.log("[v0] 最終決策 - 應該封鎖:", result.shouldBlock, "需要審核:", result.needsReview)

      return NextResponse.json(result)
    } catch (aiError: any) {
      console.error("[v0] Gemini API 呼叫失敗:", aiError.message)
      console.log("[v0] 改用規則檢查...")
      return fallbackRuleBasedCheck(text, category, checkType)
    }
  } catch (error: any) {
    console.error("[v0] AI check error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function fallbackRuleBasedCheck(text: string, category: string, checkType: string) {
  console.log("[v0] 執行規則檢查...")

  const risks: string[] = []
  let riskScore = 0 // 使用分數制：0-2 低, 3-5 中, 6+ 高
  const suggestions: string[] = []

  // === 1. 個人資料檢測 (高風險 +3~5 分) ===
  const piiPatterns = [
    { regex: /[A-Z][12]\d{8}/gi, type: "身分證字號", score: 5 },
    { regex: /09\d{2}[- ]?\d{3}[- ]?\d{3}/g, type: "手機號碼", score: 5 },
    { regex: /0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}/g, type: "市話號碼", score: 4 },
    { regex: /[A-Z]{2,3}[- ]?\d{4}/gi, type: "車牌號碼", score: 3 },
  ]

  for (const pattern of piiPatterns) {
    if (pattern.regex.test(text)) {
      risks.push(`包含${pattern.type}`)
      suggestions.push(`請移除或遮蔽${pattern.type}`)
      riskScore += pattern.score
      console.log(`[v0] 檢測到 ${pattern.type}, +${pattern.score} 分`)
    }
  }

  // === 2. 姓名檢測 (中風險 +2 分) ===
  // 中文姓名模式：常見姓氏 + 1-2 個字
  const commonSurnames =
    "王李張劉陳楊黃趙周吳徐孫馬朱胡郭何林羅高鄭梁謝宋唐許鄧馮韓曹曾彭蕭蔡潘田董袁于余葉杜戴夏鍾汪田任姜范方石姚譚廖鄒熊金陸郝孔白崔康毛邱秦江史顧侯邵孟龍萬段雷錢湯尹黎易常武喬賀賴龔文"
  const namePattern = new RegExp(
    `[${commonSurnames}][\\u4e00-\\u9fa5]{1,2}(?:先生|小姐|太太|老師|醫生|經理|主任)?`,
    "g",
  )
  const nameMatches = text.match(namePattern)
  if (nameMatches && nameMatches.length > 0) {
    // 過濾掉常見詞彙
    const commonWords = [
      "大家",
      "大人",
      "小孩",
      "小心",
      "大樓",
      "大門",
      "小區",
      "王道",
      "李子",
      "張貼",
      "劉海",
      "陳年",
      "黃金",
      "周年",
      "吳語",
      "林木",
      "高手",
      "鄭重",
      "方便",
      "方法",
      "方向",
      "田地",
      "田野",
      "金屬",
      "金錢",
      "文化",
      "文字",
      "白天",
      "白色",
      "江河",
      "江山",
    ]
    const filteredNames = nameMatches.filter((name) => !commonWords.includes(name))
    if (filteredNames.length > 0) {
      risks.push(`可能包含人名：${filteredNames.join(", ")}`)
      suggestions.push("請確認是否需要提及具體人名")
      riskScore += 2
      console.log(`[v0] 檢測到可能人名: ${filteredNames.join(", ")}, +2 分`)
    }
  }

  // === 3. 地址資訊檢測 (中風險 +2~3 分) ===
  const addressPatterns = [
    { regex: /[A-Za-z]棟\s*\d{1,4}/gi, type: "棟號+門牌", score: 3 },
    { regex: /\d{1,3}樓/g, type: "樓層資訊", score: 2 },
    { regex: /\d{1,4}號/g, type: "門牌號碼", score: 2 },
    { regex: /\d{1,4}室/g, type: "房號", score: 2 },
    {
      regex:
        /(台北|新北|桃園|台中|台南|高雄|基隆|新竹|苗栗|彰化|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|澎湖|金門|連江)[市縣]?[^\s]{2,10}(路|街|巷|弄|段)/g,
      type: "完整地址",
      score: 4,
    },
    { regex: /(路|街|巷|弄)\s*\d+號/g, type: "街道地址", score: 3 },
  ]

  let hasLocationInfo = false
  for (const pattern of addressPatterns) {
    if (pattern.regex.test(text)) {
      risks.push(`包含${pattern.type}`)
      suggestions.push("請以區域方式描述，避免透露精確位置")
      riskScore += pattern.score
      hasLocationInfo = true
      console.log(`[v0] 檢測到 ${pattern.type}, +${pattern.score} 分`)
    }
  }

  // === 4. 敏感用語檢測 (中風險 +2 分) ===
  const sensitiveWords = [
    { words: ["幹", "操", "媽的", "他媽", "去死", "王八"], type: "髒話", score: 3 },
    { words: ["白癡", "智障", "腦殘", "廢物", "垃圾", "北七", "87"], type: "侮辱性用語", score: 3 },
    { words: ["擾民", "吵死", "很吵", "太吵", "噪音擾人", "半夜吵"], type: "噪音投訴", score: 2 },
    { words: ["騙子", "詐騙", "小偷", "偷東西", "渣男", "渣女"], type: "負面指控", score: 2 },
    { words: ["打他", "揍他", "堵他", "告他", "報警"], type: "威脅性用語", score: 2 },
  ]

  let hasSensitiveWord = false
  let sensitiveWordType = ""
  for (const category of sensitiveWords) {
    for (const word of category.words) {
      if (text.includes(word)) {
        risks.push(`包含${category.type}：${word}`)
        suggestions.push("請使用較中性的用詞")
        riskScore += category.score
        hasSensitiveWord = true
        sensitiveWordType = category.type
        console.log(`[v0] 檢測到 ${category.type}: ${word}, +${category.score} 分`)
        break // 同類別只計算一次
      }
    }
  }

  // === 5. 組合風險加分 ===
  // 位置 + 負面用語 = 可能誹謗 (+3)
  if (hasLocationInfo && hasSensitiveWord) {
    riskScore += 3
    risks.push("位置資訊 + 負面用語組合，可能構成誹謗")
    suggestions.push("請移除具體位置或修改負面用詞")
    console.log("[v0] 組合風險: 位置+負面用語, +3 分")
  }

  // === 6. 類別加權 ===
  if (category === "alert") {
    riskScore += 1 // 警示類貼文更嚴格
    suggestions.push("警示類貼文需要特別審核")
    console.log("[v0] 警示類貼文, +1 分")
  }

  // === 7. 根據分數決定風險等級 ===
  let riskLevel: "low" | "medium" | "high"
  if (riskScore >= 5) {
    riskLevel = "high"
  } else if (riskScore >= 2) {
    riskLevel = "medium"
  } else {
    riskLevel = "low"
  }

  // 長度檢查
  if (text.length < 10) {
    suggestions.push("內容過短，建議補充更多資訊")
  }

  console.log("========================================")
  console.log("[v0] 規則檢查結果:")
  console.log("[v0] - 風險分數:", riskScore)
  console.log("[v0] - 風險等級:", riskLevel)
  console.log("[v0] - 風險項目:", risks)
  console.log("[v0] - 建議:", suggestions)
  console.log("========================================")

  const result = {
    riskLevel,
    riskScore,
    risks: risks.length > 0 ? risks : null,
    suggestions: suggestions.length > 0 ? suggestions : null,
    shouldBlock: riskLevel === "high" && checkType === "pre_post",
    needsReview: riskLevel === "high" || riskLevel === "medium",
    reasoning: `規則檢查完成，風險分數: ${riskScore}`,
    aiProvider: "fallback_rules",
  }

  console.log("[v0] 最終決策 - 應該封鎖:", result.shouldBlock, "需要審核:", result.needsReview)

  return NextResponse.json(result)
}
