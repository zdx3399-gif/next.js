"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"

type RecommendedAction = "manual_review" | "auto_apply" | string

type FeedbackItem = {
  text: string
  count: number
}

type FeedbackCategoryItem = {
  key: string
  label: string
  count: number
  examples?: string[]
}

type AutoFixItem = {
  clusterKey: string
  confidence: number
  issueType: string
  repeatCount: number
  reviewCount: number
  distinctReporters: number
  reason?: string
  recommendedAction: RecommendedAction
  crowdFeedbackSummary?: string
  aiOriginalAnswer?: string
  proposedAnswer?: string
  aiRerunStatus?: string
  aiRerunSource?: string
  aiRerunError?: string
  aiRerunAnswer?: string
  feedbackTopItems?: FeedbackItem[]
  feedbackCategoryTopItems?: FeedbackCategoryItem[]
  feedbackTotal?: number
}

type AutoFixSummary = {
  totalRows: number
  totalClusters: number
  triggeredClusters: number
  autoApplyCount: number
  manualReviewCount: number
}

type AutoFixPayload = {
  summary: AutoFixSummary
  items: AutoFixItem[]
}

const ISSUE_TYPE_LABEL: Record<string, string> = {
  low_similarity: "相似度過低",
  low_rating: "評分過低",
  fallback: "降級搜尋",
  no_match: "查無匹配",
}

const REASON_LABEL: Record<string, string> = {
  "Manual review mode is enabled by configuration": "目前系統設定為人工審核模式",
  "No stable historical answer available": "沒有足夠穩定的歷史正解可直接套用",
  "Low-risk issue with high confidence candidate": "低風險問題且候選答案信心高",
  "Confidence below auto-apply threshold": "候選答案信心分數低於自動套用門檻",
  "Issue type is not in low-risk list": "問題類型不在低風險可自動修正清單內",
}

const RERUN_STATUS_LABEL: Record<string, string> = {
  ok: "成功",
  empty: "模型沒有產生內容",
  error: "執行失敗",
  pending: "等待中",
}

function issueTypeLabel(code?: string): string {
  if (!code) return "未標記"
  return ISSUE_TYPE_LABEL[code] || code
}

function reasonLabel(reason?: string): string {
  if (!reason) return "尚未提供"
  return REASON_LABEL[reason] || reason
}

function statusLabel(status?: string): string {
  if (!status) return "未執行"
  return RERUN_STATUS_LABEL[status] || status
}

export function AiAutoFixPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AutoFixSummary | null>(null)
  const [items, setItems] = useState<AutoFixItem[]>([])

  const [issueFilter, setIssueFilter] = useState("all")
  const [actionFilter, setActionFilter] = useState("all")
  const [confidenceFilter, setConfidenceFilter] = useState("0")
  const [keywordFilter, setKeywordFilter] = useState("")

  const issueOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.issueType).filter(Boolean))).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    const minConfidence = Number(confidenceFilter || 0)
    const keyword = keywordFilter.trim().toLowerCase()

    return items.filter((item) => {
      if (issueFilter !== "all" && item.issueType !== issueFilter) return false
      if (actionFilter !== "all" && item.recommendedAction !== actionFilter) return false
      if (item.confidence < minConfidence) return false

      if (keyword) {
        const haystack = [
          item.clusterKey || "",
          item.aiOriginalAnswer || "",
          item.proposedAnswer || "",
          item.crowdFeedbackSummary || "",
        ]
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(keyword)) return false
      }

      return true
    })
  }, [items, issueFilter, actionFilter, confidenceFilter, keywordFilter])

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const tenant = typeof window !== "undefined" ? localStorage.getItem("currentTenant") || "tenant_a" : "tenant_a"
      const res = await fetch(`/api/ai-auto-fix/dry-run?tenant=${encodeURIComponent(tenant)}`, { cache: "no-store" })
      const json = await res.json()

      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.error || "無法取得 AI 自動修正資料")
      }

      const payload = json.data as AutoFixPayload
      setSummary(payload.summary)
      setItems(payload.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取資料時發生未知錯誤")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg-primary)] p-4 sm:p-5">
        <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">AI 自動修正測試看板</h3>
        <p className="mt-1 text-sm text-[var(--theme-text-secondary)]">
          這裡會顯示 dry-run 的分群結果、建議修正答案，以及群眾回饋的分類摘要。
        </p>

        {readOnly ? (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-sm"
            style={{
              border: "1px solid rgba(245, 158, 11, 0.4)",
              background: "rgba(245, 158, 11, 0.12)",
              color: "var(--theme-text-primary)",
            }}
          >
            你目前是唯讀模式，可以查看建議結果，但不會直接套用修正。
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="最近回饋筆數" value={summary?.totalRows} />
          <KpiCard label="問題分群數" value={summary?.totalClusters} />
          <KpiCard label="觸發建議群數" value={summary?.triggeredClusters} />
          <KpiCard label="可直接修正" value={summary?.autoApplyCount} />
          <KpiCard label="待人工確認" value={summary?.manualReviewCount} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-sm font-semibold text-[var(--theme-bg-primary)] hover:opacity-90"
          >
            重新載入
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="問題類型">
            <select
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              className="w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg-card)] px-2 py-2 text-sm text-[var(--theme-text-primary)]"
            >
              <option value="all">全部</option>
              {issueOptions.map((value) => (
                <option key={value} value={value}>
                  {issueTypeLabel(value)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="建議動作">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg-card)] px-2 py-2 text-sm text-[var(--theme-text-primary)]"
            >
              <option value="all">全部</option>
              <option value="manual_review">人工確認</option>
              <option value="auto_apply">直接修正</option>
            </select>
          </Field>

          <Field label="最低信心分數">
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg-card)] px-2 py-2 text-sm text-[var(--theme-text-primary)]"
            />
          </Field>

          <Field label="關鍵字搜尋">
            <input
              type="text"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder="搜尋問題、答案或回饋摘要"
              className="w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg-card)] px-2 py-2 text-sm text-[var(--theme-text-primary)]"
            />
          </Field>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-primary)] p-4 text-sm text-[var(--theme-text-secondary)]">
          正在讀取 AI 自動修正資料...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-[var(--theme-danger)] bg-[var(--theme-bg-primary)] p-4 text-sm text-[var(--theme-danger)]">
          {error}
        </div>
      ) : null}

      {!loading && !error && filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg-primary)] p-4 text-sm text-[var(--theme-text-secondary)]">
          目前沒有符合條件的修正建議。
        </div>
      ) : null}

      {!loading && !error && filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isAuto = item.recommendedAction === "auto_apply"
            const actionLabel = isAuto ? "建議直接修正" : "建議人工確認"
            const confidenceText = Number.isFinite(item.confidence) ? item.confidence.toFixed(2) : "0.00"
            const feedbackList = Array.isArray(item.feedbackTopItems) ? item.feedbackTopItems.slice(0, 3) : []
            const feedbackCategoryList = Array.isArray(item.feedbackCategoryTopItems) ? item.feedbackCategoryTopItems.slice(0, 3) : []
            const totalFeedback = Math.max(1, item.feedbackTotal || 0)

            return (
              <div key={`${item.clusterKey}-${item.issueType}-${confidenceText}`} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-primary)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-bold text-[var(--theme-text-primary)]">{item.clusterKey || "未命名群組"}</h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        isAuto ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {actionLabel}
                    </span>
                    <span className="rounded-full bg-[var(--theme-accent-light)] px-2 py-1 text-[var(--theme-accent)]">
                      信心分數 {confidenceText}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-xs text-[var(--theme-text-secondary)]">
                  問題類型：{issueTypeLabel(item.issueType)} ｜ 重複次數：{item.repeatCount || 0} ｜ 被標記待審核：{item.reviewCount || 0} 次 ｜ 不同回報者：{item.distinctReporters || 0}
                </p>
                <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">系統判斷原因：{reasonLabel(item.reason)}</p>
                <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">
                  AI 補跑狀態：{statusLabel(item.aiRerunStatus)}（來源：{item.aiRerunSource === "cache" ? "快取" : item.aiRerunSource === "live" ? "即時" : "disabled"}）
                  {item.aiRerunError ? `，錯誤：${item.aiRerunError}` : ""}
                </p>

                <div className="mt-3 rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-3 text-sm text-[var(--theme-text-primary)]">
                  修改原因：{item.crowdFeedbackSummary || "目前尚無足夠回饋摘要。"}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <AnswerPane title="AI 舊回答（常見版本）" content={item.aiOriginalAnswer || "目前沒有穩定舊回答。"} tone="old" />
                  <AnswerPane title="建議修改答案" content={item.proposedAnswer || "目前尚未產生建議答案。"} tone="new" />
                </div>

                <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-3 text-sm text-[var(--theme-text-primary)] whitespace-pre-wrap">
                  AI 補跑答案：
                  {"\n"}
                  {item.aiRerunAnswer || "目前沒有 AI 補跑內容。"}
                </div>

                <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-3">
                  <div className="mb-2 text-xs text-[var(--theme-text-secondary)]">群眾回饋分類（Top 3）</div>

                  {feedbackCategoryList.length > 0 ? (
                    <div className="space-y-3">
                      {feedbackCategoryList.map((feedback, idx) => {
                        const ratio = Math.max(0, Math.min(100, Math.round((feedback.count / totalFeedback) * 100)))
                        return (
                          <div key={`${feedback.key}-${idx}`}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--theme-text-primary)]">
                              <span>{feedback.label}</span>
                              <span>
                                {feedback.count} 次，{ratio}%
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
                              <span className="block h-full rounded-full bg-[var(--theme-accent)]" style={{ width: `${ratio}%` }} />
                            </div>
                            {Array.isArray(feedback.examples) && feedback.examples.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                {feedback.examples.slice(0, 2).map((example, exampleIdx) => (
                                  <div
                                    key={`${feedback.key}-example-${exampleIdx}`}
                                    className="rounded-md bg-[var(--theme-bg-primary)] px-2 py-1 text-xs text-[var(--theme-text-secondary)]"
                                  >
                                    {example}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : feedbackList.length > 0 ? (
                    <div className="space-y-2">
                      {feedbackList.map((feedback, idx) => {
                        const ratio = Math.max(0, Math.min(100, Math.round((feedback.count / totalFeedback) * 100)))
                        return (
                          <div key={`${feedback.text}-${idx}`}>
                            <div className="mb-1 text-xs text-[var(--theme-text-primary)]">
                              {feedback.text}（{feedback.count} 次，{ratio}%）
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
                              <span className="block h-full rounded-full bg-[var(--theme-accent)]" style={{ width: `${ratio}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--theme-text-secondary)]">目前沒有可視化的群眾回饋資料。</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-3">
      <div className="text-xs text-[var(--theme-text-secondary)]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--theme-text-primary)]">{value ?? "-"}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-primary)] p-2">
      <label className="mb-1 block text-xs text-[var(--theme-text-secondary)]">{label}</label>
      {children}
    </div>
  )
}

function AnswerPane({ title, content, tone }: { title: string; content: string; tone: "old" | "new" }) {
  const toneStyle =
    tone === "old"
      ? {
          borderColor: "rgba(245, 158, 11, 0.45)",
          background: "rgba(245, 158, 11, 0.12)",
        }
      : {
          borderColor: "rgba(16, 185, 129, 0.45)",
          background: "rgba(16, 185, 129, 0.12)",
        }

  return (
    <div className="rounded-lg border p-3" style={toneStyle}>
      <div className="mb-1 text-xs text-[var(--theme-text-secondary)]">{title}</div>
      <div className="whitespace-pre-wrap text-sm text-[var(--theme-text-primary)]">{content}</div>
    </div>
  )
}
