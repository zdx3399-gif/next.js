"use client"

import { useEffect, useMemo, useState } from "react"

type ModuleStat = {
  key: string
  title: string
  count: number
  actionLink: string
  kmsLink: string
}

type RoutineItem = {
  id: string
  title: string
  dueDate: string
  actionLink: string
  kmsLink: string
  assigneeRole: string
  status?: "pending" | "in_progress" | "completed"
}

type NotificationEvent = {
  id: string
  title: string
  message: string
  actionLink: string
  createdAt: string
}

type Payload = {
  modules: ModuleStat[]
  routines: RoutineItem[]
  notifications: NotificationEvent[]
  legacyPendingCount: number
  totalPending: number
  generatedAt: string
}

type Props = {
  userId?: string
  role?: string
  onNavigate: (link: string) => void
}

function getTenantId() {
  if (typeof window === "undefined") return "tenant_a"
  return localStorage.getItem("currentTenant") || "tenant_a"
}

function toLocale(input: string) {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input
  return d.toLocaleString("zh-TW", { hour12: false })
}

function getModuleIcon(moduleKey: string) {
  const iconMap: Record<string, string> = {
    emergencies: "warning",
    maintenance: "build",
    community: "forum",
    packages: "inventory_2",
    finance: "account_balance",
    decryption: "lock_open",
  }
  return iconMap[moduleKey] || "task"
}

function normalizeSopLink(link?: string) {
  if (!link) return "/admin?section=handover-knowledge"
  if (link.includes("section=knowledge-base")) {
    return "/admin?section=handover-knowledge"
  }
  return link
}

export function ActionSpotlightPanel({ userId, role = "committee", onNavigate }: Props) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bellOpen, setBellOpen] = useState(false)

  const tenantId = useMemo(() => getTenantId(), [])
  const bellStorageKey = `bell-last-seen:${tenantId}:${userId || role}`

  const unreadCount = useMemo(() => {
    if (!data?.notifications?.length) return 0
    if (typeof window === "undefined") return data.notifications.length
    const lastSeen = localStorage.getItem(bellStorageKey)
    if (!lastSeen) return data.notifications.length
    const seenAt = new Date(lastSeen).getTime()
    return data.notifications.filter((n) => new Date(n.createdAt).getTime() > seenAt).length
  }, [data, bellStorageKey])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        tenantId,
        role,
        userId: userId || "",
      })
      const res = await fetch(`/api/dashboard/action-items?${params.toString()}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "載入待辦失敗")
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "載入待辦失敗")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [tenantId, role, userId])

  const handleBellClick = () => {
    setBellOpen((v) => !v)
    if (typeof window !== "undefined") {
      localStorage.setItem(bellStorageKey, new Date().toISOString())
    }
  }

  const completeRoutine = async (instanceId: string) => {
    if (!userId) return
    const res = await fetch("/api/routine/instances", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, instanceId, status: "completed", completedBy: userId }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--theme-text-primary)]">待辦事項</h2>
          </div>
          <div className="relative flex items-center gap-2">
            <button
              onClick={fetchData}
              className="rounded-lg border border-[var(--theme-border)] px-3 py-2 text-sm hover:bg-[var(--theme-accent-light)]"
              title="重新整理"
              disabled={loading}
            >
              <span className="inline-flex items-center gap-1">
                <span className="material-icons text-base">refresh</span>
                重新整理
              </span>
            </button>
            <button
              onClick={handleBellClick}
              className={`relative rounded-lg border px-3 py-2 transition-colors ${
                bellOpen
                  ? "border-[var(--theme-border-accent)] bg-[var(--theme-accent-light)]"
                  : "border-[var(--theme-border)] hover:bg-[var(--theme-accent-light)]"
              }`}
              title="通知"
            >
              <span className="material-icons">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <section className="absolute right-0 top-full mt-2 z-30 w-[min(92vw,380px)] border border-[var(--theme-border-accent)] rounded-xl p-3 bg-[var(--theme-bg-primary)] shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-[var(--theme-text-primary)]">通知中心</div>
                  <button
                    className="text-xs text-[var(--theme-text-secondary)] hover:text-[var(--theme-accent)]"
                    onClick={() => setBellOpen(false)}
                  >
                    收合
                  </button>
                </div>

                <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-2">
                  <div className="text-[11px] text-[var(--theme-text-secondary)] px-1 pb-2">System Assistant</div>
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {(data?.notifications || []).length === 0 && (
                      <div className="text-sm text-[var(--theme-text-secondary)] px-2 py-3">目前沒有新通知</div>
                    )}
                    {(data?.notifications || []).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => onNavigate(n.actionLink)}
                        className="w-full text-left p-1 rounded-lg hover:bg-[var(--theme-accent-light)]/60"
                      >
                        <div className="flex items-start gap-2">
                          <span className="material-icons text-sm mt-1 text-[var(--theme-accent)]">smart_toy</span>
                          <div className="max-w-full">
                            <div className="inline-block rounded-2xl rounded-tl-md border border-[var(--theme-border)] bg-[var(--theme-bg-primary)] px-3 py-2">
                              <div className="text-sm font-semibold text-[var(--theme-text-primary)]">{n.title}</div>
                              <div className="text-xs text-[var(--theme-text-secondary)] mt-1 break-words">{n.message}</div>
                            </div>
                            <div className="text-[11px] text-[var(--theme-text-secondary)] mt-1 ml-1">{toLocale(n.createdAt)}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        {loading && <div className="text-sm text-[var(--theme-text-secondary)]">載入待辦中...</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {!loading && !error && data && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2 py-1 rounded bg-[var(--theme-accent-light)] text-[var(--theme-accent)] text-sm font-semibold">
                總待辦：{data.totalPending}
              </span>
              {data.legacyPendingCount > 0 && (
                <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-sm font-semibold">
                  遺留未結案：{data.legacyPendingCount}
                </span>
              )}
              <span className="px-2 py-1 rounded bg-[var(--theme-bg-primary)] border border-[var(--theme-border)] text-[var(--theme-text-secondary)] text-xs">
                更新時間：{toLocale(data.generatedAt)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {data.modules.map((m) => (
                <button
                  key={m.key}
                  onClick={() => onNavigate(m.actionLink)}
                  className="text-left border border-[var(--theme-border)] rounded-xl p-3 hover:bg-[var(--theme-accent-light)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-[var(--theme-text-secondary)]">{m.title}</div>
                    <span className="material-icons text-base text-[var(--theme-accent)]">{getModuleIcon(m.key)}</span>
                  </div>
                  <div className="text-2xl font-bold text-[var(--theme-text-primary)] mt-1">{m.count}</div>
                  <div className="text-xs text-[var(--theme-accent)] mt-1">前往待處理列表</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-sky-50/10 border border-sky-400/30 rounded-2xl p-4 sm:p-5 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-[var(--theme-text-primary)] mb-3">週期性任務（Routine Tasks）</h3>
        {(data?.routines || []).length === 0 && (
          <p className="text-sm text-[var(--theme-text-secondary)]">目前沒有到期的例行任務。</p>
        )}
        <div className="space-y-2">
          {(data?.routines || []).map((item) => (
            <div key={item.id} className="border border-[var(--theme-border)] rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--theme-text-primary)]">{item.title}</div>
                  <div className="text-xs text-[var(--theme-text-secondary)]">期限：{item.dueDate}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onNavigate(item.actionLink)}
                    className="px-2 py-1 text-xs rounded border border-[var(--theme-border)] hover:bg-[var(--theme-accent-light)]"
                  >
                    去處理
                  </button>
                  <button
                    onClick={() => onNavigate(normalizeSopLink(item.kmsLink))}
                    className="px-2 py-1 text-xs rounded border border-[var(--theme-border)] hover:bg-[var(--theme-accent-light)]"
                  >
                    SOP（KMS）
                  </button>
                  {userId && item.status !== "completed" && (
                    <button
                      onClick={() => completeRoutine(item.id)}
                      className="px-2 py-1 text-xs rounded bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
                    >
                      完成
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
