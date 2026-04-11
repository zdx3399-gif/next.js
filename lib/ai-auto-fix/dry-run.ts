import { createClient } from "@supabase/supabase-js"

type ChatHistoryRow = {
  id: string
  created_at: string
  question: string | null
  answer: string | null
  feedback: string | null
  needs_review: boolean | null
  issue_type: string | null
  reporter_id?: string | null
}

type AnswerRow = {
  question: string | null
  answer: string | null
  rating: number | null
  is_helpful: boolean | null
}

type Cluster = {
  clusterKey: string
  questionText: string
  issueType: string
  repeatCount: number
  reviewCount: number
  distinctReporters: number
  firstSeenAt: string
  lastSeenAt: string
  aiTopAnswers: Array<{ text: string; count: number }>
  feedbackTopItems: Array<{ text: string; count: number }>
  feedbackCategoryTopItems: Array<{ key: string; label: string; count: number; examples: string[] }>
  feedbackTotal: number
}

type DryRunConfig = {
  forceManualReview: boolean
  windowDays: number
  repeatThreshold: number
  autoApplyConfidenceThreshold: number
  aiChatEndpoint: string
  aiChatTimeoutMs: number
  lowRiskIssueTypes: Set<string>
  enableAiRerun: boolean
  aiRerunMaxItems: number
  aiRerunConcurrency: number
}

type Item = {
  clusterKey: string
  questionText: string
  issueType: string
  repeatCount: number
  reviewCount: number
  distinctReporters: number
  firstSeenAt: string
  lastSeenAt: string
  aiOriginalAnswer: string | null
  aiTopAnswers: Array<{ text: string; count: number }>
  proposedAnswer: string | null
  confidence: number
  recommendedAction: "manual_review" | "auto_apply"
  reason: string
  crowdFeedbackSummary: string
  feedbackTopItems: Array<{ text: string; count: number }>
  feedbackCategoryTopItems: Array<{ key: string; label: string; count: number; examples: string[] }>
  feedbackTotal: number
  evidence: {
    avgRating: number
    helpfulCount: number
    sampleCount: number
  } | null
  aiRerunAnswer?: string | null
  aiRerunStatus?: string
  aiRerunError?: string | null
  aiRerunSource?: "live" | "cache" | "disabled"
  aiRerunMode?: string
}

type DryRunResult = {
  summary: {
    totalRows: number
    totalClusters: number
    triggeredClusters: number
    autoApplyCount: number
    manualReviewCount: number
    threshold: {
      repeatThreshold: number
      autoApplyConfidenceThreshold: number
      windowDays: number
      forceManualReview: boolean
    }
    aiRerun: {
      requested: number
      cached: number
      ran: number
      ok: number
      failed: number
      empty: number
      disabled?: boolean
    }
  }
  items: Item[]
}

const memoryCache = new Map<string, { answer: string | null; status: "ok" | "empty"; updatedAt: string }>()

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === "1" || value.toLowerCase() === "true"
}

function numEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getConfig(): DryRunConfig {
  return {
    forceManualReview: boolEnv(process.env.AI_AUTO_FIX_FORCE_MANUAL_REVIEW, true),
    windowDays: numEnv(process.env.AI_AUTO_FIX_WINDOW_DAYS, 7),
    repeatThreshold: numEnv(process.env.AI_AUTO_FIX_REPEAT_THRESHOLD, 3),
    autoApplyConfidenceThreshold: numEnv(process.env.AI_AUTO_FIX_AUTO_APPLY_CONFIDENCE, 0.9),
    aiChatEndpoint: process.env.AI_CHAT_ENDPOINT || "",
    aiChatTimeoutMs: numEnv(process.env.AI_CHAT_TIMEOUT_MS, 12000),
    lowRiskIssueTypes: new Set((process.env.AI_AUTO_FIX_LOW_RISK_TYPES || "low_similarity,low_rating,fallback").split(",").map((x) => x.trim()).filter(Boolean)),
    enableAiRerun: boolEnv(process.env.AI_AUTO_FIX_ENABLE_RERUN, false),
    aiRerunMaxItems: numEnv(process.env.AI_AUTO_FIX_RERUN_MAX_ITEMS, 5),
    aiRerunConcurrency: Math.max(1, numEnv(process.env.AI_AUTO_FIX_RERUN_CONCURRENCY, 2)),
  }
}

function normalizeQuestion(question: unknown): string {
  return String(question || "").trim().toLowerCase()
}

function topEntries(map: Map<string, number>, limit = 3): Array<{ text: string; count: number }> {
  return [...map.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function classifyFeedback(feedback: string): { key: string; label: string } {
  const text = String(feedback || "").trim().toLowerCase()
  if (!text) return { key: "other", label: "其他意見" }

  const rules: Array<{ key: string; label: string; patterns: RegExp[] }> = [
    {
      key: "wrong_answer",
      label: "回答錯誤",
      patterns: [/不正確/, /回答錯/, /說錯/, /錯誤/, /修正/, /更正/, /不是/, /不能只說/, /不能把/],
    },
    {
      key: "missing_process",
      label: "缺少流程指引",
      patterns: [/流程/, /步驟/, /引導/, /頁面/, /頁可看/, /查詢/, /追蹤/, /領取/, /怎麼查/],
    },
    {
      key: "missing_fields",
      label: "缺少必要欄位",
      patterns: [/欄位/, /填單/, /填寫/, /照片/, /上傳/, /地點/, /問題描述/],
    },
    {
      key: "pricing_rule",
      label: "計價規則錯誤",
      patterns: [/坪數/, /固定金額/, /6000/, /免費/, /計算/, /車位費/, /管理費分開/, /類型條件/],
    },
    {
      key: "policy_condition",
      label: "缺少條件限制",
      patterns: [/依規約/, /住戶決議/, /公告/, /條件限制/, /登記/, /疫苗/, /完全可以/, /完全不行/],
    },
    {
      key: "too_vague",
      label: "內容過於模糊",
      patterns: [/太少/, /不完整/, /太簡略/, /模糊/, /看不懂/, /更清楚/, /語氣像在猜測/],
    },
  ]

  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { key: rule.key, label: rule.label }
    }
  }

  return { key: "other", label: "其他意見" }
}

function topCategoryEntries(
  map: Map<string, { key: string; label: string; count: number; examples: string[] }>,
  limit = 3,
): Array<{ key: string; label: string; count: number; examples: string[] }> {
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function buildClusters(rows: ChatHistoryRow[]): Cluster[] {
  const clusters = new Map<string, {
    clusterKey: string
    questionText: string
    issueType: string
    repeatCount: number
    reviewCount: number
    distinctReporters: Set<string>
    firstSeenAt: string
    lastSeenAt: string
    aiAnswerCount: Map<string, number>
    feedbackCount: Map<string, number>
    feedbackCategoryCount: Map<string, { key: string; label: string; count: number; examples: string[] }>
    feedbackTotal: number
  }>()

  for (const row of rows) {
    const qKey = normalizeQuestion(row.question)
    const issueType = row.issue_type || "unknown"
    const key = `${qKey}::${issueType}`

    if (!clusters.has(key)) {
      clusters.set(key, {
        clusterKey: qKey,
        questionText: String(row.question || "").trim() || qKey,
        issueType,
        repeatCount: 0,
        reviewCount: 0,
        distinctReporters: new Set<string>(),
        firstSeenAt: row.created_at,
        lastSeenAt: row.created_at,
        aiAnswerCount: new Map<string, number>(),
        feedbackCount: new Map<string, number>(),
        feedbackCategoryCount: new Map<string, { key: string; label: string; count: number; examples: string[] }>(),
        feedbackTotal: 0,
      })
    }

    const c = clusters.get(key)!
    c.repeatCount += 1
    if (row.needs_review) c.reviewCount += 1
    if (row.reporter_id) c.distinctReporters.add(row.reporter_id)

    const answer = String(row.answer || "").trim()
    if (answer) {
      c.aiAnswerCount.set(answer, (c.aiAnswerCount.get(answer) || 0) + 1)
    }

    const feedback = String(row.feedback || "").trim()
    if (feedback) {
      c.feedbackTotal += 1
      c.feedbackCount.set(feedback, (c.feedbackCount.get(feedback) || 0) + 1)

      const category = classifyFeedback(feedback)
      const existing = c.feedbackCategoryCount.get(category.key)
      if (existing) {
        existing.count += 1
        if (existing.examples.length < 3 && !existing.examples.includes(feedback)) {
          existing.examples.push(feedback)
        }
      } else {
        c.feedbackCategoryCount.set(category.key, {
          key: category.key,
          label: category.label,
          count: 1,
          examples: [feedback],
        })
      }
    }

    if (row.created_at < c.firstSeenAt) c.firstSeenAt = row.created_at
    if (row.created_at > c.lastSeenAt) c.lastSeenAt = row.created_at
  }

  return [...clusters.values()].map((c) => ({
    clusterKey: c.clusterKey,
    questionText: c.questionText,
    issueType: c.issueType,
    repeatCount: c.repeatCount,
    reviewCount: c.reviewCount,
    distinctReporters: c.distinctReporters.size,
    firstSeenAt: c.firstSeenAt,
    lastSeenAt: c.lastSeenAt,
    aiTopAnswers: topEntries(c.aiAnswerCount, 3),
    feedbackTopItems: topEntries(c.feedbackCount, 5),
    feedbackCategoryTopItems: topCategoryEntries(c.feedbackCategoryCount, 5),
    feedbackTotal: c.feedbackTotal,
  }))
}

function scoreConfidence(input: { avgRating: number; helpfulCount: number; sampleCount: number }): number {
  const ratingPart = Math.min(input.avgRating || 0, 5) / 10
  const helpfulPart = Math.min(input.helpfulCount || 0, 5) * 0.05
  const samplePart = Math.min(input.sampleCount || 0, 10) * 0.02
  return Math.min(1, 0.45 + ratingPart + helpfulPart + samplePart)
}

function pickBestAnswer(answerStats: Array<{ answer: string; avgRating: number; helpfulCount: number; sampleCount: number }>) {
  if (!Array.isArray(answerStats) || answerStats.length === 0) return null

  const sorted = [...answerStats].sort((a, b) => {
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
    if (b.helpfulCount !== a.helpfulCount) return b.helpfulCount - a.helpfulCount
    return b.sampleCount - a.sampleCount
  })

  const top = sorted[0]
  return {
    proposedAnswer: top.answer,
    confidence: scoreConfidence(top),
    evidence: {
      avgRating: top.avgRating,
      helpfulCount: top.helpfulCount,
      sampleCount: top.sampleCount,
    },
  }
}

function buildAnswerStatsByQuestion(rows: AnswerRow[]) {
  const byQKey = new Map<string, Map<string, { answer: string; ratingSum: number; ratingCount: number; helpfulCount: number; sampleCount: number }>>()

  for (const row of rows) {
    const qKey = normalizeQuestion(row.question)
    const answer = String(row.answer || "").trim()
    if (!qKey || !answer) continue

    if (!byQKey.has(qKey)) byQKey.set(qKey, new Map())
    const answerMap = byQKey.get(qKey)!

    if (!answerMap.has(answer)) {
      answerMap.set(answer, {
        answer,
        ratingSum: 0,
        ratingCount: 0,
        helpfulCount: 0,
        sampleCount: 0,
      })
    }

    const item = answerMap.get(answer)!
    item.sampleCount += 1

    if (row.rating !== null && row.rating !== undefined) {
      item.ratingSum += Number(row.rating)
      item.ratingCount += 1
    }

    if (row.is_helpful === true) {
      item.helpfulCount += 1
    }
  }

  const result = new Map<string, Array<{ answer: string; avgRating: number; helpfulCount: number; sampleCount: number }>>()
  for (const [qKey, answerMap] of byQKey.entries()) {
    const stats = [...answerMap.values()].map((s) => ({
      answer: s.answer,
      avgRating: s.ratingCount > 0 ? s.ratingSum / s.ratingCount : 0,
      helpfulCount: s.helpfulCount,
      sampleCount: s.sampleCount,
    }))
    result.set(qKey, stats)
  }

  return result
}

function buildCrowdFeedbackReason(cluster: Cluster, proposedAnswer: string | null): string {
  const top = (cluster.feedbackTopItems || [])[0]
  if (top?.text) {
    return `多數 feedback 顯示「${top.text}」，表示原回答有誤，建議改為：${proposedAnswer || "（目前沒有可用建議答案）"}`
  }
  return `回報資料顯示此題多次被標記為問題，建議改為：${proposedAnswer || "（目前沒有可用建議答案）"}`
}

function buildRecommendation(
  cluster: Cluster,
  best: { proposedAnswer: string; confidence: number; evidence: { avgRating: number; helpfulCount: number; sampleCount: number } } | null,
  config: DryRunConfig,
) {
  if (!best) {
    return {
      recommendedAction: "manual_review" as const,
      confidence: 0,
      reason: "找不到穩定且可參考的歷史答案",
      proposedAnswer: null,
      evidence: null,
    }
  }

  const isLowRisk = config.lowRiskIssueTypes.has(cluster.issueType)
  const enoughConfidence = best.confidence >= config.autoApplyConfidenceThreshold

  if (config.forceManualReview) {
    return {
      recommendedAction: "manual_review" as const,
      confidence: best.confidence,
      reason: "目前系統設定為人工審核模式",
      proposedAnswer: best.proposedAnswer,
      evidence: best.evidence,
    }
  }

  if (isLowRisk && enoughConfidence) {
    return {
      recommendedAction: "auto_apply" as const,
      confidence: best.confidence,
      reason: "低風險問題且候選答案信心高",
      proposedAnswer: best.proposedAnswer,
      evidence: best.evidence,
    }
  }

  return {
    recommendedAction: "manual_review" as const,
    confidence: best.confidence,
    reason: isLowRisk ? "信心分數未達自動修正門檻" : "問題類型不在低風險清單中",
    proposedAnswer: best.proposedAnswer,
    evidence: best.evidence,
  }
}

function buildFeedbackContext(feedbackTopItems: Array<{ text: string; count: number }> = []): string {
  return feedbackTopItems
    .slice(0, 3)
    .map((f, idx) => `${idx + 1}. ${f.text}（${f.count}次）`)
    .join("\n")
}

function buildRerunPrompt(question: string, feedbackTopItems: Array<{ text: string; count: number }> = []): string {
  const q = String(question || "").trim()
  const feedbackContext = buildFeedbackContext(feedbackTopItems)
  if (!feedbackContext) return q

  return [
    `原始問題：${q}`,
    "使用者主要回饋：",
    feedbackContext,
    "請根據上述回饋修正回答，輸出一段精簡且可直接給住戶的繁體中文答案。",
  ].join("\n")
}

function buildFeedbackCategoryContextV2(
  feedbackCategoryTopItems: Array<{ key: string; label: string; count: number; examples: string[] }> = [],
): string {
  return feedbackCategoryTopItems
    .slice(0, 3)
    .map((f, idx) => {
      const example = f.examples?.[0] ? `，例如：「${f.examples[0]}」` : ""
      return `${idx + 1}. ${f.label}（${f.count}次）${example}`
    })
    .join("\n")
}

function buildCrowdFeedbackReasonV2(cluster: Cluster, proposedAnswer: string | null): string {
  const topCategory = (cluster.feedbackCategoryTopItems || [])[0]
  if (topCategory?.label) {
    return `群眾回饋主要集中在「${topCategory.label}」類，共 ${topCategory.count} 筆，因此建議改寫為：${proposedAnswer || "目前尚未產生穩定建議答案"}`
  }

  return buildCrowdFeedbackReason(cluster, proposedAnswer)
}

function buildRerunPromptV2(
  question: string,
  feedbackTopItems: Array<{ text: string; count: number }> = [],
  feedbackCategoryTopItems: Array<{ key: string; label: string; count: number; examples: string[] }> = [],
): string {
  const q = String(question || "").trim()
  const feedbackContext = buildFeedbackCategoryContextV2(feedbackCategoryTopItems) || buildFeedbackContext(feedbackTopItems)
  if (!feedbackContext) return q

  return [
    `原始問題：${q}`,
    "使用者主要回饋：",
    feedbackContext,
    "請根據上述回饋修正回答，輸出一段精簡且可直接給住戶的繁體中文答案。",
  ].join("\n")
}

async function fetchAiAnswer(question: string, feedbackTopItems: Array<{ text: string; count: number }>, config: DryRunConfig): Promise<string> {
  if (!config.aiChatEndpoint) {
    throw new Error("AI_CHAT_ENDPOINT 未設定")
  }

  const prompt = buildRerunPrompt(question, feedbackTopItems)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.aiChatTimeoutMs)

  try {
    const res = await fetch(config.aiChatEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`AI API HTTP ${res.status}`)
    }

    const json = await res.json()
    return String(json?.answer || "").trim()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchAiAnswerV2(
  question: string,
  feedbackTopItems: Array<{ text: string; count: number }>,
  feedbackCategoryTopItems: Array<{ key: string; label: string; count: number; examples: string[] }>,
  config: DryRunConfig,
): Promise<string> {
  if (!config.aiChatEndpoint) {
    throw new Error("AI_CHAT_ENDPOINT 未設定")
  }

  const prompt = buildRerunPromptV2(question, feedbackTopItems, feedbackCategoryTopItems)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.aiChatTimeoutMs)

  try {
    const res = await fetch(config.aiChatEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`AI API HTTP ${res.status}`)
    }

    const json = await res.json()
    return String(json?.answer || "").trim()
  } finally {
    clearTimeout(timeout)
  }
}

function buildCacheKey(item: Item): string {
  const feedbackSignature = (item.feedbackTopItems || [])
    .slice(0, 3)
    .map((f) => `${f.text}:${f.count}`)
    .join("|")
  return `${item.clusterKey || ""}::${item.issueType || ""}::${feedbackSignature}`
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = []
  let idx = 0

  async function worker() {
    while (idx < tasks.length) {
      const current = idx
      idx += 1
      results[current] = await tasks[current]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function enrichAllItemsWithAi(items: Item[], config: DryRunConfig) {
  const summary = {
    requested: items.length,
    cached: 0,
    ran: 0,
    ok: 0,
    failed: 0,
    empty: 0,
  }

  if (!config.enableAiRerun) {
    items.forEach((item) => {
      item.aiRerunAnswer = null
      item.aiRerunStatus = "disabled"
      item.aiRerunError = null
      item.aiRerunSource = "disabled"
      item.aiRerunMode = "feedback_aware"
    })
    return { ...summary, disabled: true }
  }

  const runItems = items.slice(0, Math.max(0, config.aiRerunMaxItems))

  const tasks = runItems.map((item) => async () => {
    const key = buildCacheKey(item)
    const cached = memoryCache.get(key)

    item.aiRerunAnswer = null
    item.aiRerunStatus = "pending"
    item.aiRerunError = null
    item.aiRerunSource = "live"
    item.aiRerunMode = "feedback_aware"

    if (cached && (cached.status === "ok" || cached.status === "empty")) {
      item.aiRerunStatus = cached.status
      item.aiRerunAnswer = cached.answer || null
      item.aiRerunError = null
      item.aiRerunSource = "cache"
      summary.cached += 1
      if (cached.status === "ok") summary.ok += 1
      if (cached.status === "empty") summary.empty += 1
      return
    }

    summary.ran += 1

    try {
      const answer = await fetchAiAnswerV2(
        item.questionText || item.clusterKey,
        item.feedbackTopItems || [],
        item.feedbackCategoryTopItems || [],
        config,
      )
      item.aiRerunAnswer = answer || null
      item.aiRerunStatus = answer ? "ok" : "empty"
      item.aiRerunError = null
      item.aiRerunSource = "live"
      item.aiRerunMode = "feedback_aware"

      memoryCache.set(key, {
        answer: item.aiRerunAnswer,
        status: item.aiRerunStatus === "ok" ? "ok" : "empty",
        updatedAt: new Date().toISOString(),
      })

      if (item.aiRerunStatus === "ok") summary.ok += 1
      if (item.aiRerunStatus === "empty") summary.empty += 1
    } catch (error) {
      item.aiRerunStatus = "error"
      item.aiRerunError = error instanceof Error ? error.message : "AI rerun failed"
      item.aiRerunSource = "live"
      summary.failed += 1
    }
  })

  await runWithConcurrency(tasks, config.aiRerunConcurrency)

  if (items.length > runItems.length) {
    items.slice(runItems.length).forEach((item) => {
      item.aiRerunAnswer = null
      item.aiRerunStatus = "skipped"
      item.aiRerunError = null
      item.aiRerunSource = "disabled"
      item.aiRerunMode = "feedback_aware"
    })
  }

  return summary
}

function createSupabaseClient(tenantId: "tenant_a" | "tenant_b") {
  const isTenantA = tenantId !== "tenant_b"
  const url = isTenantA
    ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL
    : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_URL || process.env.TENANT_B_SUPABASE_URL || process.env.SUPABASE_URL

  const anonKey = isTenantA
    ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_ANON_KEY || process.env.TENANT_B_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(`Missing Supabase env for ${tenantId}`)
  }

  return createClient(url, anonKey)
}

async function loadRecentRows(supabase: any, config: DryRunConfig): Promise<ChatHistoryRow[]> {
  const from = new Date(Date.now() - config.windowDays * 24 * 60 * 60 * 1000).toISOString()

  // Unified source table for all chat events.
  const { data: unifiedRows, error: unifiedError } = await supabase
    .from("chat_events")
    .select("source, source_pk, created_at, question, answer, feedback, needs_review, issue_type, user_id")
    .gte("created_at", from)

  if (unifiedError) {
    throw new Error(`Failed to load chat_events rows: ${unifiedError.message}`)
  }

  return (unifiedRows || []).map((row: any) => {
    return {
      id: String(row.source_pk || row.id || ""),
      created_at: row.created_at,
      question: row.question || "",
      answer: row.answer || null,
      feedback: row.feedback || null,
      needs_review: Boolean(row.needs_review),
      issue_type: row.issue_type || null,
      reporter_id: row.user_id || null,
    }
  })
}

async function loadAnswerRows(supabase: any): Promise<AnswerRow[]> {
  const { data: unifiedRows, error: unifiedError } = await supabase
    .from("chat_events")
    .select("question, answer, rating, is_helpful")
    .eq("source", "chat_history")

  if (unifiedError) {
    throw new Error(`Failed to load chat_history answers from chat_events: ${unifiedError.message}`)
  }
  return (unifiedRows || []) as AnswerRow[]
}

export async function runAutoFixDryRun(tenantId: "tenant_a" | "tenant_b"): Promise<DryRunResult> {
  const config = getConfig()
  const supabase = createSupabaseClient(tenantId)

  const [recentRows, answerRows] = await Promise.all([
    loadRecentRows(supabase, config),
    loadAnswerRows(supabase),
  ])

  const clusters = buildClusters(recentRows)
  const answerStatsByQ = buildAnswerStatsByQuestion(answerRows)

  const hit = clusters.filter((c) => c.reviewCount >= config.repeatThreshold || c.repeatCount >= config.repeatThreshold)

  const items: Item[] = hit
    .map((cluster) => {
      const answerStats = answerStatsByQ.get(cluster.clusterKey) || []
      const best = pickBestAnswer(answerStats)
      const rec = buildRecommendation(cluster, best, config)

      return {
        clusterKey: cluster.clusterKey,
        questionText: cluster.questionText || cluster.clusterKey,
        issueType: cluster.issueType,
        repeatCount: cluster.repeatCount,
        reviewCount: cluster.reviewCount,
        distinctReporters: cluster.distinctReporters,
        firstSeenAt: cluster.firstSeenAt,
        lastSeenAt: cluster.lastSeenAt,
        aiOriginalAnswer: cluster.aiTopAnswers[0]?.text || null,
        aiTopAnswers: cluster.aiTopAnswers,
        proposedAnswer: rec.proposedAnswer,
        confidence: Number(rec.confidence.toFixed(4)),
        recommendedAction: rec.recommendedAction,
        reason: rec.reason,
        crowdFeedbackSummary: buildCrowdFeedbackReasonV2(cluster, rec.proposedAnswer),
        feedbackTopItems: cluster.feedbackTopItems || [],
        feedbackCategoryTopItems: cluster.feedbackCategoryTopItems || [],
        feedbackTotal: cluster.feedbackTotal || 0,
        evidence: rec.evidence,
      }
    })
    .sort((a, b) => b.confidence - a.confidence || b.reviewCount - a.reviewCount)

  const aiRerun = await enrichAllItemsWithAi(items, config)

  return {
    summary: {
      totalRows: recentRows.length,
      totalClusters: clusters.length,
      triggeredClusters: items.length,
      autoApplyCount: items.filter((x) => x.recommendedAction === "auto_apply").length,
      manualReviewCount: items.filter((x) => x.recommendedAction === "manual_review").length,
      threshold: {
        repeatThreshold: config.repeatThreshold,
        autoApplyConfidenceThreshold: config.autoApplyConfidenceThreshold,
        windowDays: config.windowDays,
        forceManualReview: config.forceManualReview,
      },
      aiRerun,
    },
    items,
  }
}
