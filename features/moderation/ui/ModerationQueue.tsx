"use client"

import type React from "react"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useModerationQueue } from "../hooks/useModeration"
import type { User } from "@/features/profile/api/profile"
import { HelpHint } from "@/components/ui/help-hint"

interface ModerationQueueProps {
  currentUser: User
  onSelectItem: (itemId: string) => void
  selectedItemId?: string
  compact?: boolean
}

export function ModerationQueue({ currentUser, onSelectItem, selectedItemId, compact = false }: ModerationQueueProps) {
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(undefined)
  const { queue, loading, error, assign } = useModerationQueue({
    status: statusFilter,
    priority: priorityFilter,
  })

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { label: string; className: string }> = {
      urgent: { label: "緊急", className: "bg-red-600 text-white" },
      high: { label: "高", className: "bg-orange-500 text-white" },
      medium: { label: "中", className: "bg-yellow-500 text-white" },
      low: { label: "低", className: "bg-gray-500 text-white" },
    }
    return config[priority] || config.low
  }

  const getItemTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      post: "貼文",
      comment: "留言",
      report: "檢舉",
    }
    return labels[type] || type
  }

  const handleAssignToMe = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await assign(itemId, currentUser.id)
      alert("已指派給您")
    } catch (err: any) {
      alert(`指派失敗: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="material-icons animate-spin text-4xl text-[var(--theme-accent)]">refresh</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <span className="material-icons text-4xl mb-2">error</span>
        <p>載入失敗: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className={`flex gap-2 items-center overflow-x-auto pb-2 ${compact ? "px-3 pt-2" : ""}`}>
        {!compact && <HelpHint
          title="管理端佇列篩選"
          description="佇列狀態邏輯：\n• 待處理（pending）：新進案件，尚未開始審核。\n• 審核中（in_review）：已進入人工處理流程。\n• 已處理（resolved）：已完成處置並結案。\n\n優先級邏輯：urgent > high > medium > low，建議先處理緊急與高風險案件。"
          workflow={[
            "先用狀態按鈕切換待處理、審核中或已處理。",
            "再用優先級按鈕縮小案件範圍（如緊急、高）。",
            "從清單點選案件進入詳情處理。",
          ]}
          logic={[
            "狀態篩選控制流程階段，優先級篩選控制處理順序。",
            "建議先處理 urgent/high，可降低高風險延誤。",
          ]}
          align="center"
        />}
        <div className="flex gap-2">
          <Button
            onClick={() => setStatusFilter("pending")}
            variant={statusFilter === "pending" ? "default" : "outline"}
            size="sm"
          >
            待處理
          </Button>
          <Button
            onClick={() => setStatusFilter("in_review")}
            variant={statusFilter === "in_review" ? "default" : "outline"}
            size="sm"
          >
            審核中
          </Button>
          <Button
            onClick={() => setStatusFilter("resolved")}
            variant={statusFilter === "resolved" ? "default" : "outline"}
            size="sm"
          >
            已處理
          </Button>
        </div>

        <div className="flex gap-2 ml-4">
          <Button
            onClick={() => setPriorityFilter(undefined)}
            variant={priorityFilter === undefined ? "default" : "outline"}
            size="sm"
          >
            全部優先級
          </Button>
          <Button
            onClick={() => setPriorityFilter("urgent")}
            variant={priorityFilter === "urgent" ? "default" : "outline"}
            size="sm"
          >
            緊急
          </Button>
          <Button
            onClick={() => setPriorityFilter("high")}
            variant={priorityFilter === "high" ? "default" : "outline"}
            size="sm"
          >
            高
          </Button>
        </div>
      </div>

      {/* Queue List */}
      <div className={`space-y-2 ${compact ? "px-2 pb-3" : "space-y-3"}`}>
        {queue.length === 0 ? (
          <Card className="p-8 text-center text-[var(--theme-text-secondary)]">
            <span className="material-icons text-4xl mb-2 opacity-50">check_circle</span>
            <p>目前沒有待處理項目</p>
          </Card>
        ) : (
          queue.map((item) => {
            const priorityBadge = getPriorityBadge(item.priority)
            const isOverdue = item.overdue || (item.due_at && new Date(item.due_at) < new Date())
            const isSelected = selectedItemId === item.id

            return (
              <Card
                key={item.id}
                className={`p-3 hover:shadow-md transition-all cursor-pointer border-l-4 ${
                  isSelected
                    ? "border-l-[var(--theme-accent)] bg-[var(--theme-accent)]/5 shadow-md"
                    : isOverdue
                      ? "border-l-red-500"
                      : "border-l-transparent"
                }`}
                onClick={() => onSelectItem(item.id)}
              >
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5 items-center mb-1.5 flex-wrap">
                      <Badge className={`${priorityBadge.className} text-xs px-1.5 py-0`}>{priorityBadge.label}</Badge>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{getItemTypeLabel(item.item_type)}</Badge>
                      {!compact && item.assigned_to && (
                        <Badge variant="secondary" className="flex gap-1 items-center text-xs px-1.5 py-0">
                          <span className="material-icons text-xs">person</span>已指派
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">逾期</Badge>
                      )}
                    </div>

                    <p className="text-[var(--theme-text-primary)] text-sm font-medium truncate mb-1">
                      {item.ai_risk_summary || "待審核項目"}
                    </p>

                    <div className="flex gap-3 items-center text-xs text-[var(--theme-text-secondary)]">
                      <span className="flex gap-1 items-center">
                        <span className="material-icons text-sm">schedule</span>
                        {new Date(item.created_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {item.due_at && !compact && (
                        <span className="flex gap-1 items-center">
                          <span className="material-icons text-sm">event</span>
                          期限: {new Date(item.due_at).toLocaleDateString("zh-TW")}
                        </span>
                      )}
                    </div>
                  </div>

                  {!compact && !item.assigned_to && item.status === "pending" && (
                    <Button size="sm" className="shrink-0 text-xs h-7" onClick={(e) => handleAssignToMe(item.id, e)}>
                      接案
                    </Button>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
