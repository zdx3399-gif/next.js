"use client"

import { useState, useEffect, useCallback } from "react"
import { getMeetings, createMeeting, updateMeeting, deleteMeeting, type Meeting } from "../api/meetings"

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMeetings()
      setMeetings(data)
    } catch (err) {
      setError("無法載入會議資料")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  const addMeeting = async (meeting: Omit<Meeting, "id" | "created_at">) => {
    const newMeeting = await createMeeting(meeting)
    if (newMeeting) {
      setMeetings((prev) => [newMeeting, ...prev])
      return true
    }
    return false
  }

  const editMeeting = async (id: string, meeting: Partial<Meeting>) => {
    const updated = await updateMeeting(id, meeting)
    if (updated) {
      setMeetings((prev) => prev.map((m) => (m.id === id ? updated : m)))
      return true
    }
    return false
  }

  const removeMeeting = async (id: string) => {
    const success = await deleteMeeting(id)
    if (success) {
      setMeetings((prev) => prev.filter((m) => m.id !== id))
      return true
    }
    return false
  }

  return {
    meetings,
    loading,
    error,
    reload: loadMeetings,
    addMeeting,
    editMeeting,
    removeMeeting,
  }
}
