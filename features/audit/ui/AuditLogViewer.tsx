"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getSupabaseClient } from "@/lib/supabase"
import { ACTION_TYPE_LABELS, TARGET_TYPE_LABELS } from "@/lib/audit"
import type { User } from "@/features/profile/api/profile"

interface AuditLog {
  id: string
  operator_id: string
  operator_role: string
  action_type: string
  target_type: string
  target_id: string
  reason: string
  before_state: any
  after_state: any
  additional_data: any
  related_request_id: string | null
  created_at: string
}

interface AuditLogViewerProps {
  currentUser?: User
}

export function AuditLogViewer({ currentUser }: AuditLogViewerProps = {}) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadLogs()
  }, [actionFilter, targetTypeFilter])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        console.log("[v0] Supabase client not available")
        setLogs([])
        return
      }

      let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100)

      if (actionFilter && actionFilter !== "all") {
        // 支援前綴匹配（如 decryption_、create_、update_、delete_）
        if (actionFilter.endsWith("_")) {
          query = query.like("action_type", `${actionFilter}%`)
        } else {
          query = query.eq("action_type", actionFilter)
        }
      }

      if (targetTypeFilter && targetTypeFilter !== "all") {
        query = query.eq("target_type", targetTypeFilter)
      }

      if (searchQuery) {
        query = query.or(`reason.ilike.%${searchQuery}%,operator_id.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error
      setLogs(data || [])
    } catch (error: any) {
      console.error("[v0] Error loading audit logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }

  // 使用統一的標籤（從 lib/audit.ts 導入），並補充舊格式的相容性
  const actionTypeLabels: Record<string, string> = {
    ...ACTION_TYPE_LABELS,
    // 舊格式相容
    decrypt: "解密",
    remove_post: "下架貼文",
    redact_post: "遮蔽貼文",
    decryption_admin_approved: "管理員核准解密",
  }

  const targetTypeLabels: Record<string, string> = {
    ...TARGET_TYPE_LABELS,
  }

  const getActionBadgeColor = (action: string) => {
    const colors: Record<string, string> = {
      decrypt: "bg-purple-600 text-white",
      remove_post: "bg-red-600 text-white",
      remove: "bg-red-600 text-white",
      redact_post: "bg-orange-600 text-white",
      redact: "bg-orange-600 text-white",
      approve: "bg-green-600 text-white",
      reject_report: "bg-blue-600 text-white",
      ban_user: "bg-red-800 text-white",
      shadow: "bg-gray-600 text-white",
    }
    return colors[action] || "bg-gray-500 text-white"
  }

  const renderStateDiff = (before: any, after: any) => {
    if (!before && !after) return null

    const beforeKeys = before ? Object.keys(before) : []
    const afterKeys = after ? Object.keys(after) : []
    const allKeys = [...new Set([...beforeKeys, ...afterKeys])]

    const changes = allKeys.filter((key) => {
      const beforeVal = before?.[key]
      const afterVal = after?.[key]
      return JSON.stringify(beforeVal) !== JSON.stringify(afterVal)
    })

    if (changes.length === 0) return null

    return (
      <div className="mt-3 p-3 bg-[var(--theme-bg-primary)] rounded-lg text-sm">
        <div className="font-medium mb-2 text-[var(--theme-text-primary)]">狀態變更</div>
        <div className="space-y-2">
          {changes.map((key) => (
            <div key={key} className="grid grid-cols-3 gap-2">
              <div className="font-medium text-[var(--theme-text-secondary)]">{key}</div>
              <div className="text-red-500 line-through">
                {before?.[key] !== undefined ? JSON.stringify(before[key]) : "(無)"}
              </div>
              <div className="text-green-500">{after?.[key] !== undefined ? JSON.stringify(after[key]) : "(無)"}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="material-icons animate-spin text-4xl text-[var(--theme-accent)]">refresh</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋原因或操作者..."
          className="flex-1 min-w-[200px]"
        />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="全部動作" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部動作</SelectItem>
            <SelectItem value="login">登入相關</SelectItem>
            <SelectItem value="approve">核准發布</SelectItem>
            <SelectItem value="remove">下架內容</SelectItem>
            <SelectItem value="redact">遮蔽敏感</SelectItem>
            <SelectItem value="shadow">影子封禁</SelectItem>
            <SelectItem value="ban_user">禁言用戶</SelectItem>
            <SelectItem value="decryption_">解密相關</SelectItem>
            <SelectItem value="create_">建立相關</SelectItem>
            <SelectItem value="update_">更新相關</SelectItem>
            <SelectItem value="delete_">刪除相關</SelectItem>
          </SelectContent>
        </Select>
        <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            <SelectItem value="post">貼文</SelectItem>
            <SelectItem value="comment">留言</SelectItem>
            <SelectItem value="knowledge_card">知識卡</SelectItem>
            <SelectItem value="announcement">公告</SelectItem>
            <SelectItem value="vote">投票</SelectItem>
            <SelectItem value="user">用戶</SelectItem>
            <SelectItem value="decryption_request">解密申請</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={loadLogs}>搜尋</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-[var(--theme-accent)]">{logs.length}</div>
          <div className="text-xs text-[var(--theme-text-secondary)]">總記錄數</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-red-500">
            {logs.filter((l) => l.action_type === "remove" || l.action_type === "remove_post").length}
          </div>
          <div className="text-xs text-[var(--theme-text-secondary)]">下架操作</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-orange-500">
            {logs.filter((l) => l.action_type === "redact" || l.action_type === "redact_post").length}
          </div>
          <div className="text-xs text-[var(--theme-text-secondary)]">遮蔽操作</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-purple-500">
            {logs.filter((l) => l.action_type === "decrypt").length}
          </div>
          <div className="text-xs text-[var(--theme-text-secondary)]">解密操作</div>
        </Card>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <Card className="p-8 text-center text-[var(--theme-text-secondary)]">
            <span className="material-icons text-4xl mb-2 opacity-50">inbox</span>
            <p>尚無稽核記錄</p>
          </Card>
        ) : (
          logs.map((log) => (
            <Card key={log.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex gap-3 items-start">
                <span className="material-icons text-[var(--theme-accent)] text-3xl">
                  {log.action_type === "decrypt"
                    ? "lock_open"
                    : log.action_type.includes("remove")
                      ? "delete"
                      : log.action_type.includes("redact")
                        ? "visibility_off"
                        : log.action_type === "approve"
                          ? "check_circle"
                          : log.action_type === "shadow"
                            ? "visibility_off"
                            : "history"}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    <Badge className={getActionBadgeColor(log.action_type)}>
                      {actionTypeLabels[log.action_type] || log.action_type}
                    </Badge>
                    <Badge variant="outline">{targetTypeLabels[log.target_type] || log.target_type}</Badge>
                    <Badge variant="secondary">{log.operator_role}</Badge>
                  </div>

                  <p className="text-[var(--theme-text-primary)] font-medium mb-2">{log.reason || "(未填寫原因)"}</p>

                  <div className="flex flex-wrap gap-4 items-center text-xs text-[var(--theme-text-secondary)]">
                    <span className="flex gap-1 items-center">
                      <span className="material-icons text-sm">person</span>
                      操作者: {log.operator_id?.slice(0, 8) || "系統"}
                    </span>
                    <span className="flex gap-1 items-center">
                      <span className="material-icons text-sm">schedule</span>
                      {new Date(log.created_at).toLocaleString("zh-TW")}
                    </span>
                    <span className="flex gap-1 items-center">
                      <span className="material-icons text-sm">article</span>
                      目標: {log.target_id?.slice(0, 8)}
                    </span>
                  </div>

                  <div className="mt-3">
                    <Button variant="ghost" size="sm" onClick={() => toggleExpand(log.id)} className="text-xs">
                      <span className="material-icons text-sm mr-1">
                        {expandedLogs.has(log.id) ? "expand_less" : "expand_more"}
                      </span>
                      {expandedLogs.has(log.id) ? "收合詳情" : "查看詳情"}
                    </Button>

                    {expandedLogs.has(log.id) && (
                      <div className="mt-2 space-y-2">
                        {renderStateDiff(log.before_state, log.after_state)}

                        {log.additional_data && Object.keys(log.additional_data).length > 0 && (
                          <div className="p-3 bg-[var(--theme-bg-primary)] rounded-lg">
                            <div className="font-medium mb-2 text-sm text-[var(--theme-text-primary)]">附加資料</div>
                            <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-[var(--theme-text-secondary)]">
                              {JSON.stringify(log.additional_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
