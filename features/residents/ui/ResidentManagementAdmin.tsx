"use client"

import { useState } from "react"
import { useResidents } from "../hooks/useResidents"
import type { Resident } from "../api/residents"

const getRelationshipLabel = (relationship?: string): string => {
  const labels: Record<string, string> = {
    owner: "戶主",
    household_member: "住戶成員",
    tenant: "租客",
  }
  return labels[relationship || "household_member"] || "住戶成員"
}

const getRoleLabel = (role?: string): string => {
  const labels: Record<string, string> = {
    resident: "住戶",
    committee: "管委會",
    guard: "警衛",
    admin: "管理員",
  }
  return labels[role || "resident"] || "住戶"
}

function ResidentFormModal({
  isOpen,
  onClose,
  resident,
  onSave,
  onChange,
  isEditing,
}: {
  isOpen: boolean
  onClose: () => void
  resident: Partial<Resident>
  onSave: () => void
  onChange: (field: keyof Resident, value: string) => void
  isEditing: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">{isEditing ? "編輯住戶資料" : "新增住戶"}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          {/* 姓名 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">姓名</label>
            <input
              type="text"
              value={resident.name || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="請輸入姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          {/* 房號 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">位置</label>
            <input
              type="text"
              value={resident.room || ""}
              onChange={(e) => onChange("room", e.target.value)}
              placeholder="例：A棟 10樓 1001室"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          {/* 電話 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">電話</label>
            <input
              type="text"
              value={resident.phone || ""}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="請輸入電話號碼"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">Email</label>
            <input
              type="email"
              value={resident.email || ""}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="請輸入電子郵件"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          {/* 身分 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">身分</label>
            <select
              value={resident.role || "resident"}
              onChange={(e) => onChange("role", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="resident">住戶</option>
              <option value="committee">管委會</option>
              <option value="guard">警衛</option>
            </select>
          </div>

          {/* 關係 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">關係</label>
            <select
              value={resident.relationship || "household_member"}
              onChange={(e) => onChange("relationship", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="owner">戶主</option>
              <option value="household_member">住戶成員</option>
              <option value="tenant">租客</option>
            </select>
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
const PREVIEW_RESIDENTS: Resident[] = [
  { id: "preview-1", name: "王**", room: "A棟 5樓 501室", phone: "0912-***-***", email: "w***@email.com", relationship: "owner", role: "resident" as const },
  { id: "preview-2", name: "李**", room: "B棟 3樓 302室", phone: "0923-***-***", email: "l***@email.com", relationship: "household_member", role: "resident" as const },
  { id: "preview-3", name: "張**", room: "A棟 8樓 801室", phone: "0934-***-***", email: "z***@email.com", relationship: "tenant", role: "committee" as const },
]

interface ResidentManagementAdminProps {
  isPreviewMode?: boolean
}

export function ResidentManagementAdmin({ isPreviewMode = false }: ResidentManagementAdminProps) {
  const { residents: realResidents, loading, addNewRow, updateRow, handleSave, handleDelete } = useResidents()

  // 預覽模式使用模擬資料
  const residents = isPreviewMode ? PREVIEW_RESIDENTS : realResidents

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<Resident>>({})
  const [searchTerm, setSearchTerm] = useState("")

  const filteredResidents = residents.filter((resident) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      resident.name?.toLowerCase().includes(term) ||
      false ||
      resident.room?.toLowerCase().includes(term) ||
      false ||
      resident.phone?.toLowerCase().includes(term) ||
      false ||
      resident.email?.toLowerCase().includes(term) ||
      false
    )
  })

  const handleOpenAddModal = () => {
    setFormData({
      name: "",
      room: "",
      phone: "",
      email: "",
      role: "resident",
      relationship: "household_member",
    })
    setEditingIndex(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (resident: Resident, index: number) => {
    setFormData({ ...resident })
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingIndex(null)
    setFormData({})
  }

  const handleFormChange = (field: keyof Resident, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFormSave = async () => {
    if (editingIndex !== null) {
      // Update existing row
      const keys = Object.keys(formData) as Array<keyof Resident>
      keys.forEach((key) => {
        const value = formData[key]
        if (value !== undefined) {
          updateRow(editingIndex, key, value)
        }
      })
      await handleSave(formData as Resident, editingIndex)
    } else {
      // Add new row
      addNewRow()
      const newIndex = 0 // New row is added at the beginning
      const keys = Object.keys(formData) as Array<keyof Resident>
      keys.forEach((key) => {
        const value = formData[key]
        if (value !== undefined) {
          updateRow(newIndex, key, value)
        }
      })
      await handleSave(formData as Resident, newIndex)
    }
    handleCloseModal()
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
          <span className="material-icons">people</span>
          住戶/人員管理
        </h2>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--theme-btn-add-border)] text-[var(--theme-btn-add-text)] bg-transparent hover:bg-[var(--theme-btn-add-hover)] transition-all"
        >
          <span className="material-icons text-sm">add</span>
          新增一筆
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="搜尋姓名、房號、電話或 Email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-xl theme-input outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--theme-accent-light)]">
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">姓名</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">房號</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">電話</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">Email</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">身分</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">關係</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredResidents.length > 0 ? (
              filteredResidents
                .filter((r) => r.id)
                .map((row: Resident, index: number) => (
                  <tr key={row.id || `new-${index}`} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.name || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.room || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.phone || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.email || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {getRoleLabel(row.role)}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {getRelationshipLabel(row.relationship)}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEditModal(row, index)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="編輯"
                        >
                          <span className="material-icons text-lg">edit</span>
                        </button>
                        {row.id && (
                          <button
                            onClick={() => handleDelete(row.id!)}
                            className="p-2 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                            title="刪除"
                          >
                            <span className="material-icons text-lg">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[var(--theme-text-secondary)]">
                  {searchTerm ? "沒有符合條件的住戶資料" : "目前沒有資料"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ResidentFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        resident={formData}
        onSave={handleFormSave}
        onChange={handleFormChange}
        isEditing={editingIndex !== null}
      />
    </div>
  )
}
