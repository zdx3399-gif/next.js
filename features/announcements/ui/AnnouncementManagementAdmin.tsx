"use client"

import { useState, useEffect } from "react"
import type { Announcement } from "../api/announcements"
import {
  fetchAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadAnnouncementImage,
} from "../api/announcements"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface HelpHintProps {
  title: string
  description: string
}

function HelpHint({ title, description }: HelpHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-accent-light)] text-[var(--theme-accent)] text-xs font-semibold leading-none hover:border-[var(--theme-border-accent)] hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-accent)]"
          aria-label={`${title}說明`}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[220] w-80 text-sm">
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-[var(--theme-text-secondary)] leading-relaxed">{description}</div>
      </PopoverContent>
    </Popover>
  )
}

interface AnnouncementFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: Partial<Announcement>
  onChange: (field: keyof Announcement, value: string) => void
  onSave: () => void
  isEdit: boolean
  onImageFileChange: (file: File | null) => void
  imageFile: File | null
}

function AnnouncementFormModal({
  isOpen,
  onClose,
  formData,
  onChange,
  onSave,
  isEdit,
  onImageFileChange,
  imageFile,
}: AnnouncementFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-semibold text-[var(--theme-accent)]">{isEdit ? "編輯公告" : "新增公告"}</h3>
          <button
            onClick={onClose}
            className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">標題</label>
              <HelpHint title="標題" description="公告的主題名稱，會出現在公告列表與首頁輪播。建議在 20 字內說清楚『事件 + 重點』，例如：2/28 停水通知。" />
            </div>
            <input
              type="text"
              value={formData.title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="請輸入公告標題"
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">內容</label>
              <HelpHint title="內容" description="公告完整內容區，建議包含：發生時間、地點/棟別、影響範圍、住戶需配合事項、聯絡窗口。這欄位會直接顯示給住戶閱讀。" />
            </div>
            <textarea
              value={formData.content || ""}
              onChange={(e) => onChange("content", e.target.value)}
              placeholder="請輸入公告內容"
              rows={4}
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)] resize-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">圖片</label>
              <HelpHint title="圖片" description="可上傳公告配圖（例如施工區域示意、活動海報）。有圖片時住戶更容易理解重點；未上傳也可以正常儲存與發布。" />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onImageFileChange(e.target.files?.[0] || null)}
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
            {imageFile && <div className="text-green-500 text-sm mt-1">已選擇: {imageFile.name}</div>}
            {formData.image_url && !imageFile && (
              <div className="text-[var(--theme-text-secondary)] text-sm mt-1 truncate">
                目前: {formData.image_url.substring(0, 50)}...
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">作者</label>
              <HelpHint title="作者" description="顯示公告發布者名稱，用於住戶辨識資訊來源。此欄位目前為系統帶入（唯讀），避免手動修改造成來源混淆。" />
            </div>
            <input
              type="text"
              value={formData.author_name || "管理員"}
              readOnly
              className="w-full p-3 rounded-xl theme-input outline-none bg-[var(--theme-bg-secondary)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">狀態</label>
              <HelpHint title="狀態" description="草稿：僅管理端可見，適合先編輯與校稿。已發布：住戶端可見，會進入公告列表與相關展示區。發布前請再確認內容正確。" />
            </div>
            <select
              value={formData.status || "draft"}
              onChange={(e) => onChange("status", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="draft">草稿</option>
              <option value="published">已發布</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onSave}
              className="flex-1 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              {isEdit ? "儲存變更" : "新增公告"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-[var(--theme-border)] text-[var(--theme-text-primary)] rounded-xl font-semibold hover:bg-[var(--theme-bg-secondary)] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 預覽模式的模擬資料
const PREVIEW_ANNOUNCEMENTS = [
  { id: "preview-1", title: "社區年度大會通知", content: "本年度區分所有權人會議將於...", author_name: "管委會", status: "published", created_at: new Date().toISOString(), image_url: "" },
  { id: "preview-2", title: "電梯保養通知", content: "電梯將於下週進行例行保養...", author_name: "管理員", status: "published", created_at: new Date(Date.now() - 86400000).toISOString(), image_url: "" },
  { id: "preview-3", title: "停車場施工公告", content: "停車場將進行地坪修復工程...", author_name: "管委會", status: "draft", created_at: new Date(Date.now() - 2 * 86400000).toISOString(), image_url: "" },
]

interface AnnouncementManagementAdminProps {
  isPreviewMode?: boolean
}

export function AnnouncementManagementAdmin({ isPreviewMode = false }: AnnouncementManagementAdminProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState<Partial<Announcement>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const loadAnnouncements = async () => {
    setLoading(true)
    const { data, error } = await fetchAllAnnouncements()
    if (!error && data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isPreviewMode) {
      setAnnouncements(PREVIEW_ANNOUNCEMENTS as Announcement[])
      setLoading(false)
    } else {
      loadAnnouncements()
    }
  }, [isPreviewMode])

  const handleAdd = () => {
    setEditingAnnouncement(null)
    setFormData({ status: "draft" })
    setImageFile(null)
    setIsModalOpen(true)
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setFormData(announcement)
    setImageFile(null)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof Announcement, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      const finalData = { ...formData }

      if (imageFile) {
        try {
          const imageUrl = await uploadAnnouncementImage(imageFile)
          finalData.image_url = imageUrl
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError)
          alert("圖片上傳失敗，請稍後再試")
          return
        }
      }

      if (editingAnnouncement) {
        const { error } = await updateAnnouncement(editingAnnouncement.id, finalData)
        if (error) {
          console.error("[v0] Failed to update announcement:", error)
          alert(`更新失敗: ${error.message || "未知錯誤"}`)
          return
        }
        alert("公告已更新")
      } else {
        const { error } = await createAnnouncement(finalData)
        if (error) {
          console.error("[v0] Failed to create announcement:", error)
          alert(`新增失敗: ${error.message || "未知錯誤"}`)
          return
        }
        alert("公告已新增")
      }
      setIsModalOpen(false)
      loadAnnouncements()
    } catch (error) {
      console.error("Error saving announcement:", error)
      alert("儲存失敗，請稍後再試")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("確定要刪除此公告嗎？")) {
      await deleteAnnouncement(id)
      loadAnnouncements()
    }
  }

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      announcement.title?.toLowerCase().includes(term) ||
      announcement.content?.toLowerCase().includes(term) ||
      announcement.author_name?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex items-center gap-2 text-[var(--theme-accent)] text-xl">
          <span className="material-icons">campaign</span>
          公告管理
          <HelpHint
            title="公告管理"
            description="這裡是公告後台：可新增、編輯、刪除公告，並切換草稿/已發布。建議流程為『先草稿校對 → 確認內容無誤 → 改為已發布』，可降低誤發風險。"
          />
        </h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--theme-btn-add-border)] text-[var(--theme-btn-add-text)] rounded-lg hover:bg-[var(--theme-btn-add-border)]/15 transition-all text-sm font-semibold"
        >
          <span className="material-icons text-xl">add</span>
          新增一筆
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[var(--theme-text-primary)] font-medium">搜尋</label>
          <HelpHint title="搜尋" description="可用關鍵字搜尋標題、內容、作者。適合快速找到舊公告，例如輸入『停水』『電梯』『活動』等字詞。" />
        </div>
        <input
          type="text"
          placeholder="搜尋標題、內容或作者..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-xl theme-input outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center text-[var(--theme-text-secondary)] py-12">載入中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>標題</span>
                    <HelpHint title="標題欄" description="顯示公告主題，用來快速辨識每筆公告。標題清楚時，管理者在大量資料中也能快速定位目標。" />
                  </div>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>內容</span>
                    <HelpHint title="內容欄" description="顯示公告內容摘要（列表會截斷）。若要檢視或調整完整內容，請使用右側編輯按鈕進入表單。" />
                  </div>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>作者</span>
                    <HelpHint title="作者欄" description="顯示發布者名稱，方便追蹤公告來源與責任歸屬。住戶若有疑問，也可依此辨識聯繫對象。" />
                  </div>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>狀態</span>
                    <HelpHint title="狀態欄" description="顯示公告目前狀態：草稿（僅管理端可見）或已發布（住戶可見）。可用來快速檢查哪些公告尚未對外發布。" />
                  </div>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>建立日期</span>
                    <HelpHint title="建立日期欄" description="顯示公告建立日期，協助判斷資訊新舊與發布時序，避免誤用過期公告內容。" />
                  </div>
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>操作</span>
                    <HelpHint title="操作欄" description="可對單筆公告執行編輯或刪除。建議刪除前先確認該公告是否仍需留存作為歷史紀錄。" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAnnouncements.length > 0 ? (
                filteredAnnouncements.map((announcement) => (
                  <tr key={announcement.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {announcement.title}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-[200px]">
                      <div className="line-clamp-2">{announcement.content}</div>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {announcement.author_name || "管理員"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          announcement.status === "published"
                            ? "bg-green-500/20 text-green-500"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {announcement.status === "published" ? "已發布" : "草稿"}
                      </span>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="編輯"
                        >
                          <span className="material-icons text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                          title="刪除"
                        >
                          <span className="material-icons text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    {searchTerm ? "沒有符合條件的公告資料" : "目前沒有公告資料"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnnouncementFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onChange={handleFormChange}
        onSave={handleSave}
        isEdit={!!editingAnnouncement}
        onImageFileChange={setImageFile}
        imageFile={imageFile}
      />
    </div>
  )
}
