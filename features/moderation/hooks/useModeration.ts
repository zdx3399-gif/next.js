"use client"

import { useState, useEffect } from "react"
import {
  getModerationQueue,
  getModerationItemDetail,
  assignModerationItem,
  resolveModerationItem,
  getReportsForTarget,
  type ModerationQueueItem,
} from "../api/moderation"

export function useModerationQueue(filters?: { status?: string; priority?: string; assignedTo?: string }) {
  const [queue, setQueue] = useState<ModerationQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadQueue = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getModerationQueue(filters)
      setQueue(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [filters?.status, filters?.priority, filters?.assignedTo])

  const handleAssign = async (itemId: string, userId: string) => {
    try {
      const updated = await assignModerationItem(itemId, userId)
      setQueue((prev) => prev.map((item) => (item.id === itemId ? updated : item)))
      return updated
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const handleResolve = async (
    itemId: string,
    resolution: Parameters<typeof resolveModerationItem>[1],
    userId: string,
  ) => {
    try {
      const updated = await resolveModerationItem(itemId, resolution, userId)
      setQueue((prev) => prev.filter((item) => item.id !== itemId))
      return updated
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return {
    queue,
    loading,
    error,
    refresh: loadQueue,
    assign: handleAssign,
    resolve: handleResolve,
  }
}

export function useModerationItemDetail(itemId: string) {
  const [queueItem, setQueueItem] = useState<ModerationQueueItem | null>(null)
  const [content, setContent] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const { queueItem: qi, content: c } = await getModerationItemDetail(itemId)
      setQueueItem(qi)
      setContent(c)

      // 如果是貼文或留言，載入相關檢舉
      if (qi.item_type === "post" || qi.item_type === "comment") {
        const reportsData = await getReportsForTarget(qi.item_type, qi.item_id)
        setReports(reportsData || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (itemId) {
      loadDetail()
    }
  }, [itemId])

  return {
    queueItem,
    content,
    reports,
    loading,
    error,
    refresh: loadDetail,
  }
}
