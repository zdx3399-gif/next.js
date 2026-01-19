"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchAnnouncements, fetchAllAnnouncements, type Announcement } from "../api/announcements"

export function useAnnouncements(publishedOnly = true, currentUserId: string | null = null) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [likes, setLikes] = useState<any[]>([])

  useEffect(() => {
    loadAnnouncements()
    if (currentUserId) {
      loadLikes()
    }
  }, [publishedOnly, currentUserId])

  async function loadAnnouncements() {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = publishedOnly ? await fetchAnnouncements() : await fetchAllAnnouncements()

      if (fetchError && typeof fetchError === "object" && "message" in fetchError) {
        throw new Error(fetchError.message)
      }
      setAnnouncements(data || [])
    } catch (e) {
      setError(e as Error)
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const loadLikes = useCallback(() => {
    try {
      const likesStr = localStorage.getItem("announcement_likes")
      const likesObj = likesStr ? JSON.parse(likesStr) : {}

      const likesArray: any[] = []
      Object.keys(likesObj).forEach((announcementId) => {
        if (Array.isArray(likesObj[announcementId])) {
          likesObj[announcementId].forEach((userId: string) => {
            likesArray.push({
              id: `${announcementId}_${userId}`,
              announcement_id: announcementId,
              user_id: userId,
            })
          })
        }
      })

      setLikes(likesArray)
    } catch (e) {
      console.error("Error loading likes:", e)
    }
  }, [])

  const toggleLike = useCallback(
    (announcementId: string) => {
      if (!currentUserId) return

      try {
        const likesStr = localStorage.getItem("announcement_likes")
        const likesObj = likesStr ? JSON.parse(likesStr) : {}

        if (!likesObj[announcementId]) {
          likesObj[announcementId] = []
        }

        const userLikeIndex = likesObj[announcementId].indexOf(currentUserId)
        if (userLikeIndex > -1) {
          likesObj[announcementId].splice(userLikeIndex, 1)
        } else {
          likesObj[announcementId].push(currentUserId)
        }

        localStorage.setItem("announcement_likes", JSON.stringify(likesObj))
        loadLikes()
      } catch (e) {
        console.error("Error toggling like:", e)
      }
    },
    [currentUserId, loadLikes],
  )

  return {
    announcements,
    loading,
    error,
    reload: loadAnnouncements,
    likes,
    toggleLike,
  }
}
