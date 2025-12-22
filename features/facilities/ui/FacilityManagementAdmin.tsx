"use client"

import { useState } from "react"
import { useFacilitiesAdmin } from "../hooks/useFacilities"
import type { Facility } from "../api/facilities"

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
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">基礎點數</label>
              <input
                type="number"
                value={formData.base_price || 10}
                onChange={(e) => onChange("base_price", Number(e.target.value))}
                placeholder="基礎預約點數"
                className="w-full p-3 rounded-xl theme-input outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">冷卻時間（小時）</label>
              <input
                type="number"
                value={formData.cool_down_hours || 24}
                onChange={(e) => onChange("cool_down_hours", Number(e.target.value))}
                placeholder="同設施再預約間隔"
                className="w-full p-3 rounded-xl theme-input outline-none"
              />
            </div>
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">同時預約上限</label>
              <input
                type="number"
                value={formData.max_concurrent_bookings || 2}
                onChange={(e) => onChange("max_concurrent_bookings", Number(e.target.value))}
                placeholder="每戶最大預約數"
                className="w-full p-3 rounded-xl theme-input outline-none"
              />
            </div>
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
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">熱門時段抽籤</label>
              <select
                value={String(formData.is_lottery_enabled)}
                onChange={(e) => onChange("is_lottery_enabled", e.target.value === "true")}
                className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
              >
                <option value="false">關閉</option>
                <option value="true">開啟</option>
              </select>
            </div>
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
  const { facilities, bookings, loading, imageFiles, handleImageFileChange, handleSave, handleDelete, addNewFacility } =
    useFacilitiesAdmin()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<Facility>({
    id: "",
    name: "",
    description: "",
    location: "",
    capacity: 1,
    image_url: "",
    available: true,
    base_price: 10,
    cool_down_hours: 24,
    is_lottery_enabled: false,
    max_concurrent_bookings: 2,
  })
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null)
  const [searchTermFacility, setSearchTermFacility] = useState("")
  const [searchTermBooking, setSearchTermBooking] = useState("")

  const handleAdd = () => {
    setFormData({
      id: "",
      name: "",
      description: "",
      location: "",
      capacity: 1,
      image_url: "",
      available: true,
      base_price: 10,
      cool_down_hours: 24,
      is_lottery_enabled: false,
      max_concurrent_bookings: 2,
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
      image_url: facility.image_url || "",
      available: facility.available ?? true,
      base_price: facility.base_price || 10,
      cool_down_hours: facility.cool_down_hours || 24,
      is_lottery_enabled: facility.is_lottery_enabled || false,
      max_concurrent_bookings: facility.max_concurrent_bookings || 2,
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
      const facilityToSave = {
        ...facilities[editingIndex],
        ...formData,
      }
      const result = await handleSave(facilityToSave as any, editingIndex, currentImageFile)
      alert(result.message)
    } else {
      const newIndex = facilities.length
      addNewFacility()
      const result = await handleSave({ ...formData, id: "" } as any, newIndex, currentImageFile)
      alert(result.message)
    }
    setIsModalOpen(false)
    setCurrentImageFile(null)
  }

  const onDelete = async (id: string) => {
    const result = await handleDelete(id)
    if (result.success) {
      alert(result.message)
    } else if (result.message !== "已取消") {
      alert(result.message)
    }
  }

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      confirmed: { color: "bg-green-500/20 text-green-500", text: "已確認" },
      cancelled: { color: "bg-red-500/20 text-red-500", text: "已取消" },
      completed: { color: "bg-blue-500/20 text-blue-500", text: "已完成" },
      no_show: { color: "bg-orange-500/20 text-orange-500", text: "未到場" },
      waitlist: { color: "bg-yellow-500/20 text-yellow-500", text: "候補中" },
      pending_lottery: { color: "bg-purple-500/20 text-purple-500", text: "抽籤中" },
    }
    return statusMap[status] || { color: "bg-gray-500/20 text-gray-500", text: status }
  }

  const filteredFacilities = facilities.filter((facility) => {
    if (!searchTermFacility) return true
    const term = searchTermFacility.toLowerCase()
    return (
      facility.name?.toLowerCase().includes(term) || false || facility.location?.toLowerCase().includes(term) || false
    )
  })

  const filteredBookings = bookings.filter((booking) => {
    if (!searchTermBooking) return true
    const term = searchTermBooking.toLowerCase()
    return (
      booking.facilities?.name?.toLowerCase().includes(term) ||
      false ||
      booking.user_name?.toLowerCase().includes(term) ||
      false ||
      booking.user_room?.toLowerCase().includes(term) ||
      false ||
      booking.status.toLowerCase().includes(term)
    )
  })

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

        <div className="mb-4">
          <input
            type="text"
            placeholder="搜尋設施名稱或位置..."
            value={searchTermFacility}
            onChange={(e) => setSearchTermFacility(e.target.value)}
            className="w-full p-3 rounded-xl theme-input outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  設施名稱
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">位置</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  基礎點數
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">冷卻</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">抽籤</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.length > 0 ? (
                filteredFacilities.map((facility, index) => (
                  <tr key={facility.id || index} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {facility.name || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {facility.location || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-accent)] font-medium">
                      {facility.base_price || 10} 點
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {facility.cool_down_hours || 24} 小時
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${facility.is_lottery_enabled ? "bg-purple-500/20 text-purple-500" : "bg-gray-500/20 text-gray-500"}`}
                      >
                        {facility.is_lottery_enabled ? "開啟" : "關閉"}
                      </span>
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
                  <td colSpan={7} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    {searchTermFacility ? "沒有符合條件的設施資料" : "目前沒有設施資料"}
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

        <div className="mb-4">
          <input
            type="text"
            placeholder="搜尋設施、預約人、房號或狀態..."
            value={searchTermBooking}
            onChange={(e) => setSearchTermBooking(e.target.value)}
            className="w-full p-3 rounded-xl theme-input outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">設施</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  預約人
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">日期</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">時間</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">點數</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">簽到</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => {
                  const statusDisplay = getStatusDisplay(booking.status)
                  return (
                    <tr key={booking.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                        {booking.facilities?.name || "未知設施"}
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                        {booking.user_name} ({booking.user_room || "-"})
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                        {new Date(booking.booking_date).toLocaleDateString("zh-TW")}
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                        {booking.start_time} - {booking.end_time}
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-accent)] font-medium">
                        {booking.points_spent || "-"} 點
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-secondary)]">
                        {booking.check_in_time
                          ? new Date(booking.check_in_time).toLocaleTimeString("zh-TW", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="p-3 border-b border-[var(--theme-border)]">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusDisplay.color}`}>
                          {statusDisplay.text}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    {searchTermBooking ? "沒有符合條件的預約紀錄" : "目前沒有預約紀錄"}
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
