"use client"

import { useState } from "react"
import { useMeetings } from "../hooks/useMeetings"
import type { Meeting } from "../api/meetings"

interface MeetingFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: Omit<Meeting, "id" | "created_at">
  onChange: (field: keyof Meeting, value: string) => void
  onSave: () => void
  isEditing: boolean
}

function MeetingFormModal({ isOpen, onClose, formData, onChange, onSave, isEditing }: MeetingFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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

export function MeetingManagementAdmin() {
  const { meetings, loading, addMeeting, editMeeting, removeMeeting } = useMeetings()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Omit<Meeting, "id" | "created_at">>({
    topic: "",
    time: "",
    location: "",
    notes: "",
  })

  const handleAdd = () => {
    setFormData({ topic: "", time: "", location: "", notes: "" })
    setEditingId(null)
    setIsModalOpen(true)
  }

  const handleEdit = (meeting: Meeting) => {
    setFormData({
      topic: meeting.topic,
      time: meeting.time ? meeting.time.slice(0, 16) : "",
      location: meeting.location,
      notes: meeting.notes || "",
    })
    setEditingId(meeting.id || null)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof Meeting, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!formData.topic || !formData.time) {
      alert("請填寫主題和時間")
      return
    }

    if (editingId) {
      await editMeeting(editingId, formData)
    } else {
      await addMeeting(formData)
    }
    setIsModalOpen(false)
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--theme-accent-light)]">
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">主題</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">時間</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">地點</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">備註</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {meetings.length > 0 ? (
              meetings.map((meeting) => (
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
                    {meeting.notes || "-"}
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
                <td colSpan={5} className="p-8 text-center text-[var(--theme-text-secondary)]">
                  目前沒有會議/活動
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
      />
    </div>
  )
}
