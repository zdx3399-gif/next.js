"use client"

import { useState, useEffect, useCallback } from "react"
import {
  type Visitor,
  type VisitorReservation,
  fetchVisitors,
  createVisitorReservation,
  checkInVisitor,
  checkOutVisitor,
} from "../api/visitors"

interface UseVisitorsOptions {
  userRoom?: string | null
  userUnitId?: string // 新增 userUnitId 參數
  currentUser?: any
  isAdmin?: boolean
}

export function useVisitors({ userRoom, userUnitId, currentUser, isAdmin = false }: UseVisitorsOptions) {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [reservedVisitors, setReservedVisitors] = useState<Visitor[]>([])
  const [checkedInVisitors, setCheckedInVisitors] = useState<Visitor[]>([])
  const [historyVisitors, setHistoryVisitors] = useState<Visitor[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)

  const loadVisitors = useCallback(async () => {
    if (!userRoom && !userUnitId && !currentUser?.id && !isAdmin) return

    setLoading(true)
    try {
      const data = await fetchVisitors(userRoom, isAdmin, userUnitId)
      setVisitors(data)
    } catch (e) {
      console.error("Failed to load visitors:", e)
      setVisitors([])
    } finally {
      setLoading(false)
    }
  }, [userRoom, userUnitId, currentUser?.id, isAdmin])

  // 根據搜尋條件過濾訪客
  const filterVisitors = useCallback(() => {
    let reserved = visitors.filter((v) => v.status === "reserved")
    let checkedIn = visitors.filter((v) => v.status === "checked_in")
    let history = visitors.filter((v) => v.status === "checked_out")

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchesTerm = (visitor: Visitor) =>
        visitor.name.toLowerCase().includes(term) ||
        (visitor.room || "").toLowerCase().includes(term) ||
        visitor.phone?.toLowerCase().includes(term)

      reserved = reserved.filter(matchesTerm)
      checkedIn = checkedIn.filter(matchesTerm)
      history = history.filter(matchesTerm)
    }

    setReservedVisitors(reserved)
    setCheckedInVisitors(checkedIn)
    setHistoryVisitors(history)
  }, [visitors, searchTerm])

  useEffect(() => {
    loadVisitors()
  }, [loadVisitors])

  useEffect(() => {
    filterVisitors()
  }, [filterVisitors])

  const handleReservation = async (reservation: VisitorReservation): Promise<boolean> => {
    if (!currentUser) {
      alert("請先登入")
      return false
    }

    try {
      const room = currentUser.room || userRoom
      const unitId = currentUser.unit_id || userUnitId
      await createVisitorReservation(reservation, room, currentUser.name, unitId, currentUser.id)
      alert("訪客預約成功！")
      await loadVisitors()
      return true
    } catch (e: any) {
      alert("預約失敗：" + e.message)
      return false
    }
  }

  const handleCheckIn = async (visitorId: string): Promise<void> => {
    try {
      await checkInVisitor(visitorId)
      alert("訪客已簽到")
      await loadVisitors()
    } catch (e: any) {
      alert("簽到失敗：" + e.message)
    }
  }

  const handleCheckOut = async (visitorId: string): Promise<void> => {
    try {
      await checkOutVisitor(visitorId)
      alert("訪客已簽退")
      await loadVisitors()
    } catch (e: any) {
      alert("簽退失敗：" + e.message)
    }
  }

  return {
    visitors,
    reservedVisitors,
    checkedInVisitors,
    historyVisitors,
    loading,
    searchTerm,
    setSearchTerm,
    handleReservation,
    handleCheckIn,
    handleCheckOut,
    reload: loadVisitors,
  }
}
