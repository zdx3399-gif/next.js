"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"
import { HelpHint } from "@/components/ui/help-hint"
import { fetchUserReadAnnouncements, markAnnouncementAsRead } from "../api/announcements"

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
  isPreviewMode?: boolean
}

const PREVIEW_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "resident-preview-1",
    title: "測試資料",
    content: "測試資料",
    image_url: "",
    author: "測試資料",
    created_at: new Date().toISOString(),
    status: "published",
  },
  {
    id: "resident-preview-2",
    title: "測試資料",
    content: "測試資料",
    image_url: "",
    author: "測試資料",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    status: "published",
  },
]

const PREVIEW_COMMENTS: Record<string, Comment[]> = {
  "resident-preview-1": [
    {
      id: "resident-preview-c1",
      announcement_id: "resident-preview-1",
      user_name: "測試資料",
      comment_text: "測試資料",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
}

export function AnnouncementDetails({ onClose, currentUser, isPreviewMode = false }: AnnouncementDetailsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [comments, setComments] = useState<Map<string, Comment[]>>(new Map())
  const [likes, setLikes] = useState<Map<string, Set<string>>>(new Map())
  const [bannedUsers, setBannedUsers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set())
  const [markingRead, setMarkingRead] = useState(false)

  useEffect(() => {
    if (isPreviewMode) {
      setAnnouncements(PREVIEW_ANNOUNCEMENTS)
      setSelectedAnnouncement(PREVIEW_ANNOUNCEMENTS[0])
      setComments(new Map(Object.entries(PREVIEW_COMMENTS)))
      setLikes(new Map())
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
    loadReadAnnouncements()
  }, [isPreviewMode])

  const loadReadAnnouncements = async () => {
    if (isPreviewMode || !currentUser?.id) {
      setReadAnnouncements(new Set())
      return
    }

    const readSet = await fetchUserReadAnnouncements(currentUser.id)
    setReadAnnouncements(readSet)
  }

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
      setSelectedAnnouncement(PREVIEW_ANNOUNCEMENTS[0])
      return
    }

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

  const handleMarkAsRead = async () => {
    if (!selectedAnnouncement || !currentUser?.id || isPreviewMode) return

    if (readAnnouncements.has(selectedAnnouncement.id)) return

    setMarkingRead(true)
    const { error } = await markAnnouncementAsRead(selectedAnnouncement.id, currentUser.id)
    setMarkingRead(false)

    if (error) {
      alert("標記已讀失敗，請稍後再試")
      return
    }

    setReadAnnouncements((prev) => new Set([...prev, selectedAnnouncement.id]))
  }

  const currentComments = selectedAnnouncement ? comments.get(selectedAnnouncement.id) || [] : []
  const currentLikes = selectedAnnouncement ? likes.get(selectedAnnouncement.id) || new Set() : new Set()
  const hasLiked = selectedAnnouncement ? currentLikes.has(currentUser?.id) : false

  return (
    <div className="flex gap-4 h-[600px]">
      <div className="w-1/3 flex flex-col gap-3 border-r border-[var(--theme-border)] pr-4 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-[var(--theme-text-primary)] text-sm font-medium">公告列表</span>
          <HelpHint
            title="住戶公告列表"
            description="這裡會顯示已發布公告。點選任一公告可在右側看完整內容；可先用下方搜尋快速找到你關心的主題。"
            workflow={[
              "先在左側清單選擇一則公告，右側會同步顯示完整內容。",
              "公告很多時先用搜尋縮小範圍，再點選目標公告。",
              "切換公告後，檢查發布日期與發布者再決定是否採取行動。",
            ]}
            logic={[
              "清單只顯示已發布公告（published），未發布內容不會出現在住戶端。",
              "目前選取公告會高亮，避免在多則公告間誤讀內容。",
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--theme-text-primary)] text-sm">搜尋</span>
          <HelpHint
            title="住戶搜尋"
            description="輸入關鍵字可篩選公告標題與內容，例如『停水』『電梯』『活動』。找不到時可清空關鍵字查看全部。"
            workflow={[
              "在搜尋框輸入關鍵字（可用設備、活動、日期等詞）。",
              "確認左側列表即時縮小後，再點選目標公告查看內容。",
              "若沒有結果，清空關鍵字回到完整列表。",
            ]}
            logic={[
              "搜尋同時比對標題與內文，不會改動任何公告資料。",
              "搜尋是前端篩選行為，只影響目前畫面顯示。",
            ]}
          />
        </div>
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
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--theme-text-muted)]">
                    {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                  </span>
                  {!isPreviewMode && (
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        readAnnouncements.has(announcement.id)
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {readAnnouncements.has(announcement.id) ? "已讀" : "未讀"}
                    </span>
                  )}
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
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-[var(--theme-accent)]">{selectedAnnouncement.title}</h3>
                  <HelpHint
                    title="公告詳情"
                    description="此區顯示完整公告內容與圖片。建議先確認日期與內容是否仍適用，再依公告指示進行後續動作。"
                    workflow={[
                      "先看標題、發布者與日期確認公告時效。",
                      "再閱讀圖片與完整內文，依公告指示執行後續操作。",
                      "若有疑問可在下方留言區提問。",
                    ]}
                    logic={[
                      "詳情區內容會隨左側選取公告即時切換。",
                      "公告內容以發布資料為準，住戶端僅可閱讀與互動（按讚/留言）。",
                    ]}
                  />
                </div>
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
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[var(--theme-text-primary)] text-sm">按讚</span>
                  <HelpHint
                    title="住戶按讚"
                    description="按讚可表達你對公告的認同或回饋，數字會顯示社區關注度。再次點擊可取消按讚。"
                    workflow={[
                      "閱讀公告後點擊按讚按鈕表達認同。",
                      "若要收回反應，再次點擊同一按鈕即可取消。",
                      "觀察按讚數字變化，了解社區對公告的關注程度。",
                    ]}
                    logic={[
                      "按讚為切換行為：同一使用者可在已讚/未讚間切換。",
                      "未登入或無使用者資料時按鈕會停用。",
                    ]}
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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

                  {!isPreviewMode && currentUser?.id && (
                    <button
                      onClick={handleMarkAsRead}
                      disabled={markingRead || readAnnouncements.has(selectedAnnouncement.id)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        readAnnouncements.has(selectedAnnouncement.id)
                          ? "bg-emerald-500/15 text-emerald-400 cursor-default"
                          : "bg-[var(--theme-bg-secondary)] text-emerald-400 hover:bg-emerald-500/10"
                      } ${markingRead ? "opacity-60 cursor-wait" : ""}`}
                    >
                      <span className="material-icons text-base">done</span>
                      {readAnnouncements.has(selectedAnnouncement.id)
                        ? "已讀"
                        : markingRead
                          ? "標記中..."
                          : "標記已讀"}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-lg font-bold text-[var(--theme-accent)]">留言 ({currentComments.length})</h4>
                  <HelpHint
                    title="住戶留言"
                    description="可在此提問或回覆公告內容。留言請避免個資與不當文字；若違反規範，可能被管理員限制留言權限。"
                    workflow={[
                      "先閱讀既有留言，避免重複提問。",
                      "在輸入框撰寫重點內容後送出留言。",
                      "送出後確認留言是否出現在清單中。",
                    ]}
                    logic={[
                      "留言會綁定目前選取的公告，不會跨公告共用。",
                      "被禁言使用者不可送出留言，只能查看內容。",
                    ]}
                  />
                </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--theme-text-primary)] text-sm">新增留言</span>
                      <HelpHint
                        title="住戶發送留言"
                        description="輸入內容後可按 Enter 或點『發送』。建議一句重點一行，方便管理員與其他住戶閱讀。"
                        workflow={[
                          "在輸入框填寫留言內容。",
                          "按 Enter 或點「發送」送出。",
                          "送出成功後輸入框會清空，可繼續補充留言。",
                        ]}
                        logic={[
                          "空白內容不會送出，避免產生無效留言。",
                          "留言作者名稱會使用目前登入者姓名；未提供時顯示匿名。",
                        ]}
                      />
                    </div>
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
