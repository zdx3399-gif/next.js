import { createClient } from "@supabase/supabase-js"

type ChatEventRow = {
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

export type FeedbackItem = {
  text: string
  count: number
}

export type FeedbackCategoryItem = {
  key: string
  label: string
  count: number
  examples: string[]
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
  aiTopAnswers: FeedbackItem[]
  feedbackTopItems: FeedbackItem[]
  feedbackCategoryTopItems: FeedbackCategoryItem[]
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

type Evidence = {
  avgRating: number
  helpfulCount: number
  sampleCount: number
}

type Recommendation = {
  recommendedAction: "manual_review" | "auto_apply"
  confidence: number
  reason: string
  proposedAnswer: string | null
  evidence: Evidence | null
}

export type AutoFixItem = {
  clusterKey: string
  questionText: string
  issueType: string
  repeatCount: number
  reviewCount: number
  distinctReporters: number
  firstSeenAt: string
  lastSeenAt: string
  aiOriginalAnswer: string | null
  aiTopAnswers: FeedbackItem[]
  proposedAnswer: string | null
  confidence: number
  recommendedAction: "manual_review" | "auto_apply"
  reason: string
  crowdFeedbackSummary: string
  feedbackTopItems: FeedbackItem[]
  feedbackCategoryTopItems: FeedbackCategoryItem[]
  feedbackTotal: number
  evidence: Evidence | null
  aiRerunAnswer?: string | null
  aiRerunStatus?: string
  aiRerunError?: string | null
  aiRerunSource?: "live" | "cache" | "disabled"
  aiRerunMode?: string
}

export type DryRunResult = {
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
  items: AutoFixItem[]
}

export type SingleRerunInput = {
  clusterKey: string
  questionText: string
  issueType: string
  feedbackTopItems?: FeedbackItem[]
  feedbackCategoryTopItems?: FeedbackCategoryItem[]
}

export type SingleRerunResult = {
  aiRerunAnswer: string | null
  aiRerunStatus: string
  aiRerunError: string | null
  aiRerunSource: "live" | "cache" | "disabled"
}

type CategoryRule = {
  key: string
  label: string
  patterns: RegExp[]
}

type AnswerStat = {
  answer: string
  avgRating: number
  helpfulCount: number
  sampleCount: number
}

const memoryCache = new Map<string, { answer: string | null; status: "ok" | "empty"; updatedAt: string }>()

const CATEGORY_RULES: CategoryRule[] = [
  {
    key: "wrong_answer",
    label: "回答錯誤",
    patterns: [/回答錯/i, /答錯/i, /資訊不正確/i, /不是這樣/i, /應該是/i, /說錯/i, /內容有誤/i],
  },
  {
    key: "missing_process",
    label: "缺少流程引導",
    patterns: [/流程/i, /步驟/i, /怎麼操作/i, /怎麼查/i, /去哪裡看/i, /如何申請/i],
  },
  {
    key: "missing_fields",
    label: "缺少必要欄位",
    patterns: [/欄位/i, /要填什麼/i, /填單/i, /照片/i, /上傳/i, /設備名稱/i, /問題描述/i],
  },
  {
    key: "pricing_rule",
    label: "計價規則錯誤",
    patterns: [/費用/i, /計算/i, /坪數/i, /租金/i, /房租/i, /停車費/i, /管理費/i, /固定金額/i],
  },
  {
    key: "policy_condition",
    label: "缺少條件限制",
    patterns: [/規約/i, /條件/i, /限制/i, /需登記/i, /需申請/i, /依公告/i, /依住戶決議/i],
  },
  {
    key: "missing_location",
    label: "缺少頁面位置",
    patterns: [/在哪裡看/i, /哪一頁/i, /哪個頁面/i, /管理室/i, /包裹頁/i, /報修頁/i, /首頁/i],
  },
  {
    key: "missing_time",
    label: "缺少時間資訊",
    patterns: [/時間/i, /何時/i, /多久/i, /到期日/i, /領取時間/i, /施工時間/i],
  },
  {
    key: "missing_exception",
    label: "缺少例外說明",
    patterns: [/例外/i, /特殊情況/i, /如果沒有/i, /若無/i, /週末/i, /假日/i, /訪客/i],
  },
  {
    key: "mixed_concepts",
    label: "概念混淆",
    patterns: [/混在一起/i, /不要混為一談/i, /搞混/i, /和.*不同/i, /分開計算/i, /不是同一件事/i],
  },
  {
    key: "too_vague",
    label: "內容太模糊",
    patterns: [/太少/i, /太模糊/i, /看不懂/i, /說明不足/i, /不夠清楚/i, /太簡略/i],
  },
]

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
    lowRiskIssueTypes: new Set(
      (process.env.AI_AUTO_FIX_LOW_RISK_TYPES || "low_similarity,low_rating,fallback")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
    enableAiRerun: boolEnv(process.env.AI_AUTO_FIX_ENABLE_RERUN, false),
    aiRerunMaxItems: numEnv(process.env.AI_AUTO_FIX_RERUN_MAX_ITEMS, 5),
    aiRerunConcurrency: Math.max(1, numEnv(process.env.AI_AUTO_FIX_RERUN_CONCURRENCY, 2)),
  }
}

function normalizeQuestion(question: unknown): string {
  return String(question || "").trim().toLowerCase()
}

function topEntries(map: Map<string, number>, limit = 5): FeedbackItem[] {
  return [...map.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit)
}

function classifyFeedback(feedback: string): { key: string; label: string } {
  const text = String(feedback || "").trim()
  if (!text) return { key: "other", label: "其他" }

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { key: rule.key, label: rule.label }
    }
  }

  return { key: "other", label: "其他" }
}

function topCategoryEntries(map: Map<string, FeedbackCategoryItem>, limit = 4): FeedbackCategoryItem[] {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function buildClusters(rows: ChatEventRow[]): Cluster[] {
  const clusters = new Map<
    string,
    {
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
      feedbackCategoryCount: Map<string, FeedbackCategoryItem>
      feedbackTotal: number
    }
  >()

  for (const row of rows) {
    const questionKey = normalizeQuestion(row.question)
    if (!questionKey) continue

    const issueType = row.issue_type || "unknown"
    const clusterId = `${questionKey}::${issueType}`

    if (!clusters.has(clusterId)) {
      clusters.set(clusterId, {
        clusterKey: questionKey,
        questionText: String(row.question || "").trim() || questionKey,
        issueType,
        repeatCount: 0,
        reviewCount: 0,
        distinctReporters: new Set<string>(),
        firstSeenAt: row.created_at,
        lastSeenAt: row.created_at,
        aiAnswerCount: new Map<string, number>(),
        feedbackCount: new Map<string, number>(),
        feedbackCategoryCount: new Map<string, FeedbackCategoryItem>(),
        feedbackTotal: 0,
      })
    }

    const cluster = clusters.get(clusterId)!
    cluster.repeatCount += 1
    if (row.needs_review) cluster.reviewCount += 1
    if (row.reporter_id) cluster.distinctReporters.add(row.reporter_id)

    const answer = String(row.answer || "").trim()
    if (answer) {
      cluster.aiAnswerCount.set(answer, (cluster.aiAnswerCount.get(answer) || 0) + 1)
    }

    const feedback = String(row.feedback || "").trim()
    if (feedback) {
      cluster.feedbackTotal += 1
      cluster.feedbackCount.set(feedback, (cluster.feedbackCount.get(feedback) || 0) + 1)

      const category = classifyFeedback(feedback)
      const current = cluster.feedbackCategoryCount.get(category.key)
      if (current) {
        current.count += 1
        if (!current.examples.includes(feedback) && current.examples.length < 4) {
          current.examples.push(feedback)
        }
      } else {
        cluster.feedbackCategoryCount.set(category.key, {
          key: category.key,
          label: category.label,
          count: 1,
          examples: [feedback],
        })
      }
    }

    if (row.created_at < cluster.firstSeenAt) cluster.firstSeenAt = row.created_at
    if (row.created_at > cluster.lastSeenAt) cluster.lastSeenAt = row.created_at
  }

  return [...clusters.values()].map((cluster) => ({
    clusterKey: cluster.clusterKey,
    questionText: cluster.questionText,
    issueType: cluster.issueType,
    repeatCount: cluster.repeatCount,
    reviewCount: cluster.reviewCount,
    distinctReporters: cluster.distinctReporters.size,
    firstSeenAt: cluster.firstSeenAt,
    lastSeenAt: cluster.lastSeenAt,
    aiTopAnswers: topEntries(cluster.aiAnswerCount, 3),
    feedbackTopItems: topEntries(cluster.feedbackCount, 5),
    feedbackCategoryTopItems: topCategoryEntries(cluster.feedbackCategoryCount, 4),
    feedbackTotal: cluster.feedbackTotal,
  }))
}

function scoreConfidence(evidence: Evidence): number {
  const ratingPart = Math.min(evidence.avgRating, 5) / 10
  const helpfulPart = Math.min(evidence.helpfulCount, 5) * 0.05
  const samplePart = Math.min(evidence.sampleCount, 10) * 0.02
  return Math.min(1, 0.45 + ratingPart + helpfulPart + samplePart)
}

function buildAnswerStatsByQuestion(rows: AnswerRow[]): Map<string, AnswerStat[]> {
  const byQuestion = new Map<
    string,
    Map<string, { answer: string; ratingSum: number; ratingCount: number; helpfulCount: number; sampleCount: number }>
  >()

  for (const row of rows) {
    const questionKey = normalizeQuestion(row.question)
    const answer = String(row.answer || "").trim()
    if (!questionKey || !answer) continue

    if (!byQuestion.has(questionKey)) byQuestion.set(questionKey, new Map())
    const answerMap = byQuestion.get(questionKey)!

    if (!answerMap.has(answer)) {
      answerMap.set(answer, {
        answer,
        ratingSum: 0,
        ratingCount: 0,
        helpfulCount: 0,
        sampleCount: 0,
      })
    }

    const current = answerMap.get(answer)!
    current.sampleCount += 1

    if (row.rating !== null && row.rating !== undefined) {
      current.ratingSum += Number(row.rating)
      current.ratingCount += 1
    }

    if (row.is_helpful === true) {
      current.helpfulCount += 1
    }
  }

  const result = new Map<string, AnswerStat[]>()
  for (const [questionKey, answerMap] of byQuestion.entries()) {
    result.set(
      questionKey,
      [...answerMap.values()].map((item) => ({
        answer: item.answer,
        avgRating: item.ratingCount > 0 ? item.ratingSum / item.ratingCount : 0,
        helpfulCount: item.helpfulCount,
        sampleCount: item.sampleCount,
      })),
    )
  }

  return result
}

function pickBestAnswer(answerStats: AnswerStat[]): { proposedAnswer: string; confidence: number; evidence: Evidence } | null {
  if (!Array.isArray(answerStats) || answerStats.length === 0) return null

  const top = [...answerStats].sort((a, b) => {
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
    if (b.helpfulCount !== a.helpfulCount) return b.helpfulCount - a.helpfulCount
    return b.sampleCount - a.sampleCount
  })[0]

  const evidence: Evidence = {
    avgRating: top.avgRating,
    helpfulCount: top.helpfulCount,
    sampleCount: top.sampleCount,
  }

  return {
    proposedAnswer: top.answer,
    confidence: scoreConfidence(evidence),
    evidence,
  }
}

function buildRecommendation(cluster: Cluster, best: { proposedAnswer: string; confidence: number; evidence: Evidence } | null, config: DryRunConfig): Recommendation {
  if (!best) {
    return {
      recommendedAction: "manual_review",
      confidence: 0,
      reason: "No stable historical answer available",
      proposedAnswer: null,
      evidence: null,
    }
  }

  const isLowRisk = config.lowRiskIssueTypes.has(cluster.issueType)
  const enoughConfidence = best.confidence >= config.autoApplyConfidenceThreshold

  if (config.forceManualReview) {
    return {
      recommendedAction: "manual_review",
      confidence: best.confidence,
      reason: "Manual review mode is enabled by configuration",
      proposedAnswer: best.proposedAnswer,
      evidence: best.evidence,
    }
  }

  if (isLowRisk && enoughConfidence) {
    return {
      recommendedAction: "auto_apply",
      confidence: best.confidence,
      reason: "Low-risk issue with high confidence candidate",
      proposedAnswer: best.proposedAnswer,
      evidence: best.evidence,
    }
  }

  return {
    recommendedAction: "manual_review",
    confidence: best.confidence,
    reason: isLowRisk ? "Confidence below auto-apply threshold" : "Issue type is not in low-risk list",
    proposedAnswer: best.proposedAnswer,
    evidence: best.evidence,
  }
}

function buildFeedbackContext(feedbackTopItems: FeedbackItem[] = []): string {
  return feedbackTopItems.slice(0, 4).map((item, index) => `${index + 1}. ${item.text}（${item.count} 次）`).join("\n")
}

function buildFeedbackCategoryContext(feedbackCategoryTopItems: FeedbackCategoryItem[] = []): string {
  return feedbackCategoryTopItems
    .slice(0, 4)
    .map((item, index) => {
      const example = item.examples?.[0] ? `，代表回饋：${item.examples[0]}` : ""
      return `${index + 1}. ${item.label}（${item.count} 次）${example}`
    })
    .join("\n")
}

function buildCrowdFeedbackReason(cluster: Cluster, proposedAnswer: string | null): string {
  const top = cluster.feedbackTopItems[0]
  if (top?.text) {
    return `多數 feedback 顯示「${top.text}」，因此建議改寫為：${proposedAnswer || "目前尚未產生穩定建議答案"}`
  }
  return `目前回饋主要反映此題需要調整，建議答案為：${proposedAnswer || "目前尚未產生穩定建議答案"}`
}

function buildCrowdFeedbackReasonV2(cluster: Cluster, proposedAnswer: string | null): string {
  const topCategory = cluster.feedbackCategoryTopItems[0]
  if (topCategory?.label) {
    return `群眾回饋主要集中在「${topCategory.label}」類，共 ${topCategory.count} 筆，因此建議改寫為：${proposedAnswer || "目前尚未產生穩定建議答案"}`
  }
  return buildCrowdFeedbackReason(cluster, proposedAnswer)
}

function buildRerunPrompt(question: string, feedbackTopItems: FeedbackItem[] = [], feedbackCategoryTopItems: FeedbackCategoryItem[] = []): string {
  const normalizedQuestion = String(question || "").trim()
  const feedbackContext = buildFeedbackCategoryContext(feedbackCategoryTopItems) || buildFeedbackContext(feedbackTopItems)
  if (!feedbackContext) return normalizedQuestion

  return [
    `原始問題：${normalizedQuestion}`,
    "使用者主要回饋：",
    feedbackContext,
    "請根據上述回饋修正回答，輸出一段精簡且可直接給住戶的繁體中文答案。",
  ].join("\n")
}

async function fetchAiAnswer(question: string, feedbackTopItems: FeedbackItem[], feedbackCategoryTopItems: FeedbackCategoryItem[], config: DryRunConfig): Promise<string> {
  if (!config.aiChatEndpoint) {
    throw new Error("AI_CHAT_ENDPOINT 未設定")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.aiChatTimeoutMs)

  try {
    const response = await fetch(config.aiChatEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: buildRerunPrompt(question, feedbackTopItems, feedbackCategoryTopItems) }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`AI API HTTP ${response.status}`)
    }

    const payload = await response.json()
    return String(payload?.answer || "").trim()
  } finally {
    clearTimeout(timeout)
  }
}

function buildCacheKey(input: {
  clusterKey: string
  issueType: string
  feedbackTopItems?: FeedbackItem[]
  feedbackCategoryTopItems?: FeedbackCategoryItem[]
}): string {
  const feedbackSignature = (input.feedbackTopItems || [])
    .slice(0, 4)
    .map((item) => `${item.text}:${item.count}`)
    .join("|")

  const categorySignature = (input.feedbackCategoryTopItems || [])
    .slice(0, 4)
    .map((item) => `${item.key}:${item.count}`)
    .join("|")

  return `${input.clusterKey || ""}::${input.issueType || ""}::${feedbackSignature}::${categorySignature}`
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await tasks[currentIndex]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

async function enrichAllItemsWithAi(items: AutoFixItem[], config: DryRunConfig) {
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

  const targets = items.slice(0, Math.max(0, config.aiRerunMaxItems))
  const tasks = targets.map((item) => async () => {
    const key = buildCacheKey(item)
    const cached = memoryCache.get(key)

    item.aiRerunAnswer = null
    item.aiRerunStatus = "pending"
    item.aiRerunError = null
    item.aiRerunSource = "live"
    item.aiRerunMode = "feedback_aware"

    if (cached && (cached.status === "ok" || cached.status === "empty")) {
      item.aiRerunAnswer = cached.answer || null
      item.aiRerunStatus = cached.status
      item.aiRerunSource = "cache"
      summary.cached += 1
      if (cached.status === "ok") summary.ok += 1
      if (cached.status === "empty") summary.empty += 1
      return
    }

    summary.ran += 1

    try {
      const answer = await fetchAiAnswer(item.questionText || item.clusterKey, item.feedbackTopItems || [], item.feedbackCategoryTopItems || [], config)
      item.aiRerunAnswer = answer || null
      item.aiRerunStatus = answer ? "ok" : "empty"
      item.aiRerunError = null
      item.aiRerunSource = "live"

      memoryCache.set(key, {
        answer: item.aiRerunAnswer,
        status: answer ? "ok" : "empty",
        updatedAt: new Date().toISOString(),
      })

      if (answer) summary.ok += 1
      else summary.empty += 1
    } catch (error) {
      item.aiRerunStatus = "error"
      item.aiRerunError = error instanceof Error ? error.message : "AI rerun failed"
      item.aiRerunSource = "live"
      summary.failed += 1
    }
  })

  await runWithConcurrency(tasks, config.aiRerunConcurrency)

  if (items.length > targets.length) {
    items.slice(targets.length).forEach((item) => {
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

async function loadRecentRows(supabase: ReturnType<typeof createClient>, config: DryRunConfig): Promise<ChatEventRow[]> {
  const from = new Date(Date.now() - config.windowDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("chat_events")
    .select("source_pk, created_at, question, answer, feedback, needs_review, issue_type, user_id")
    .gte("created_at", from)

  if (error) {
    console.warn("[ai-auto-fix] loadRecentRows failed:", error)
    return []
  }

  return (data || []).map((row: any) => ({
    id: String(row.source_pk || row.id || ""),
    created_at: row.created_at,
    question: row.question || "",
    answer: row.answer || null,
    feedback: row.feedback || null,
    needs_review: Boolean(row.needs_review),
    issue_type: row.issue_type || null,
    reporter_id: row.user_id || null,
  }))
}

async function loadAnswerRows(supabase: ReturnType<typeof createClient>): Promise<AnswerRow[]> {
  const { data, error } = await supabase
    .from("chat_events")
    .select("question, answer, rating, is_helpful")
    .eq("source", "chat_history")

  if (error) {
    console.warn("[ai-auto-fix] loadAnswerRows failed:", error)
    return []
  }

  return (data || []) as AnswerRow[]
}

export async function rerunAutoFixItem(_tenantId: "tenant_a" | "tenant_b", input: SingleRerunInput): Promise<SingleRerunResult> {
  const config = getConfig()

  if (!config.aiChatEndpoint) {
    return {
      aiRerunAnswer: null,
      aiRerunStatus: "error",
      aiRerunError: "AI_CHAT_ENDPOINT 未設定",
      aiRerunSource: "disabled",
    }
  }

  const key = buildCacheKey(input)
  const cached = memoryCache.get(key)

  if (cached && (cached.status === "ok" || cached.status === "empty")) {
    return {
      aiRerunAnswer: cached.answer || null,
      aiRerunStatus: cached.status,
      aiRerunError: null,
      aiRerunSource: "cache",
    }
  }

  try {
    const answer = await fetchAiAnswer(input.questionText || input.clusterKey, input.feedbackTopItems || [], input.feedbackCategoryTopItems || [], {
      ...config,
      enableAiRerun: true,
    })

    const status = answer ? "ok" : "empty"
    memoryCache.set(key, {
      answer: answer || null,
      status,
      updatedAt: new Date().toISOString(),
    })

    return {
      aiRerunAnswer: answer || null,
      aiRerunStatus: status,
      aiRerunError: null,
      aiRerunSource: "live",
    }
  } catch (error) {
    return {
      aiRerunAnswer: null,
      aiRerunStatus: "error",
      aiRerunError: error instanceof Error ? error.message : "AI rerun failed",
      aiRerunSource: "live",
    }
  }
}

export async function runAutoFixDryRun(tenantId: "tenant_a" | "tenant_b"): Promise<DryRunResult> {
  const config = getConfig()
  const supabase = createSupabaseClient(tenantId)

  const [recentRows, answerRows] = await Promise.all([loadRecentRows(supabase, config), loadAnswerRows(supabase)])

  const clusters = buildClusters(recentRows)
  const answerStatsByQuestion = buildAnswerStatsByQuestion(answerRows)

  const triggeredClusters = clusters.filter(
    (cluster) => cluster.reviewCount >= config.repeatThreshold || cluster.repeatCount >= config.repeatThreshold,
  )

  const items: AutoFixItem[] = triggeredClusters
    .map((cluster) => {
      const answerStats = answerStatsByQuestion.get(cluster.clusterKey) || []
      const best = pickBestAnswer(answerStats)
      const recommendation = buildRecommendation(cluster, best, config)

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
        proposedAnswer: recommendation.proposedAnswer,
        confidence: Number(recommendation.confidence.toFixed(4)),
        recommendedAction: recommendation.recommendedAction,
        reason: recommendation.reason,
        crowdFeedbackSummary: buildCrowdFeedbackReasonV2(cluster, recommendation.proposedAnswer),
        feedbackTopItems: cluster.feedbackTopItems,
        feedbackCategoryTopItems: cluster.feedbackCategoryTopItems,
        feedbackTotal: cluster.feedbackTotal,
        evidence: recommendation.evidence,
      }
    })
    .sort((a, b) => b.confidence - a.confidence || b.reviewCount - a.reviewCount)

  const aiRerun = await enrichAllItemsWithAi(items, config)

  return {
    summary: {
      totalRows: recentRows.length,
      totalClusters: clusters.length,
      triggeredClusters: items.length,
      autoApplyCount: items.filter((item) => item.recommendedAction === "auto_apply").length,
      manualReviewCount: items.filter((item) => item.recommendedAction === "manual_review").length,
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
