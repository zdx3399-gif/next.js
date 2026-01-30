"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface Comment {
  id: string
  announcement_id: string
  user_name: string
  comment_text: string
  created_at: string
}

interface Like {
  id: string
  announcement_id: string
  user_id: string
}

interface Announcement {
  id: string
  title: string
  content: string
  image_url: string
  author: string
  created_at: string
  status: string
}

interface AnnouncementDetailsProps {
  onClose: () => void
  currentUser: any
}

export function AnnouncementDetails({ onClose, currentUser }: AnnouncementDetailsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [comments, setComments] = useState<Map<string, Comment[]>>(new Map())
  const [likes, setLikes] = useState<Map<string, Set<string>>>(new Map())
  const [bannedUsers, setBannedUsers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedComments = localStorage.getItem("announcement_comments")
    const savedLikes = localStorage.getItem("announcement_likes")
    const savedBannedUsers = localStorage.getItem("announcement_banned_users")

    if (savedComments) {
      setComments(new Map(JSON.parse(savedComments)))
    }
    if (savedLikes) {
      const likesObj = JSON.parse(savedLikes)
      const likesMap = new Map<string, Set<string>>()
      Object.keys(likesObj).forEach((key) => {
        likesMap.set(key, new Set(likesObj[key]))
      })
      setLikes(likesMap)
    }
    if (savedBannedUsers) {
      setBannedUsers(new Set(JSON.parse(savedBannedUsers)))
    }

    loadAnnouncements()
  }, [])

  useEffect(() => {
    const selectedId = sessionStorage.getItem("selectedAnnouncementId")
    if (selectedId && announcements.length > 0) {
      const announcement = announcements.find((a) => a.id === selectedId)
      if (announcement) {
        setSelectedAnnouncement(announcement)
        sessionStorage.removeItem("selectedAnnouncementId")
      }
    } else if (announcements.length > 0 && !selectedAnnouncement) {
      setSelectedAnnouncement(announcements[0])
    }
  }, [announcements])

  const loadAnnouncements = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabaseClient()

      if (!supabase) {
        // No supabase client - just show empty state, don't treat as error
        setAnnouncements([])
        setLoading(false)
        return
      }

      const { data, error: queryError } = await supabase
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })

      if (queryError) {
        // Real database error
        console.error("[v0] Database error loading announcements:", queryError.message)
        setError(queryError.message)
        setAnnouncements([])
      } else {
        setAnnouncements(data || [])
        if (data && data.length > 0 && !selectedAnnouncement) {
          setSelectedAnnouncement(data[0])
        }
      }
    } catch (e) {
      // Unexpected error
      const errorMsg = e instanceof Error ? e.message : "載入失敗"
      console.error("[v0] Unexpected error loading announcements:", errorMsg)
      setError(errorMsg)
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const filteredAnnouncements = announcements.filter(
    (announcement) =>
      announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      announcement.content.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedAnnouncement || !currentUser) return

    if (bannedUsers.has(currentUser.name || "匿名")) {
      alert("您已被禁言，無法留言")
      return
    }

    const comment: Comment = {
      id: `${Date.now()}-${Math.random()}`,
      announcement_id: selectedAnnouncement.id,
      user_name: currentUser.name || "匿名",
      comment_text: newComment,
      created_at: new Date().toISOString(),
    }

    const updatedComments = new Map(comments)
    const announcementComments = updatedComments.get(selectedAnnouncement.id) || []
    announcementComments.push(comment)
    updatedComments.set(selectedAnnouncement.id, announcementComments)

    setComments(updatedComments)
    localStorage.setItem("announcement_comments", JSON.stringify(Array.from(updatedComments.entries())))
    setNewComment("")
  }

  const handleToggleLike = () => {
    if (!selectedAnnouncement || !currentUser) return

    const updatedLikes = new Map(likes)
    const announcementLikes = updatedLikes.get(selectedAnnouncement.id) || new Set()

    if (announcementLikes.has(currentUser.id)) {
      announcementLikes.delete(currentUser.id)
    } else {
      announcementLikes.add(currentUser.id)
    }

    updatedLikes.set(selectedAnnouncement.id, announcementLikes)
    setLikes(updatedLikes)

    const likesObj: Record<string, string[]> = {}
    updatedLikes.forEach((set, key) => {
      likesObj[key] = Array.from(set)
    })
    localStorage.setItem("announcement_likes", JSON.stringify(likesObj))
  }

  const currentComments = selectedAnnouncement ? comments.get(selectedAnnouncement.id) || [] : []
  const currentLikes = selectedAnnouncement ? likes.get(selectedAnnouncement.id) || new Set() : new Set()
  const hasLiked = selectedAnnouncement ? currentLikes.has(currentUser?.id) : false

  return (
    <div className="flex gap-4 h-[600px]">
      <div className="w-1/3 flex flex-col gap-3 border-r border-[var(--theme-border)] pr-4 overflow-hidden">
        <input
          type="text"
          placeholder="搜尋公告..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="theme-input w-full p-2 rounded-lg"
        />

        <div className="flex-1 overflow-y-auto space-y-2">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
              <button
                onClick={loadAnnouncements}
                className="block mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs"
              >
                重試
              </button>
            </div>
          )}
          {loading ? (
            <div className="text-[var(--theme-text-muted)] text-center py-4">載入中...</div>
          ) : filteredAnnouncements.length > 0 ? (
            filteredAnnouncements.map((announcement) => (
              <button
                key={announcement.id}
                onClick={() => setSelectedAnnouncement(announcement)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedAnnouncement?.id === announcement.id
                    ? "bg-[var(--theme-accent-light)] border border-[var(--theme-accent)]"
                    : "bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] hover:bg-[var(--theme-accent-light)]"
                }`}
              >
                <div className="text-[var(--theme-text-primary)] font-medium line-clamp-2">{announcement.title}</div>
                <div className="text-[var(--theme-text-muted)] text-xs mt-1">
                  {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                </div>
              </button>
            ))
          ) : (
            <div className="text-[var(--theme-text-muted)] text-center py-4">沒有找到公告</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedAnnouncement ? (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-[var(--theme-accent)] mb-2">{selectedAnnouncement.title}</h3>
                <div className="flex gap-4 text-[var(--theme-text-muted)] text-sm mb-4">
                  <div>發布者: {selectedAnnouncement.author}</div>
                  <div>{new Date(selectedAnnouncement.created_at).toLocaleDateString("zh-TW")}</div>
                </div>
              </div>

              {selectedAnnouncement.image_url && (
                <img
                  src={selectedAnnouncement.image_url || "/placeholder.svg"}
                  alt={selectedAnnouncement.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}

              <div className="text-[var(--theme-text-primary)] mb-6 whitespace-pre-wrap">
                {selectedAnnouncement.content.split("\\n").join("\n")}
              </div>

              <div className="mb-6 pb-4 border-b border-[var(--theme-border)]">
                <button
                  onClick={handleToggleLike}
                  disabled={!currentUser}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    hasLiked
                      ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
                      : "bg-[var(--theme-bg-secondary)] text-[var(--theme-accent)] hover:bg-[var(--theme-accent-light)]"
                  } ${!currentUser ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="material-icons">favorite</span>
                  <span>{currentLikes.size}</span>
                </button>
              </div>

              <div>
                <h4 className="text-lg font-bold text-[var(--theme-accent)] mb-4">留言 ({currentComments.length})</h4>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {currentComments.length > 0 ? (
                    currentComments.map((comment) => (
                      <div key={comment.id} className="bg-[var(--theme-bg-secondary)] p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--theme-accent)] font-medium">{comment.user_name}</span>
                            {bannedUsers.has(comment.user_name) && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">已禁言</span>
                            )}
                          </div>
                          <span className="text-[var(--theme-text-muted)] text-xs">
                            {new Date(comment.created_at).toLocaleString("zh-TW")}
                          </span>
                        </div>
                        <div className="text-[var(--theme-text-primary)] text-sm">{comment.comment_text}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[var(--theme-text-muted)] text-center py-4">還沒有留言</div>
                  )}
                </div>
              </div>
            </div>

            {currentUser && (
              <div className="pt-4 border-t border-[var(--theme-border)] flex gap-2 flex-shrink-0">
                {bannedUsers.has(currentUser.name || "匿名") ? (
                  <div className="w-full p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-center">
                    您已被禁言，無法留言
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="新增留言..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddComment()}
                      className="theme-input flex-1 p-2 rounded-lg"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      發送
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--theme-text-muted)]">
            {loading ? "載入中..." : "選擇一則公告查看詳情"}
          </div>
        )}
      </div>
    </div>
  )
}
