"use client"

import { useState } from "react"
import { useFacilitiesAdmin } from "../hooks/useFacilities"
import type { Facility } from "../api/facilities"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Plus, Search } from "lucide-react"

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
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">{isEditing ? "編輯設施" : "新增設施"}<HelpHint title="管理端設施編輯" description="可建立或更新設施屬性，影響住戶可預約規則。" workflow={["新增或編輯設施時先填基本資料。","再設定點數、冷卻、抽籤與可用狀態。","儲存後回列表確認規則是否正確。"]} logic={["設施設定會直接影響住戶端預約可行性與成本。","錯誤規則可能導致不可預約或超賣風險。"]} /></h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">設施名稱<HelpHint title="管理端設施名稱" description="住戶端顯示名稱，建議明確易懂。" workflow={["輸入住戶易懂的設施名稱。","避免重複或模糊命名。"]} logic={["名稱是住戶端搜尋與辨識主要欄位。"]} align="center" /></label>
            <input
              type="text"
              value={formData.name || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="例：健身房、游泳池"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">說明<HelpHint title="管理端設施說明" description="描述使用限制與注意事項。" workflow={["填寫使用規範與注意事項。","有特殊限制請明確寫在說明內。"]} logic={["說明可降低住戶誤用與客服反覆解釋成本。"]} align="center" /></label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="請描述設施詳情"
              rows={3}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">位置<HelpHint title="管理端設施位置" description="填寫實際位置，便於住戶到場。" workflow={["輸入棟別/樓層/場地名稱。","更新場地異動時同步修正。"]} logic={["位置資訊會影響住戶到場效率與遲到率。"]} align="center" /></label>
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
              <div className="inline-flex ml-2"><HelpHint title="管理端容納人數" description="設定單時段最大人數。" workflow={["依場地實際安全容量填寫。","調整後確認不影響既有預約政策。"]} logic={["容量是時段供應上限，影響超賣風險。"]} align="center" /></div>
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
              <div className="inline-flex ml-2"><HelpHint title="管理端基礎點數" description="一般時段的預約點數基準。" workflow={["填入一般時段標準點數。","再搭配尖峰倍率規則評估合理性。"]} logic={["基礎點數會影響住戶使用意願與資源分配。"]} align="center" /></div>
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
              <div className="inline-flex ml-2"><HelpHint title="管理端冷卻時間" description="同戶再次預約同設施需間隔時數。" workflow={["設定同戶連續預約間隔時數。","熱門設施可提高冷卻時間。"]} logic={["冷卻時間可避免少數住戶壟斷時段。"]} align="center" /></div>
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
              <div className="inline-flex ml-2"><HelpHint title="管理端同時預約上限" description="每戶同時可持有的預約數量上限。" workflow={["設定每戶同時預約筆數。","依社區資源公平性調整上限。"]} logic={["同時上限可控制佔用量並提升可用性。"]} align="center" /></div>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">圖片<HelpHint title="管理端設施圖片" description="上傳後可提升住戶辨識度。" workflow={["選擇清晰場地照片上傳。","更換圖片後確認預覽資訊已更新。"]} logic={["圖片有助住戶辨識場地，降低預約錯場機率。"]} align="center" /></label>
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
              <div className="inline-flex ml-2"><HelpHint title="管理端可用狀態" description="不可用時住戶將無法預約。" workflow={["維修或停用時切換為不可用。","恢復服務後再改回可用。"]} logic={["可用狀態是住戶端預約入口開關。"]} align="center" /></div>
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
              <div className="inline-flex ml-2"><HelpHint title="管理端抽籤" description="開啟後熱門時段可改為抽籤機制。" workflow={["需要公平分配熱門時段時開啟抽籤。","一般時段維持直接預約可關閉。"]} logic={["抽籤可降低搶位不公平，但流程會增加等待時間。"]} align="center" /></div>
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

// 預覽模式的模擬資料
const PREVIEW_FACILITIES = [
  { id: "preview-1", name: "健身房", description: "配有跑步機、啞鈴等設備", location: "B棟 地下1樓", capacity: 10, image_url: "", available: true, base_price: 20, cool_down_hours: 24, is_lottery_enabled: false, max_concurrent_bookings: 2 },
  { id: "preview-2", name: "游泳池", description: "25公尺標準泳池", location: "頂樓", capacity: 30, image_url: "", available: true, base_price: 30, cool_down_hours: 48, is_lottery_enabled: true, max_concurrent_bookings: 1 },
  { id: "preview-3", name: "KTV包廂", description: "可容納10人的KTV包廂", location: "B棟 1樓", capacity: 10, image_url: "", available: false, base_price: 50, cool_down_hours: 72, is_lottery_enabled: false, max_concurrent_bookings: 1 },
]

const PREVIEW_BOOKINGS = [
  { id: "preview-b1", facilities: { name: "健身房" }, user_name: "王**", user_room: "A棟 501室", booking_date: new Date().toISOString().split("T")[0], start_time: "09:00", end_time: "10:00", points_used: 20, points_spent: 20, check_in_time: null, status: "confirmed" },
  { id: "preview-b2", facilities: { name: "游泳池" }, user_name: "李**", user_room: "B棟 302室", booking_date: new Date().toISOString().split("T")[0], start_time: "14:00", end_time: "15:00", points_used: 30, points_spent: 30, check_in_time: new Date().toISOString(), status: "completed" },
]

interface FacilityManagementAdminProps {
  isPreviewMode?: boolean
}

export function FacilityManagementAdmin({ isPreviewMode = false }: FacilityManagementAdminProps) {
  const { facilities: realFacilities, bookings: realBookings, loading, imageFiles, handleImageFileChange, handleSave, handleDelete, addNewFacility, reload } =
    useFacilitiesAdmin()

  // 預覽模式使用模擬資料
  const facilities = isPreviewMode ? PREVIEW_FACILITIES : realFacilities
  const bookings = isPreviewMode ? PREVIEW_BOOKINGS : realBookings

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
            <HelpHint title="管理端設施管理" description="管理設施資料與預約規則，直接影響住戶端可見內容。" workflow={["先用搜尋定位設施，再新增或編輯。","更新後檢查列表欄位與狀態標籤。","必要時刪除停用設施資料。"]} logic={["此頁是設施主檔，所有住戶端預約都依此規則運作。"]} />
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[var(--theme-text-primary)] text-sm">搜尋設施</span>
              <HelpHint title="管理端設施搜尋" description="可用名稱或位置快速定位設施。" workflow={["輸入設施名稱或位置關鍵字。","從結果中快速進行編輯或刪除。"]} logic={["搜尋只影響顯示，不會修改資料。"]} />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
              <Input
                type="text"
                placeholder="搜尋設施名稱或位置..."
                value={searchTermFacility}
                onChange={(e) => setSearchTermFacility(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={reload} disabled={loading || isPreviewMode}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重新整理
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              新增一筆
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">設施名稱<HelpHint title="設施名稱欄" description="顯示設施名稱。" workflow={["查看設施主名稱。","同名時再對照位置欄辨識。"]} logic={["名稱欄是列表第一識別欄位。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">位置<HelpHint title="設施位置欄" description="顯示設施所在位置。" workflow={["核對場地棟別與樓層。","位置變更時應同步更新。"]} logic={["位置欄影響住戶到場與客服指引。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">基礎點數<HelpHint title="基礎點數欄" description="顯示預約此設施的基本點數。" workflow={["查看設施標準扣點。","調整前先評估使用公平性。"]} logic={["基礎點數決定預約成本門檻。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">冷卻<HelpHint title="冷卻欄" description="顯示同戶再次預約需間隔時數。" workflow={["查看是否設置冷卻間隔。","熱門設施可提高以分散使用。"]} logic={["冷卻欄直接影響同戶重複預約頻率。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">抽籤<HelpHint title="抽籤欄" description="顯示是否啟用熱門時段抽籤機制。" workflow={["查看目前為開啟或關閉。","必要時進編輯切換模式。"]} logic={["抽籤模式改變住戶端預約路徑。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">狀態<HelpHint title="狀態欄" description="顯示設施是否可供預約。" workflow={["查看可用/不可用狀態。","維修中設施應標為不可用。"]} logic={["狀態欄控制是否對住戶開放預約。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">操作<HelpHint title="操作欄" description="可編輯或刪除設施資料。" workflow={["點編輯更新設施規則。","確認不再使用時再刪除。"]} logic={["刪除屬高風險操作，建議先確認是否仍有關聯。"]} align="center" /></span></th>
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
            <HelpHint title="管理端預約紀錄" description="查詢住戶預約、簽到與狀態，支援客服與稽核。" workflow={["先用搜尋定位預約紀錄。","查看簽到時間與狀態處理客服查詢。"]} logic={["預約紀錄是稽核與爭議處理的主要依據。"]} />
          </h2>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--theme-text-primary)] text-sm">搜尋預約</span>
            <HelpHint title="管理端預約搜尋" description="可依設施、預約人、房號或狀態查詢。" workflow={["輸入設施、住戶或狀態關鍵字。","從結果快速查看目標紀錄。"]} logic={["多欄位搜尋可縮短客服查詢時間。"]} />
          </div>
          <input
            type="text"
            placeholder="搜尋設施、預約人、房號或狀態..."
            value={searchTermBooking}
            onChange={(e) => setSearchTermBooking(e.target.value)}
            className="w-full p-3 rounded-xl theme-input outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">設施<HelpHint title="預約設施欄" description="顯示預約的設施名稱。" workflow={["查看住戶預約哪一項設施。"]} logic={["可用於統計設施使用率。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">預約人<HelpHint title="預約人欄" description="顯示住戶姓名與房號。" workflow={["核對住戶姓名與房號。"]} logic={["住戶識別欄位用於客服與責任追蹤。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">日期<HelpHint title="預約日期欄" description="顯示預約日期。" workflow={["確認預約發生日期。"]} logic={["日期是檢查規則與爭議時間點基準。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">時間<HelpHint title="預約時間欄" description="顯示時段範圍。" workflow={["查看開始與結束時間。"]} logic={["時段決定簽到窗口與衝突判定。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">點數<HelpHint title="點數欄" description="顯示此筆預約消耗點數。" workflow={["核對扣點是否符合規則。"]} logic={["點數欄可協助對帳與異常檢核。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">簽到<HelpHint title="簽到欄" description="顯示簽到時間，未簽到則為空。" workflow={["查看是否在有效窗口內簽到。"]} logic={["簽到欄可判斷是否未到場或逾時。"]} align="center" /></span></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap">狀態<HelpHint title="預約狀態欄" description="顯示預約目前狀態。" workflow={["查看已確認/取消/完成等狀態。"]} logic={["狀態是客服與稽核判斷流程節點依據。"]} align="center" /></span></th>
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
