"use client"

import type React from "react"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useModerationQueue } from "../hooks/useModeration"
import type { User } from "@/features/profile/api/profile"

interface ModerationQueueProps {
  currentUser: User
  onSelectItem: (itemId: string) => void
}

export function ModerationQueue({ currentUser, onSelectItem }: ModerationQueueProps) {
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
      <div className="flex gap-2 items-center overflow-x-auto pb-2">
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
      <div className="space-y-3">
        {queue.length === 0 ? (
          <Card className="p-8 text-center text-[var(--theme-text-secondary)]">
            <span className="material-icons text-4xl mb-2 opacity-50">check_circle</span>
            <p>目前沒有待處理項目</p>
          </Card>
        ) : (
          queue.map((item) => {
            const priorityBadge = getPriorityBadge(item.priority)
            const isOverdue = item.overdue || (item.due_at && new Date(item.due_at) < new Date())

            return (
              <Card
                key={item.id}
                className={`p-4 hover:shadow-lg transition-shadow cursor-pointer ${isOverdue ? "border-l-4 border-l-red-500" : ""}`}
                onClick={() => onSelectItem(item.id)}
              >
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center mb-2 flex-wrap">
                      <Badge className={priorityBadge.className}>{priorityBadge.label}</Badge>
                      <Badge variant="outline">{getItemTypeLabel(item.item_type)}</Badge>
                      {item.assigned_to && (
                        <Badge variant="secondary" className="flex gap-1 items-center">
                          <span className="material-icons text-xs">person</span>
                          已指派
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive" className="flex gap-1 items-center">
                          <span className="material-icons text-xs">schedule</span>
                          逾期
                        </Badge>
                      )}
                    </div>

                    <p className="text-[var(--theme-text-primary)] font-medium mb-2">
                      {item.ai_risk_summary || "待審核項目"}
                    </p>

                    <div className="flex gap-4 items-center text-xs text-[var(--theme-text-secondary)]">
                      <span className="flex gap-1 items-center">
                        <span className="material-icons text-sm">schedule</span>
                        {new Date(item.created_at).toLocaleString("zh-TW")}
                      </span>
                      {item.due_at && (
                        <span className="flex gap-1 items-center">
                          <span className="material-icons text-sm">event</span>
                          期限: {new Date(item.due_at).toLocaleDateString("zh-TW")}
                        </span>
                      )}
                    </div>

                    {item.ai_suggested_action && (
                      <p className="text-xs text-blue-600 mt-2">AI 建議: {item.ai_suggested_action}</p>
                    )}
                  </div>

                  {!item.assigned_to && item.status === "pending" && (
                    <Button size="sm" onClick={(e) => handleAssignToMe(item.id, e)} className="shrink-0">
                      指派給我
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
