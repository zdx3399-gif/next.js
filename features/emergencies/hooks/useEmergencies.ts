"use client"

import { useState, useEffect, useCallback } from "react"
import {
  type Emergency,
  fetchEmergencies,
  triggerEmergency as apiTriggerEmergency,
  deleteEmergency as apiDeleteEmergency,
} from "../api/emergencies"

export function useEmergencies(isAdmin = false) {
  const [emergencies, setEmergencies] = useState<Emergency[]>([])
  const [loading, setLoading] = useState(false)

  const loadEmergencies = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const data = await fetchEmergencies()
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

  const triggerEmergency = async (type: string, note: string, userName: string) => {
    try {
      await apiTriggerEmergency(type, note, userName)
      alert(`已送出緊急事件：${type}\n系統已通知管理員和相關單位。`)
      if (isAdmin) {
        loadEmergencies()
      }
    } catch (e: any) {
      console.error(e)
      alert("送出失敗：" + e.message)
    }
  }

  const confirmAndTrigger = (type: string, note: string, userName: string) => {
    if (confirm(`確定要送出「${type}」事件嗎？`)) {
      triggerEmergency(type, note, userName)
    }
  }

  const deleteEmergency = async (id: number) => {
    if (!confirm("確定要刪除此緊急事件紀錄嗎？")) return
    try {
      await apiDeleteEmergency(id)
      loadEmergencies()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
    }
  }

  return {
    emergencies,
    loading,
    triggerEmergency,
    confirmAndTrigger,
    deleteEmergency,
    reload: loadEmergencies,
  }
}
