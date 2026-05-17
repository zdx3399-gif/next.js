"use client"

import { useState, useEffect, useCallback } from "react"
import {
  type Emergency,
  fetchEmergencies,
  triggerEmergency as apiTriggerEmergency,
  deleteEmergency as apiDeleteEmergency,
  editEmergency as apiEditEmergency,
  reviewEmergency as apiReviewEmergency,
  type EmergencyUpdatePayload,
} from "../api/emergencies"

export function useEmergencies(isAdmin = false) {
  const [emergencies, setEmergencies] = useState<Emergency[]>([])
  const [loading, setLoading] = useState(false)

  const loadEmergencies = useCallback(async (reportedById?: string) => {
    setLoading(true)
    try {
      const data = await fetchEmergencies(isAdmin ? undefined : reportedById ? { reportedById } : undefined)
      setEmergencies(data)
    } catch (e) {
      console.error("載入緊急事件失敗:", e)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) {
      loadEmergencies()
    }
  }, [isAdmin, loadEmergencies])

  const triggerEmergency = async (
    type: string,
    note: string,
    userId?: string,
    userName?: string,
    location?: string,
    description?: string,
    sendMode?: "test" | "official",
    imageUrl?: string,
  ) => {
    try {
      const result = await apiTriggerEmergency(type, note, userId, userName, location, description, sendMode, imageUrl)
      if (sendMode === "test") {
        alert(`[測試] 已送出通知給管委會與管理員，不會廣播給住戶。\nLINE 已通知 ${result.lineSent} 人`)
      } else {
        alert(`已送出「${type}」通報。\n已通知管委會進行審核，審核通過後將自動廣播給住戶（LINE + IoT）。`)
      }
      if (isAdmin) {
        loadEmergencies()
      } else if (userId) {
        loadEmergencies(userId)
      }
    } catch (e: unknown) {
      console.error("triggerEmergency error:", e)
      const message = e instanceof Error ? e.message : "未知錯誤"
      alert("送出失敗：" + message)
    }
  }

  const confirmAndTrigger = (type: string, note: string, userId?: string, userName?: string) => {
    const customNote = String(note || "").trim()
    if (!customNote) {
      alert("備註不可為空，請輸入現場狀況。")
      return
    }

    if (confirm(`確定要送出「${type}」事件嗎？\n備註：${customNote}`)) {
      triggerEmergency(type, customNote, userId, userName)
    }
  }

  const editEmergency = async (id: string, payload: EmergencyUpdatePayload) => {
    try {
      await apiEditEmergency(id, payload)
      if (isAdmin) {
        loadEmergencies()
      }
    } catch (e: unknown) {
      console.error("editEmergency error:", e)
      const message = e instanceof Error ? e.message : "未知錯誤"
      alert("編輯失敗：" + message)
    }
  }

  const deleteEmergency = async (id: string) => {
    if (!confirm("確定要刪除此緊急事件紀錄嗎？")) return
    try {
      await apiDeleteEmergency(id)
      loadEmergencies()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
    }
  }

  const reviewEmergency = async (incidentId: string, action: "approve" | "reject", reviewerId: string, sendMode?: "test" | "official") => {
    try {
      await apiReviewEmergency(incidentId, action, reviewerId, sendMode)
      if (isAdmin) {
        loadEmergencies()
      }
    } catch (e: unknown) {
      console.error("reviewEmergency error:", e)
      const message = e instanceof Error ? e.message : "未知錯誤"
      alert("審核失敗：" + message)
    }
  }

  return {
    emergencies,
    loading,
    triggerEmergency,
    confirmAndTrigger,
    editEmergency,
    deleteEmergency,
    reviewEmergency,
    reload: loadEmergencies,
  }
}
