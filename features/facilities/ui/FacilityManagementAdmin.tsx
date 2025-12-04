"use client"

import { useState } from "react"
import { useFacilitiesAdmin } from "../hooks/useFacilities"

interface Facility {
  id?: string
  name: string
  description: string
  location: string
  capacity: number
  image_url: string | null
  available: boolean
}

interface FacilityFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: Facility
  onChange: (field: keyof Facility, value: any) => void
  onSave: () => void
  isEditing: boolean
  imageFile: File | null
  onImageChange: (file: File | null) => void
}

function FacilityFormModal({
  isOpen,
  onClose,
  formData,
  onChange,
  onSave,
  isEditing,
  imageFile,
  onImageChange,
}: FacilityFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">{isEditing ? "編輯設施" : "新增設施"}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">設施名稱</label>
            <input
              type="text"
              value={formData.name || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="例：健身房、游泳池"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">說明</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="請描述設施詳情"
              rows={3}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">位置</label>
            <input
              type="text"
              value={formData.location || ""}
              onChange={(e) => onChange("location", e.target.value)}
              placeholder="例：B棟 地下1樓"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">容納人數</label>
            <input
              type="number"
              value={formData.capacity || 1}
              onChange={(e) => onChange("capacity", Number(e.target.value))}
              placeholder="請輸入容納人數"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">圖片</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onImageChange(e.target.files?.[0] || null)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
            {imageFile && <div className="text-green-500 text-sm mt-2">已選擇: {imageFile.name}</div>}
            {formData.image_url && !imageFile && (
              <div className="text-[var(--theme-text-secondary)] text-sm mt-2">
                目前圖片: {formData.image_url.substring(0, 40)}...
              </div>
            )}
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">狀態</label>
            <select
              value={String(formData.available)}
              onChange={(e) => onChange("available", e.target.value === "true")}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="true">可用</option>
              <option value="false">不可用</option>
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

export function FacilityManagementAdmin() {
  const {
    facilities,
    bookings,
    loading,
    imageFiles,
    updateRow,
    handleImageFileChange,
    handleSave,
    handleDelete,
    addNewFacility,
  } = useFacilitiesAdmin()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<Facility>({
    name: "",
    description: "",
    location: "",
    capacity: 1,
    image_url: null,
    available: true,
  })
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null)

  const handleAdd = () => {
    setFormData({
      name: "",
      description: "",
      location: "",
      capacity: 1,
      image_url: null,
      available: true,
    })
    setCurrentImageFile(null)
    setEditingIndex(null)
    setIsModalOpen(true)
  }

  const handleEdit = (index: number) => {
    const facility = facilities[index]
    setFormData({
      id: facility.id,
      name: facility.name || "",
      description: facility.description || "",
      location: facility.location || "",
      capacity: facility.capacity || 1,
      image_url: facility.image_url || null,
      available: facility.available ?? true,
    })
    setCurrentImageFile(imageFiles[index] || null)
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof Facility, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const onSave = async () => {
    if (editingIndex !== null) {
      const keys = Object.keys(formData) as Array<keyof Facility>
      keys.forEach((key) => {
        if (formData[key] !== undefined) {
          updateRow(editingIndex, key as any, formData[key] as any)
        }
      })
      if (currentImageFile) {
        handleImageFileChange(editingIndex, currentImageFile)
      }
      const result = await handleSave(facilities[editingIndex], editingIndex)
      alert(result.message)
    } else {
      addNewFacility()
      const newIndex = facilities.length
      const keys = Object.keys(formData) as Array<keyof Facility>
      keys.forEach((key) => {
        if (formData[key] !== undefined) {
          updateRow(newIndex, key as any, formData[key] as any)
        }
      })
      if (currentImageFile) {
        handleImageFileChange(newIndex, currentImageFile)
      }
      const result = await handleSave({ ...formData } as any, newIndex)
      alert(result.message)
    }
    setIsModalOpen(false)
  }

  const onDelete = async (id: string) => {
    if (confirm("確定要刪除此設施嗎？")) {
      const result = await handleDelete(id)
      if (result.success) {
        alert(result.message)
      }
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
    <div className="space-y-6">
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
            <span className="material-icons">meeting_room</span>
            設施管理
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
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  設施名稱
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">說明</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">位置</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  容納人數
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {facilities.length > 0 ? (
                facilities.map((facility, index) => (
                  <tr key={facility.id || index} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {facility.name || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-xs truncate">
                      {facility.description || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {facility.location || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {facility.capacity || 1} 人
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${facility.available ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}
                      >
                        {facility.available ? "可用" : "不可用"}
                      </span>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(index)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="編輯"
                        >
                          <span className="material-icons text-lg">edit</span>
                        </button>
                        {facility.id && (
                          <button
                            onClick={() => onDelete(facility.id!)}
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
                  <td colSpan={6} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    目前沒有設施資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
            <span className="material-icons">event</span>
            預約紀錄
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">設施</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  預約人
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">房號</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">日期</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">時間</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">備註</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length > 0 ? (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {booking.facilities?.name || "未知設施"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {booking.user_name}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {booking.user_room || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {new Date(booking.booking_date).toLocaleDateString("zh-TW")}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {booking.start_time} - {booking.end_time}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-secondary)]">
                      {booking.notes || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          booking.status === "confirmed"
                            ? "bg-green-500/20 text-green-500"
                            : "bg-red-500/20 text-red-500"
                        }`}
                      >
                        {booking.status === "confirmed" ? "已確認" : "已取消"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    目前沒有預約紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FacilityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onChange={handleFormChange}
        onSave={onSave}
        isEditing={editingIndex !== null}
        imageFile={currentImageFile}
        onImageChange={setCurrentImageFile}
      />
    </div>
  )
}
