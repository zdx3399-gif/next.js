"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface Comment {
  id: string
  announcement_id: string
  user_name: string
  comment_text: string
  created_at: string
  banned?: boolean
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

interface AnnouncementDetailsAdminProps {
  onClose: () => void
  currentUser: any
}

export function AnnouncementDetailsAdmin({ onClose, currentUser }: AnnouncementDetailsAdminProps) {
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
        console.log("[v0] Setting selected announcement:", announcement.title)
        setSelectedAnnouncement(announcement)
        sessionStorage.removeItem("selectedAnnouncementId")
      }
    } else if (announcements.length > 0 && !selectedAnnouncement) {
      setSelectedAnnouncement(announcements[0])
    }
  }, [announcements])

  const loadAnnouncements = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("[v0] Loading announcements...")
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error loading announcements:", error)
        throw error
      }
      console.log("[v0] Loaded announcements:", data?.length || 0)
      setAnnouncements(data || [])
      if (data && data.length > 0 && !selectedAnnouncement) {
        setSelectedAnnouncement(data[0])
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to load announcements"
      console.error("[v0] Failed to load announcements:", errorMsg)
      setError(errorMsg)
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

    if (bannedUsers.has(currentUser.name || "匿名") && currentUser.role !== "admin") {
      alert("您已被禁言，無法留言")
      return
    }

    console.log("[v0] Adding comment to announcement:", selectedAnnouncement.id)
    const comment: Comment = {
      id: `${Date.now()}-${Math.random()}`,
      announcement_id: selectedAnnouncement.id,
      user_name: currentUser.name || "匿名",
      comment_text: newComment,
      created_at: new Date().toISOString(),
      banned: false,
    }

    const updatedComments = new Map(comments)
    const announcementComments = updatedComments.get(selectedAnnouncement.id) || []
    announcementComments.push(comment)
    updatedComments.set(selectedAnnouncement.id, announcementComments)

    setComments(updatedComments)
    localStorage.setItem("announcement_comments", JSON.stringify(Array.from(updatedComments.entries())))
    setNewComment("")
  }

  const handleDeleteComment = (commentId: string) => {
    if (!selectedAnnouncement) return
    if (!confirm("確定要刪除此留言？")) return

    console.log("[v0] Deleting comment:", commentId)
    const updatedComments = new Map(comments)
    const announcementComments = updatedComments.get(selectedAnnouncement.id) || []
    const filteredComments = announcementComments.filter((c) => c.id !== commentId)
    updatedComments.set(selectedAnnouncement.id, filteredComments)

    setComments(updatedComments)
    localStorage.setItem("announcement_comments", JSON.stringify(Array.from(updatedComments.entries())))
  }

  const handleBanUser = (userName: string) => {
    if (!confirm(`確定要禁止「${userName}」留言？`)) return

    console.log("[v0] Banning user:", userName)
    const updatedBannedUsers = new Set(bannedUsers)
    updatedBannedUsers.add(userName)
    setBannedUsers(updatedBannedUsers)
    localStorage.setItem("announcement_banned_users", JSON.stringify(Array.from(updatedBannedUsers)))
  }

  const handleUnbanUser = (userName: string) => {
    if (!confirm(`確定要解除「${userName}」的留言禁令？`)) return

    console.log("[v0] Unbanning user:", userName)
    const updatedBannedUsers = new Set(bannedUsers)
    updatedBannedUsers.delete(userName)
    setBannedUsers(updatedBannedUsers)
    localStorage.setItem("announcement_banned_users", JSON.stringify(Array.from(updatedBannedUsers)))
  }

  const handleToggleLike = () => {
    if (!selectedAnnouncement || !currentUser) return

    console.log("[v0] Toggling like for announcement:", selectedAnnouncement.id)
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
      {/* Announcements List */}
      <div className="w-1/3 flex flex-col gap-3 border-r border-[rgba(255,215,0,0.2)] pr-4 overflow-hidden">
        <input
          type="text"
          placeholder="搜尋公告..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] placeholder-[#b0b0b0]"
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
            <div className="text-[#b0b0b0] text-center py-4">載入中...</div>
          ) : filteredAnnouncements.length > 0 ? (
            filteredAnnouncements.map((announcement) => (
              <button
                key={announcement.id}
                onClick={() => {
                  console.log("[v0] Selected announcement:", announcement.id)
                  setSelectedAnnouncement(announcement)
                }}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedAnnouncement?.id === announcement.id
                    ? "bg-[rgba(255,215,0,0.2)] border border-[#ffd700]"
                    : "bg-white/5 border border-[rgba(255,215,0,0.1)] hover:bg-white/10"
                }`}
              >
                <div className="text-white font-medium line-clamp-2">{announcement.title}</div>
                <div className="text-[#b0b0b0] text-xs mt-1">
                  {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                </div>
              </button>
            ))
          ) : (
            <div className="text-[#b0b0b0] text-center py-4">沒有找到公告</div>
          )}
        </div>
      </div>

      {/* Announcement Details */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedAnnouncement ? (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Announcement Header */}
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-[#ffd700] mb-2">{selectedAnnouncement.title}</h3>
                <div className="flex gap-4 text-[#b0b0b0] text-sm mb-4">
                  <div>發布者: {selectedAnnouncement.author}</div>
                  <div>{new Date(selectedAnnouncement.created_at).toLocaleDateString("zh-TW")}</div>
                </div>
              </div>

              {/* Announcement Image */}
              {selectedAnnouncement.image_url && (
                <img
                  src={selectedAnnouncement.image_url || "/placeholder.svg"}
                  alt={selectedAnnouncement.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}

              {/* Announcement Content */}
              <div className="text-white mb-6 whitespace-pre-wrap">{selectedAnnouncement.content}</div>

              {/* Like Section */}
              <div className="mb-6 pb-4 border-b border-[rgba(255,215,0,0.2)]">
                <button
                  onClick={handleToggleLike}
                  disabled={!currentUser}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    hasLiked ? "bg-[#ffd700] text-[#222]" : "bg-white/20 text-[#ffd700] hover:bg-white/30"
                  } ${!currentUser ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="material-icons">favorite</span>
                  <span>{currentLikes.size}</span>
                </button>
              </div>

              {bannedUsers.size > 0 && (
                <div className="mb-6 pb-4 border-b border-[rgba(255,215,0,0.2)]">
                  <h4 className="text-sm font-bold text-red-400 mb-2">已禁言用戶</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(bannedUsers).map((userName) => (
                      <div
                        key={userName}
                        className="px-3 py-1 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm flex items-center gap-2"
                      >
                        <span>{userName}</span>
                        <button
                          onClick={() => handleUnbanUser(userName)}
                          className="material-icons text-xs hover:text-red-300 transition-colors"
                          title="解除禁言"
                        >
                          close
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div>
                <h4 className="text-lg font-bold text-[#ffd700] mb-4">留言 ({currentComments.length})</h4>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {currentComments.length > 0 ? (
                    currentComments.map((comment) => (
                      <div key={comment.id} className="bg-white/5 p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[#ffd700] font-medium">{comment.user_name}</span>
                            {bannedUsers.has(comment.user_name) && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">已禁言</span>
                            )}
                          </div>
                          <span className="text-[#b0b0b0] text-xs">
                            {new Date(comment.created_at).toLocaleString("zh-TW")}
                          </span>
                        </div>
                        <div className="text-white text-sm mb-2">{comment.comment_text}</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-all"
                          >
                            刪除留言
                          </button>
                          {!bannedUsers.has(comment.user_name) ? (
                            <button
                              onClick={() => handleBanUser(comment.user_name)}
                              className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-xs transition-all"
                            >
                              禁止留言
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnbanUser(comment.user_name)}
                              className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs transition-all"
                            >
                              解除禁言
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[#b0b0b0] text-center py-4">還沒有留言</div>
                  )}
                </div>
              </div>
            </div>

            {/* Add Comment Input - Admin can still comment */}
            {currentUser && (
              <div className="pt-4 border-t border-[rgba(255,215,0,0.2)] flex gap-2 flex-shrink-0">
                {bannedUsers.has(currentUser.name || "匿名") && currentUser.role !== "admin" ? (
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
                      className="flex-1 p-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] placeholder-[#b0b0b0]"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg font-medium hover:bg-[#ffed4e] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      發送
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[#b0b0b0]">
            {loading ? "載入中..." : "選擇一則公告查看詳情"}
          </div>
        )}
      </div>
    </div>
  )
}
