"use client"

import { useState, useEffect } from "react"
import { usePackages } from "../hooks/usePackages"
import { fetchResidentsByRoom } from "@/features/residents/api/residents"
import type { Package } from "../api/packages"
import type { Resident } from "@/features/residents/api/residents"

interface PackageManagementAdminProps {
  currentUser?: any
  isPreviewMode?: boolean
}

interface NewPackage {
  courier: string
  recipient_name: string
  recipient_room: string
  tracking_number: string
  arrived_at: string
}

interface PackageFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: NewPackage
  onChange: (field: keyof NewPackage, value: string) => void
  onSave: () => void
}

function PackageFormModal({ isOpen, onClose, formData, onChange, onSave }: PackageFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">新增包裹</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">快遞公司 *</label>
            <input
              type="text"
              value={formData.courier || ""}
              onChange={(e) => onChange("courier", e.target.value)}
              placeholder="例如：UPS、郵局、黑貓"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">收件人 *</label>
            <input
              type="text"
              value={formData.recipient_name || ""}
              onChange={(e) => onChange("recipient_name", e.target.value)}
              placeholder="收件人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">房號 *</label>
            <input
              type="text"
              value={formData.recipient_room || ""}
              onChange={(e) => onChange("recipient_room", e.target.value)}
              placeholder="例：A棟 10樓 1001室"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">追蹤號碼</label>
            <input
              type="text"
              value={formData.tracking_number || ""}
              onChange={(e) => onChange("tracking_number", e.target.value)}
              placeholder="選填"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">到達時間</label>
            <input
              type="datetime-local"
              value={formData.arrived_at || ""}
              onChange={(e) => onChange("arrived_at", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
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
            新增
          </button>
        </div>
      </div>
    </div>
  )
}

const getRelationshipLabel = (relationship?: string): string => {
  const labels: Record<string, string> = {
    owner: "戶主",
    household_member: "住戶成員",
    tenant: "租客",
  }
  return labels[relationship || "household_member"] || "住戶成員"
}

// 預覽模式的模擬資料
const PREVIEW_PACKAGES: { pending: Package[]; pickedUp: Package[] } = {
  pending: [
    { id: "preview-1", courier: "黑貓宅急便", recipient_name: "王**", recipient_room: "A棟 5樓 501室", tracking_number: "TW***123", arrived_at: new Date().toISOString(), status: "pending" as const },
    { id: "preview-2", courier: "郵局", recipient_name: "李**", recipient_room: "B棟 3樓 302室", tracking_number: "PO***456", arrived_at: new Date().toISOString(), status: "pending" as const },
  ],
  pickedUp: [
    { id: "preview-3", courier: "UPS", recipient_name: "張**", recipient_room: "A棟 8樓 801室", tracking_number: "UP***789", arrived_at: new Date(Date.now() - 86400000).toISOString(), picked_up_at: new Date().toISOString(), picked_up_by: "張**", status: "picked_up" as const },
  ],
}

export function PackageManagementAdmin({ currentUser, isPreviewMode = false }: PackageManagementAdminProps) {
  const { pendingPackages: realPending, pickedUpPackages: realPickedUp, loading, handleAddPackage, handleMarkAsPickedUp } = usePackages({
    isAdmin: true,
  })

  // 預覽模式使用模擬資料
  const pendingPackages = isPreviewMode ? PREVIEW_PACKAGES.pending : realPending
  const pickedUpPackages = isPreviewMode ? PREVIEW_PACKAGES.pickedUp : realPickedUp
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPickers, setSelectedPickers] = useState<{ [key: string]: Resident | null }>({})
  const [roomResidents, setRoomResidents] = useState<{ [room: string]: Resident[] }>({})

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newPackage, setNewPackage] = useState<NewPackage>({
    courier: "",
    recipient_name: "",
    recipient_room: "",
    tracking_number: "",
    arrived_at: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    pendingPackages.forEach((pkg) => {
      loadRoomResidents(pkg.recipient_room)
    })
  }, [pendingPackages])

  const filterPackages = (pkgs: Package[]) => {
    if (!searchTerm) return pkgs
    const term = searchTerm.toLowerCase()
    return pkgs.filter(
      (pkg) =>
        pkg.courier.toLowerCase().includes(term) ||
        (pkg.recipient_name || "").toLowerCase().includes(term) ||
        pkg.tracking_number?.toLowerCase().includes(term),
    )
  }

  const filteredPending = filterPackages(pendingPackages)
  const filteredPickedUp = filterPackages(pickedUpPackages)

  const loadRoomResidents = async (room: string) => {
    if (!room || roomResidents[room]) return
    const residents = await fetchResidentsByRoom(room)
    setRoomResidents((prev) => ({
      ...prev,
      [room]: residents,
    }))
  }

  const onMarkAsPickedUp = async (packageId: string) => {
    const selectedResident = selectedPickers[packageId]
    if (!selectedResident || !selectedResident.name) {
      alert("請選擇領取人")
      return
    }

    const success = await handleMarkAsPickedUp(packageId, selectedResident.name)
    if (success) {
      setSelectedPickers((prev) => {
        const newState = { ...prev }
        delete newState[packageId]
        return newState
      })
      alert("包裹已標記為已領取")
    } else {
      alert("標記失敗")
    }
  }

  const handleFormChange = (field: keyof NewPackage, value: string) => {
    setNewPackage((prev) => ({ ...prev, [field]: value }))
  }

  const onAddPackage = async () => {
    if (!newPackage.courier || !newPackage.recipient_name || !newPackage.recipient_room) {
      alert("請填寫快遞公司、收件人和房號")
      return
    }

    const success = await handleAddPackage(newPackage)
    if (success) {
      alert("包裹新增成功")
      setIsModalOpen(false)
      setNewPackage({
        courier: "",
        recipient_name: "",
        recipient_room: "",
        tracking_number: "",
        arrived_at: new Date().toISOString().slice(0, 16),
      })
    } else {
      alert("新增失敗")
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
          <span className="material-icons">inventory_2</span>
          包裹管理
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--theme-btn-add-border)] text-[var(--theme-btn-add-text)] bg-transparent hover:bg-[var(--theme-btn-add-hover)] transition-all"
        >
          <span className="material-icons text-sm">add</span>
          新增一筆
        </button>
      </div>

      <input
        type="text"
        placeholder="搜尋快遞商、收件人或追蹤號碼..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-3 rounded-xl theme-input outline-none mb-4"
      />

      <div className="space-y-6">
        {/* 待領取 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-yellow-500/30 rounded-xl p-4">
          <h3 className="flex gap-2 items-center text-yellow-500 font-bold text-lg mb-4">
            <span className="material-icons">schedule</span>
            待領取 ({filteredPending.length})
          </h3>
          <div className="space-y-3">
            {filteredPending.length > 0 ? (
              filteredPending.map((pkg) => {
                const residents = roomResidents[pkg.recipient_room] || []
                const selectedResident = selectedPickers[pkg.id]

                return (
                  <div
                    key={pkg.id}
                    className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-[var(--theme-text-primary)] font-bold text-lg">{pkg.courier}</div>
                        <div className="text-[var(--theme-text-secondary)] text-sm mt-1">
                          收件人: {pkg.recipient_name}
                        </div>
                        <div className="text-[var(--theme-text-secondary)] text-sm">房號: {pkg.recipient_room}</div>
                        {pkg.tracking_number && (
                          <div className="text-[var(--theme-text-secondary)] text-sm">
                            追蹤號:{" "}
                            <code className="bg-black/10 dark:bg-black/30 px-2 py-1 rounded">
                              {pkg.tracking_number}
                            </code>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-yellow-500/20 text-yellow-500">
                        待領取
                      </div>
                    </div>
                    <div className="text-[var(--theme-text-secondary)] text-sm mb-3">
                      到達: {new Date(pkg.arrived_at).toLocaleString("zh-TW")}
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-[var(--theme-accent)] text-sm font-bold mb-1 block">領取人</label>
                        <select
                          value={selectedResident?.id || ""}
                          onChange={(e) => {
                            const resident = residents.find((r) => r.id === e.target.value)
                            setSelectedPickers((prev) => ({
                              ...prev,
                              [pkg.id]: resident || null,
                            }))
                          }}
                          className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
                        >
                          <option value="">-- 選擇領取人 --</option>
                          {residents.map((resident) => (
                            <option key={resident.id} value={resident.id}>
                              {resident.name} ({getRelationshipLabel(resident.relationship)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => onMarkAsPickedUp(pkg.id)}
                        disabled={!selectedResident}
                        className="px-4 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        標記已領
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的待領取包裹" : "沒有待領取的包裹"}
              </div>
            )}
          </div>
        </div>

        {/* 已領取 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-green-500/30 rounded-xl p-4">
          <h3 className="flex gap-2 items-center text-green-500 font-bold text-lg mb-4">
            <span className="material-icons">check_circle</span>
            已領取 ({filteredPickedUp.length})
          </h3>
          <div className="space-y-3">
            {filteredPickedUp.length > 0 ? (
              filteredPickedUp.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all opacity-75"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-[var(--theme-text-primary)] font-bold text-lg">{pkg.courier}</div>
                      <div className="text-[var(--theme-text-secondary)] text-sm mt-1">
                        收件人: {pkg.recipient_name}
                      </div>
                      <div className="text-[var(--theme-text-secondary)] text-sm">房號: {pkg.recipient_room}</div>
                      {pkg.tracking_number && (
                        <div className="text-[var(--theme-text-secondary)] text-sm">
                          追蹤號:{" "}
                          <code className="bg-black/10 dark:bg-black/30 px-2 py-1 rounded">{pkg.tracking_number}</code>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-green-500/20 text-green-500">
                      已領取
                    </div>
                  </div>
                  <div className="text-[var(--theme-text-secondary)] text-sm space-y-1">
                    <div>到達: {new Date(pkg.arrived_at).toLocaleString("zh-TW")}</div>
                    {pkg.picked_up_by && <div className="text-green-500 font-bold">領取人: {pkg.picked_up_by}</div>}
                    {pkg.picked_up_at && (
                      <div className="text-green-500">
                        領取時間: {new Date(pkg.picked_up_at).toLocaleString("zh-TW")}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的已領取包裹" : "沒有已領取的包裹"}
              </div>
            )}
          </div>
        </div>
      </div>

      <PackageFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={newPackage}
        onChange={handleFormChange}
        onSave={onAddPackage}
      />
    </div>
  )
}
