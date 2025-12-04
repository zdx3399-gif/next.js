"use client"

import { useState, useEffect } from "react"
import type { Announcement } from "../api/announcements"
import { fetchAllAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "../api/announcements"

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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">標題</label>
            <input
              type="text"
              value={formData.title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="請輸入公告標題"
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">內容</label>
            <textarea
              value={formData.content || ""}
              onChange={(e) => onChange("content", e.target.value)}
              placeholder="請輸入公告內容"
              rows={4}
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)] resize-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">圖片</label>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">作者</label>
            <input
              type="text"
              value={formData.author || ""}
              onChange={(e) => onChange("author", e.target.value)}
              placeholder="請輸入作者名稱"
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">狀態</label>
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

export function AnnouncementManagementAdmin() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState<Partial<Announcement>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)

  const loadAnnouncements = async () => {
    setLoading(true)
    const { data, error } = await fetchAllAnnouncements()
    if (!error && data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

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

      // Handle image upload if file selected
      if (imageFile) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(imageFile)
        })
        finalData.image_url = base64
      }

      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, finalData)
      } else {
        await createAnnouncement(finalData)
      }
      setIsModalOpen(false)
      loadAnnouncements()
    } catch (error) {
      console.error("Error saving announcement:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("確定要刪除此公告嗎？")) {
      await deleteAnnouncement(id)
      loadAnnouncements()
    }
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex items-center gap-2 text-[var(--theme-accent)] text-xl">
          <span className="material-icons">campaign</span>
          公告管理
        </h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--theme-btn-add-border)] text-[var(--theme-btn-add-text)] rounded-lg hover:bg-[var(--theme-btn-add-border)]/15 transition-all text-sm font-semibold"
        >
          <span className="material-icons text-xl">add</span>
          新增一筆
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[var(--theme-text-secondary)] py-12">載入中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">標題</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">內容</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">作者</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  建立日期
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length > 0 ? (
                announcements.map((announcement) => (
                  <tr key={announcement.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {announcement.title}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-[200px]">
                      <div className="line-clamp-2">{announcement.content}</div>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {announcement.author}
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
                    目前沒有公告資料
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
