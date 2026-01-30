"use client"

import { useState } from "react"
import { useMeetings } from "../hooks/useMeetings"
import type { Meeting } from "../api/meetings"
import { uploadMeetingPDF } from "../api/meetings"

interface MeetingFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: Omit<Meeting, "id" | "created_at">
  onChange: (field: keyof Meeting, value: any) => void
  onSave: () => void
  isEditing: boolean
  onPDFFileChange: (file: File | null) => void
  pdfFile: File | null
}

function MeetingFormModal({
  isOpen,
  onClose,
  formData,
  onChange,
  onSave,
  isEditing,
  onPDFFileChange,
  pdfFile,
}: MeetingFormModalProps) {
  const [newTakeaway, setNewTakeaway] = useState("")
  const [editingTakeawayIndex, setEditingTakeawayIndex] = useState<number | null>(null)
  const [editingTakeawayText, setEditingTakeawayText] = useState("")

  if (!isOpen) return null

  const addTakeaway = () => {
    if (newTakeaway.trim()) {
      const currentTakeaways = formData.key_takeaways || []
      onChange("key_takeaways", [...currentTakeaways, newTakeaway.trim()])
      setNewTakeaway("")
    }
  }

  const startEditTakeaway = (index: number) => {
    const currentTakeaways = formData.key_takeaways || []
    setEditingTakeawayIndex(index)
    setEditingTakeawayText(currentTakeaways[index])
  }

  const saveEditTakeaway = () => {
    if (editingTakeawayIndex !== null && editingTakeawayText.trim()) {
      const currentTakeaways = formData.key_takeaways || []
      const updated = [...currentTakeaways]
      updated[editingTakeawayIndex] = editingTakeawayText.trim()
      onChange("key_takeaways", updated)
      setEditingTakeawayIndex(null)
      setEditingTakeawayText("")
    }
  }

  const cancelEditTakeaway = () => {
    setEditingTakeawayIndex(null)
    setEditingTakeawayText("")
  }

  const removeTakeaway = (index: number) => {
    const currentTakeaways = formData.key_takeaways || []
    onChange(
      "key_takeaways",
      currentTakeaways.filter((_, i) => i !== index),
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">
            {isEditing ? "編輯會議/活動" : "新增會議/活動"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">會議主題</label>
            <input
              type="text"
              value={formData.topic || ""}
              onChange={(e) => onChange("topic", e.target.value)}
              placeholder="請輸入會議主題"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">時間</label>
            <input
              type="datetime-local"
              value={formData.time || ""}
              onChange={(e) => onChange("time", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">地點</label>
            <input
              type="text"
              value={formData.location || ""}
              onChange={(e) => onChange("location", e.target.value)}
              placeholder="例：A棟 1樓 會議室"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
              重點摘要 (3-5 項重要決議事項)
            </label>
            <div className="space-y-2">
              {(formData.key_takeaways || []).map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-[var(--theme-bg-secondary)] rounded-lg">
                  <span className="text-[var(--theme-accent)] font-bold mt-1">{index + 1}.</span>
                  {editingTakeawayIndex === index ? (
                    <>
                      <input
                        type="text"
                        value={editingTakeawayText}
                        onChange={(e) => setEditingTakeawayText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") saveEditTakeaway()
                          if (e.key === "Escape") cancelEditTakeaway()
                        }}
                        className="flex-1 p-2 rounded theme-input outline-none"
                        autoFocus
                      />
                      <button
                        onClick={saveEditTakeaway}
                        className="p-1 hover:bg-green-500/20 rounded transition-colors"
                        title="儲存"
                      >
                        <span className="material-icons text-sm text-green-500">check</span>
                      </button>
                      <button
                        onClick={cancelEditTakeaway}
                        className="p-1 hover:bg-gray-500/20 rounded transition-colors"
                        title="取消"
                      >
                        <span className="material-icons text-sm text-gray-500">close</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[var(--theme-text-primary)] mt-1">{item}</span>
                      <button
                        onClick={() => startEditTakeaway(index)}
                        className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                        title="編輯"
                      >
                        <span className="material-icons text-sm text-blue-500">edit</span>
                      </button>
                      <button
                        onClick={() => removeTakeaway(index)}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="刪除"
                      >
                        <span className="material-icons text-sm text-red-500">delete</span>
                      </button>
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTakeaway}
                  onChange={(e) => setNewTakeaway(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addTakeaway()}
                  placeholder="輸入新的重點決議後按 Enter 或點擊新增"
                  className="flex-1 p-3 rounded-xl theme-input outline-none"
                />
                <button
                  onClick={addTakeaway}
                  className="px-4 py-3 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all"
                >
                  <span className="material-icons">add</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">完整會議記錄 (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onPDFFileChange(e.target.files?.[0] || null)}
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
            {pdfFile && (
              <div className="text-green-500 text-sm mt-1 flex items-center gap-1">
                <span className="material-icons text-sm">check_circle</span>
                已選擇: {pdfFile.name}
              </div>
            )}
            {formData.pdf_file_url && !pdfFile && (
              <div className="text-[var(--theme-text-secondary)] text-sm mt-1 flex items-center gap-1">
                <span className="material-icons text-sm">description</span>
                目前已有 PDF 檔案
              </div>
            )}
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">備註</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => onChange("notes", e.target.value)}
              placeholder="請輸入備註事項"
              rows={3}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-3 rounded-xl font-semibold bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all"
          >
            {isEditing ? "儲存變更" : "新增"}
          </button>
        </div>
      </div>
    </div>
  )
}

// 預覽模式的模擬資料
const PREVIEW_MEETINGS = [
  { id: "preview-1", topic: "年度區分所有權人會議", time: new Date(Date.now() + 7 * 86400000).toISOString(), location: "社區大會議室", notes: "年度重要會議", key_takeaways: ["預算審核", "管委會改選", "公共設施更新案"], pdf_file_url: "" },
  { id: "preview-2", topic: "管委會例會", time: new Date(Date.now() - 7 * 86400000).toISOString(), location: "管理室", notes: "", key_takeaways: ["財務報告", "設備維修進度"], pdf_file_url: "https://example.com/meeting.pdf" },
]

interface MeetingManagementAdminProps {
  isPreviewMode?: boolean
}

export function MeetingManagementAdmin({ isPreviewMode = false }: MeetingManagementAdminProps) {
  const { meetings: realMeetings, loading, addMeeting, editMeeting, removeMeeting } = useMeetings()

  // 預覽模式使用模擬資料
  const meetings = isPreviewMode ? PREVIEW_MEETINGS : realMeetings

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<Omit<Meeting, "id" | "created_at">>({
    topic: "",
    time: "",
    location: "",
    notes: "",
    key_takeaways: [],
    pdf_file_url: undefined,
  })
  const [searchTerm, setSearchTerm] = useState("")

  const filteredMeetings = meetings.filter((meeting) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      meeting.topic?.toLowerCase().includes(term) ||
      false ||
      meeting.location?.toLowerCase().includes(term) ||
      false ||
      (meeting.time && new Date(meeting.time).toLocaleDateString("zh-TW").includes(term))
    )
  })

  const handleAdd = () => {
    setFormData({ topic: "", time: "", location: "", notes: "", key_takeaways: [], pdf_file_url: undefined })
    setEditingId(null)
    setPdfFile(null)
    setIsModalOpen(true)
  }

  const handleEdit = (meeting: Meeting) => {
    setFormData({
      topic: meeting.topic,
      time: meeting.time ? meeting.time.slice(0, 16) : "",
      location: meeting.location,
      notes: meeting.notes || "",
      key_takeaways: meeting.key_takeaways || [],
      pdf_file_url: meeting.pdf_file_url || undefined,
    })
    setEditingId(meeting.id || null)
    setPdfFile(null)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof Meeting, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!formData.topic || !formData.time) {
      alert("請填寫主題和時間")
      return
    }

    try {
      const finalData = { ...formData }

      if (pdfFile) {
        try {
          const pdfUrl = await uploadMeetingPDF(pdfFile)
          finalData.pdf_file_url = pdfUrl
        } catch (uploadError) {
          console.error("Error uploading PDF:", uploadError)
          alert("PDF 上傳失敗，請稍後再試")
          return
        }
      }

      if (editingId) {
        await editMeeting(editingId, finalData)
      } else {
        await addMeeting(finalData)
      }
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error saving meeting:", error)
      alert("儲存失敗，請稍後再試")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("確定要刪除此會議/活動嗎？")) {
      await removeMeeting(id)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
          <span className="material-icons">event</span>
          會議/活動管理
        </h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--theme-btn-add-border)] text-[var(--theme-btn-add-text)] bg-transparent hover:bg-[var(--theme-btn-add-hover)] transition-all"
        >
          <span className="material-icons text-sm">add</span>
          新增一筆
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="搜尋會議主題、地點或日期..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-xl theme-input outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--theme-accent-light)]">
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">主題</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">時間</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">地點</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                重點摘要
              </th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">PDF</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeetings.length > 0 ? (
              filteredMeetings.map((meeting) => (
                <tr key={meeting.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.topic || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.time ? new Date(meeting.time).toLocaleString("zh-TW") : "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.location || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.key_takeaways && meeting.key_takeaways.length > 0
                      ? `${meeting.key_takeaways.length} 項`
                      : "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.pdf_file_url ? (
                      <span className="material-icons text-green-500">check_circle</span>
                    ) : (
                      <span className="material-icons text-gray-400">cancel</span>
                    )}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)]">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(meeting)}
                        className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                        title="編輯"
                      >
                        <span className="material-icons text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(meeting.id!)}
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
                  {searchTerm ? "沒有符合條件的會議/活動" : "目前沒有會議/活動"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MeetingFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onChange={handleFormChange}
        onSave={handleSave}
        isEditing={editingId !== null}
        onPDFFileChange={setPdfFile}
        pdfFile={pdfFile}
      />
    </div>
  )
}
