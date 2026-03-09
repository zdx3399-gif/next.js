"use client"

import { useState, useEffect } from "react"
import { usePackages } from "../hooks/usePackages"
import { fetchResidentsByRoom } from "@/features/residents/api/residents"
import type { Package } from "../api/packages"
import type { Resident } from "@/features/residents/api/residents"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, Search } from "lucide-react"

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
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">
            新增包裹
            <HelpHint
              title="管理端新增包裹"
              description="建立新到貨包裹資料。資料越完整，住戶查詢與後續領取確認會更順利。"
              workflow={[
                "填寫快遞公司、收件人與房號等必要欄位。",
                "可補追蹤號與到達時間提高可追溯性。",
                "儲存後到待領取區確認資料已建立。",
              ]}
              logic={[
                "新增資料會直接進入待領取流程，供管理端後續交付。",
              ]}
            />
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">快遞公司 *</label>
              <HelpHint
                title="管理端快遞公司"
                description="填寫物流來源（例如黑貓、郵局）。有助於住戶辨識包裹來源與後續客服查詢。"
                workflow={[
                  "輸入實際物流或快遞公司名稱。",
                  "避免縮寫不一致造成搜尋困難。",
                  "儲存前確認與包裹單一致。",
                ]}
                logic={[
                  "快遞公司欄位是查詢與客服追蹤的重要索引。",
                ]}
              />
            </div>
            <input
              type="text"
              value={formData.courier || ""}
              onChange={(e) => onChange("courier", e.target.value)}
              placeholder="例如：UPS、郵局、黑貓"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">收件人 *</label>
              <HelpHint
                title="管理端收件人"
                description="請填寫包裹上的收件姓名，避免通知到錯誤住戶。"
                workflow={[
                  "依包裹面單輸入收件姓名。",
                  "與房號交叉檢查避免誤登記。",
                  "若姓名不明可先向住戶確認。",
                ]}
                logic={[
                  "收件人欄位影響通知與交付準確性。",
                ]}
              />
            </div>
            <input
              type="text"
              value={formData.recipient_name || ""}
              onChange={(e) => onChange("recipient_name", e.target.value)}
              placeholder="收件人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">房號 *</label>
              <HelpHint
                title="管理端房號"
                description="請輸入住戶對應房號，系統會依房號協助帶出可選領取人名單。"
                workflow={[
                  "填寫住戶正確房號。",
                  "儲存後在待領取區確認可帶出住戶名單。",
                  "若名單不符先檢查房號格式。",
                ]}
                logic={[
                  "房號是領取人名單與包裹歸屬的關聯鍵。",
                ]}
              />
            </div>
            <input
              type="text"
              value={formData.recipient_room || ""}
              onChange={(e) => onChange("recipient_room", e.target.value)}
              placeholder="例：A棟 10樓 1001室"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">追蹤號碼</label>
              <HelpHint
                title="管理端追蹤號碼"
                description="可選填。若後續有爭議或延遲，追蹤號可作為物流查核依據。"
                workflow={[
                  "有追蹤號時建議一併填寫。",
                  "保留完整格式避免查詢失敗。",
                  "爭議處理時可直接用此欄追查。",
                ]}
                logic={[
                  "追蹤號雖為選填，但可大幅提升異常處理效率。",
                ]}
              />
            </div>
            <input
              type="text"
              value={formData.tracking_number || ""}
              onChange={(e) => onChange("tracking_number", e.target.value)}
              placeholder="選填"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">到達時間</label>
              <HelpHint
                title="管理端到達時間"
                description="記錄包裹實際到件時間，可用於管理逾期未領與對帳。"
                workflow={[
                  "設定包裹實際到件日期時間。",
                  "與收件記錄或物流資訊對照確認。",
                  "必要時用於逾期未領追蹤。",
                ]}
                logic={[
                  "到達時間是待領期管理與稽核依據。",
                ]}
              />
            </div>
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
    { id: "preview-1", courier: "測試資料", recipient_name: "測試資料", recipient_room: "測試資料", tracking_number: "測試資料", arrived_at: new Date().toISOString(), status: "pending" as const },
    { id: "preview-2", courier: "測試資料", recipient_name: "測試資料", recipient_room: "測試資料", tracking_number: "測試資料", arrived_at: new Date().toISOString(), status: "pending" as const },
  ],
  pickedUp: [
    { id: "preview-3", courier: "測試資料", recipient_name: "測試資料", recipient_room: "測試資料", tracking_number: "測試資料", arrived_at: new Date(Date.now() - 86400000).toISOString(), picked_up_at: new Date().toISOString(), picked_up_by: "測試資料", status: "picked_up" as const },
  ],
}

export function PackageManagementAdmin({ currentUser, isPreviewMode = false }: PackageManagementAdminProps) {
  const { pendingPackages: realPending, pickedUpPackages: realPickedUp, loading, handleAddPackage, handleMarkAsPickedUp, reload } = usePackages({
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
          <HelpHint
            title="管理端包裹管理"
            description="用於建立到件資料、指派領取人、標記已領並保留歷史紀錄，支援管理端完整包裹流程。"
            workflow={[
              "先新增到件包裹資料。",
              "在待領取區選擇實際領取人並標記已領。",
              "到已領取區回查交付紀錄。",
            ]}
            logic={[
              "流程為 pending → picked_up，重點在交付可追溯性。",
            ]}
          />
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--theme-text-primary)] text-sm">搜尋</span>
            <HelpHint
              title="管理端搜尋"
              description="可用快遞商、收件人或追蹤號快速篩選資料，方便在大量包裹中定位目標。"
              workflow={[
                "輸入快遞商、收件人或追蹤號關鍵字。",
                "確認待領取/已領取清單同步過濾。",
                "查無結果時清空關鍵字恢復完整資料。",
              ]}
              logic={[
                "搜尋僅影響畫面顯示，不會變更包裹狀態。",
              ]}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
            <Input
              placeholder="搜尋快遞商、收件人或追蹤號碼..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={reload} disabled={loading || isPreviewMode}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新增一筆
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* 待領取 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-yellow-500/30 rounded-xl p-4">
          <h3 className="flex gap-2 items-center text-yellow-500 font-bold text-lg mb-4">
            <span className="material-icons">schedule</span>
            待領取 ({filteredPending.length})
            <HelpHint
              title="管理端待領取"
              description="顯示尚未完成交付的包裹。管理員需確認領取人身份後再標記已領。"
              workflow={[
                "先核對包裹資訊與房號。",
                "選擇實際領取人後點標記已領。",
                "交付完成後至已領取區確認紀錄。",
              ]}
              logic={[
                "此區僅顯示 pending 狀態，包含可操作交付按鈕。",
              ]}
            />
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
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[var(--theme-accent)] text-sm font-bold block">領取人</label>
                          <HelpHint
                            title="管理端領取人選擇"
                            description="請從同房號住戶中選擇實際領取人，確保紀錄可追蹤。"
                            workflow={[
                              "從下拉選單選擇同房號住戶。",
                              "確認姓名與關係後再標記已領。",
                              "若無對應住戶請先確認房號資料。",
                            ]}
                            logic={[
                              "未選領取人不可標記已領，避免交付紀錄失真。",
                            ]}
                            align="center"
                          />
                        </div>
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
            <HelpHint
              title="管理端已領取紀錄"
              description="保留完成交付的包裹紀錄，可回查領取人與領取時間，供客服與稽核使用。"
              workflow={[
                "在此區回查已交付包裹。",
                "核對領取人與領取時間資訊。",
                "客服或稽核需求時可依紀錄追溯。",
              ]}
              logic={[
                "此區為歷史查閱用途，不提供交付操作。",
              ]}
            />
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
