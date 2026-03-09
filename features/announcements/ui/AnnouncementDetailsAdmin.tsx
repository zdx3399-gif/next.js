"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"
import { HelpHint } from "@/components/ui/help-hint"

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
  isPreviewMode?: boolean
}

const PREVIEW_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "preview-a1",
    title: "測試資料",
    content: "測試資料",
    image_url: "",
    author: "測試資料",
    created_at: new Date().toISOString(),
    status: "published",
  },
  {
    id: "preview-a2",
    title: "測試資料",
    content: "測試資料",
    image_url: "",
    author: "測試資料",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    status: "published",
  },
]

const PREVIEW_COMMENTS: Record<string, Comment[]> = {
  "preview-a1": [
    {
      id: "pc-1",
      announcement_id: "preview-a1",
      user_name: "測試資料",
      comment_text: "測試資料",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "pc-2",
      announcement_id: "preview-a1",
      user_name: "測試資料",
      comment_text: "測試資料",
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
}

export function AnnouncementDetailsAdmin({ onClose, currentUser, isPreviewMode = false }: AnnouncementDetailsAdminProps) {
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
    if (isPreviewMode) {
      setAnnouncements(PREVIEW_ANNOUNCEMENTS)
      setSelectedAnnouncement(PREVIEW_ANNOUNCEMENTS[0])
      setComments(new Map(Object.entries(PREVIEW_COMMENTS)))
      setLikes(new Map([["preview-a1", new Set(["preview-user-1", "preview-user-2"])]]))
      setBannedUsers(new Set())
      return
    }

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
  }, [isPreviewMode])

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
    if (isPreviewMode) {
      setAnnouncements(PREVIEW_ANNOUNCEMENTS)
      if (!selectedAnnouncement) {
        setSelectedAnnouncement(PREVIEW_ANNOUNCEMENTS[0])
      }
      return
    }

    try {
      setLoading(true)
      setError(null)
      const supabase = getSupabaseClient()
      if (!supabase) {
        setAnnouncements([])
        return
      }
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }
      setAnnouncements(data || [])
      if (data && data.length > 0 && !selectedAnnouncement) {
        setSelectedAnnouncement(data[0])
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to load announcements"
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

    const updatedComments = new Map(comments)
    const announcementComments = updatedComments.get(selectedAnnouncement.id) || []
    const filteredComments = announcementComments.filter((c) => c.id !== commentId)
    updatedComments.set(selectedAnnouncement.id, filteredComments)

    setComments(updatedComments)
    localStorage.setItem("announcement_comments", JSON.stringify(Array.from(updatedComments.entries())))
  }

  const handleBanUser = (userName: string) => {
    if (!confirm(`確定要禁止「${userName}」留言？`)) return

    const updatedBannedUsers = new Set(bannedUsers)
    updatedBannedUsers.add(userName)
    setBannedUsers(updatedBannedUsers)
    localStorage.setItem("announcement_banned_users", JSON.stringify(Array.from(updatedBannedUsers)))
  }

  const handleUnbanUser = (userName: string) => {
    if (!confirm(`確定要解除「${userName}」的留言禁令？`)) return

    const updatedBannedUsers = new Set(bannedUsers)
    updatedBannedUsers.delete(userName)
    setBannedUsers(updatedBannedUsers)
    localStorage.setItem("announcement_banned_users", JSON.stringify(Array.from(updatedBannedUsers)))
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
      {/* Announcements List - Use theme variables */}
      <div className="w-1/3 flex flex-col gap-3 border-r border-[var(--theme-border)] pr-4 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-[var(--theme-text-primary)] text-sm font-medium">公告清單（管理）</span>
          <HelpHint
            title="管理端公告清單"
            description="顯示目前已發布公告。可搭配搜尋快速定位指定公告，點選後於右側進行留言管理與互動檢視。"
            workflow={[
              "先在左側選取要管理的公告。",
              "公告數量多時先用搜尋縮小範圍再點選。",
              "選定後在右側執行留言審查、禁言與互動檢視。",
            ]}
            logic={[
              "此清單以已發布公告為主，管理動作集中在右側詳情區。",
              "切換公告不會清除歷史互動資料，只改變當前管理目標。",
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--theme-text-primary)] text-sm">搜尋</span>
          <HelpHint
            title="管理端搜尋"
            description="可用關鍵字篩選公告標題與內容，適合在大量公告中快速找到要處理的公告。"
            workflow={[
              "輸入關鍵字篩選標題或內文。",
              "確認清單縮小後點擊目標公告。",
              "若沒找到結果，調整或清空關鍵字再查詢。",
            ]}
            logic={[
              "搜尋只影響目前清單顯示，不會修改公告內容。",
              "篩選條件為即時比對，適合快速處理大量公告。",
            ]}
          />
        </div>
        <input
          type="text"
          placeholder="搜尋公告..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 rounded-lg theme-input outline-none"
        />

        <div className="flex-1 overflow-y-auto space-y-2">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
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
            <div className="text-[var(--theme-text-secondary)] text-center py-4">載入中...</div>
          ) : filteredAnnouncements.length > 0 ? (
            filteredAnnouncements.map((announcement) => (
              <button
                key={announcement.id}
                onClick={() => {
                  setSelectedAnnouncement(announcement)
                }}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedAnnouncement?.id === announcement.id
                    ? "bg-[var(--theme-accent-light)] border border-[var(--theme-border-accent)]"
                    : "bg-[var(--theme-accent-light)] border border-transparent hover:border-[var(--theme-border)]"
                }`}
              >
                <div className="text-[var(--theme-text-primary)] font-medium line-clamp-2">{announcement.title}</div>
                <div className="text-[var(--theme-text-secondary)] text-xs mt-1">
                  {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                </div>
              </button>
            ))
          ) : (
            <div className="text-[var(--theme-text-secondary)] text-center py-4">沒有找到公告</div>
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
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-[var(--theme-accent)]">{selectedAnnouncement.title}</h3>
                  <HelpHint
                    title="管理端公告詳情"
                    description="此區可檢視公告完整呈現效果（標題、發布資訊、圖片與內容），方便管理者做內容稽核。"
                    workflow={[
                      "先核對標題、日期與發布者資訊。",
                      "再檢查圖片與內文是否正確、是否需後續處理。",
                      "確認無誤後再進行下方互動資料管理。",
                    ]}
                    logic={[
                      "詳情區是管理判斷基礎，避免未讀全文就直接處置留言。",
                      "畫面顯示內容即住戶端所見，便於比對呈現一致性。",
                    ]}
                  />
                </div>
                <div className="flex gap-4 text-[var(--theme-text-secondary)] text-sm mb-4">
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
              <div className="text-[var(--theme-text-primary)] mb-6 whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </div>

              {/* Like Section */}
              <div className="mb-6 pb-4 border-b border-[var(--theme-border)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[var(--theme-text-primary)] text-sm">按讚統計</span>
                  <HelpHint
                    title="管理端按讚統計"
                    description="可快速查看住戶對該公告的關注度。若互動偏低，可考慮調整標題或發布方式。"
                    workflow={[
                      "查看按讚數判斷公告關注度。",
                      "必要時切換不同公告比較互動差異。",
                      "依互動結果調整後續公告策略。",
                    ]}
                    logic={[
                      "按讚數屬互動指標，不代表公告正確性或完成率。",
                      "管理端可用此數據作為內容優化參考。",
                    ]}
                  />
                </div>
                <button
                  onClick={handleToggleLike}
                  disabled={!currentUser}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    hasLiked
                      ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
                      : "bg-[var(--theme-accent-light)] text-[var(--theme-accent)] hover:opacity-80"
                  } ${!currentUser ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="material-icons">favorite</span>
                  <span>{currentLikes.size}</span>
                </button>
              </div>

              {bannedUsers.size > 0 && (
                <div className="mb-6 pb-4 border-b border-[var(--theme-border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-bold text-red-500">已禁言用戶</h4>
                    <HelpHint
                      title="管理端禁言名單"
                      description="列出目前被限制留言的住戶，可於此直接解除禁言。建議保留明確管理標準，避免爭議。"
                      workflow={[
                        "先檢查名單是否仍需維持限制。",
                        "要解除時點使用者右側關閉按鈕。",
                        "解除後回到留言區確認該使用者狀態已更新。",
                      ]}
                      logic={[
                        "禁言名單會直接影響是否可送出留言。",
                        "名單管理應搭配一致的社區規範與處置依據。",
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(bannedUsers).map((userName) => (
                      <div
                        key={userName}
                        className="px-3 py-1 bg-red-500/20 border border-red-500 rounded-lg text-red-500 text-sm flex items-center gap-2"
                      >
                        <span>{userName}</span>
                        <button
                          onClick={() => handleUnbanUser(userName)}
                          className="material-icons text-xs hover:opacity-70 transition-colors"
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
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-lg font-bold text-[var(--theme-accent)]">留言 ({currentComments.length})</h4>
                  <HelpHint
                    title="管理端留言審查"
                    description="可刪除不當留言，並針對違規用戶執行禁言或解除禁言。建議先判斷是否違反社區規範再處理。"
                    workflow={[
                      "逐筆檢視留言內容與時間。",
                      "違規留言可先刪除，再視情況對使用者執行禁言。",
                      "若使用者已改善，可在名單或留言卡上解除禁言。",
                    ]}
                    logic={[
                      "留言處置需有一致標準，避免審查不一致造成爭議。",
                      "禁言是使用者層級限制，會影響其後續所有留言行為。",
                    ]}
                  />
                </div>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {currentComments.length > 0 ? (
                    currentComments.map((comment) => (
                      <div key={comment.id} className="bg-[var(--theme-accent-light)] p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--theme-accent)] font-medium">{comment.user_name}</span>
                            {bannedUsers.has(comment.user_name) && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs rounded">已禁言</span>
                            )}
                          </div>
                          <span className="text-[var(--theme-text-secondary)] text-xs">
                            {new Date(comment.created_at).toLocaleString("zh-TW")}
                          </span>
                        </div>
                        <div className="text-[var(--theme-text-primary)] text-sm mb-2">{comment.comment_text}</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded text-xs transition-all"
                          >
                            刪除留言
                          </button>
                          {!bannedUsers.has(comment.user_name) ? (
                            <button
                              onClick={() => handleBanUser(comment.user_name)}
                              className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-500 rounded text-xs transition-all"
                            >
                              禁止留言
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnbanUser(comment.user_name)}
                              className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded text-xs transition-all"
                            >
                              解除禁言
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[var(--theme-text-secondary)] text-center py-4">還沒有留言</div>
                  )}
                </div>
              </div>
            </div>

            {/* Add Comment Input */}
            {currentUser && (
              <div className="pt-4 border-t border-[var(--theme-border)] flex gap-2 flex-shrink-0">
                {bannedUsers.has(currentUser.name || "匿名") && currentUser.role !== "admin" ? (
                  <div className="w-full p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-center">
                    您已被禁言，無法留言
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--theme-text-primary)] text-sm">管理端留言輸入</span>
                      <HelpHint
                        title="管理端發送留言"
                        description="管理者可直接回覆住戶留言。建議用正式且可追蹤的文字，避免模糊指示。"
                        workflow={[
                          "在輸入框撰寫管理回覆。",
                          "按 Enter 或點發送送出回覆。",
                          "送出後確認留言是否正確顯示於當前公告。",
                        ]}
                        logic={[
                          "空白內容不可發送，避免產生無效管理紀錄。",
                          "管理留言同樣綁定當前選取公告，便於後續追溯。",
                        ]}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="新增留言..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddComment()}
                      className="flex-1 p-2 rounded-lg theme-input outline-none"
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
          <div className="flex items-center justify-center h-full text-[var(--theme-text-secondary)]">
            {loading ? "載入中..." : "選擇一則公告查看詳情"}
          </div>
        )}
      </div>
    </div>
  )
}
