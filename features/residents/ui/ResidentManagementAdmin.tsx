"use client"

import { useState } from "react"
import { useResidents } from "../hooks/useResidents"
import type { Resident } from "../api/residents"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, Search } from "lucide-react"


const getRelationshipLabel = (relationship?: string): string => {
  const labels: Record<string, string> = {
      household_member: "戶長",
      family_member: "家屬",
      tenant: "租客",
  }
  return labels[relationship || "household_member"] || "住戶成員"
}

const getResidentRoleLabel = (role?: string): string => {
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
  isSaving,
}: {
  isOpen: boolean
  onClose: () => void
  resident: Partial<Resident>
  onSave: () => void
  onChange: (field: keyof Resident, value: any) => void
  isEditing: boolean
  isSaving: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">{isEditing ? "編輯住戶資料" : "新增住戶"}<HelpHint title="管理端住戶表單" description="維護住戶基本資料、角色與關係，用於系統權限與通知。" workflow={["先填寫姓名、房號、電話與 Email。","再設定身分與關係，確認權限與戶別正確。","儲存後回到列表確認資料是否更新。"]} logic={["表單資料會影響通知對象與功能權限。","編輯與新增共用同一表單，儲存前需再次核對欄位。"]} /></h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          {/* 姓名 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">姓名<HelpHint title="管理端姓名" description="輸入住戶真實姓名，供查詢與通知使用。" workflow={["輸入住戶可辨識的正式姓名。","確認姓名與房號對應無誤。","儲存後用搜尋測試是否可快速找到。"]} logic={["姓名是通知與查詢主鍵之一。","姓名錯誤會導致聯繫與稽核困難。"]} align="center" /></label>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">位置<HelpHint title="管理端房號/位置" description="建議格式一致，如 A棟 10樓 1001室，方便搜尋。" workflow={["依社區既定格式填寫棟別/樓層/房號。","避免同戶多種寫法造成搜尋分散。","若搬遷或換戶，請同步更新。"]} logic={["房號格式一致可提升篩選與統計準確度。","房號是費用、公告、訪客等多模組關聯欄位。"]} align="center" /></label>
            <input
              type="text"
              value={resident.room || ""}
              onChange={(e) => onChange("room", e.target.value)}
              placeholder="例：A棟 10樓 1001室"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">入坪數</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={resident.ping_size ?? 0}
                onChange={(e) => onChange("ping_size", Number(e.target.value))}
                className="w-full p-3 rounded-xl theme-input outline-none"
              />
            </div>
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">汽車位</label>
              <input
                type="number"
                min="0"
                value={resident.car_spots ?? 0}
                onChange={(e) => onChange("car_spots", Number(e.target.value))}
                className="w-full p-3 rounded-xl theme-input outline-none"
              />
            </div>
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">機車位</label>
              <input
                type="number"
                min="0"
                value={resident.moto_spots ?? 0}
                onChange={(e) => onChange("moto_spots", Number(e.target.value))}
                className="w-full p-3 rounded-xl theme-input outline-none"
              />
            </div>
          </div>

          {/* 電話 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">電話<HelpHint title="管理端電話" description="緊急聯絡或公告通知時使用。" workflow={["輸入可聯絡電話並確認號碼格式。","更新住戶電話後立即儲存。","必要時以搜尋驗證最新聯絡資料。"]} logic={["電話是緊急事件第一聯絡管道。","過期號碼會直接影響通報效率。"]} align="center" /></label>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">Email<HelpHint title="管理端 Email" description="用於帳號通知、重設密碼與重要訊息寄送。" workflow={["輸入可收信的有效 Email。","檢查拼字與網域避免退信。","儲存後可用搜尋快速核對。"]} logic={["Email 影響帳號通知與密碼流程。","錯誤 Email 可能導致使用者無法接收重要訊息。"]} align="center" /></label>
            <input
              type="email"
              value={resident.email || ""}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="請輸入電子郵件"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          {/* 緊急聯絡人姓名 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">緊急聯絡人姓名</label>
            <input
              type="text"
              value={resident.emergency_contact_name || ""}
              onChange={(e) => onChange("emergency_contact_name", e.target.value)}
              placeholder="請輸入緊急聯絡人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          {/* 緊急聯絡人電話 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">緊急聯絡人電話</label>
            <input
              type="tel"
              value={resident.emergency_contact_phone || ""}
              onChange={(e) => onChange("emergency_contact_phone", e.target.value)}
              placeholder="請輸入緊急聯絡人電話"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          {/* 身分 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">身分<HelpHint title="管理端身分" description="決定後台可見功能範圍，請依職責分配。" workflow={["依實際職責選擇住戶/管委會/警衛。","儲存前再次確認是否符合最小權限原則。","角色變更後請通知當事人重新登入驗證。"]} logic={["身分會直接影響功能可見範圍與操作權限。","權限配置過高可能造成管理風險。"]} align="center" /></label>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">關係<HelpHint title="管理端住戶關係" description="區分戶主、成員與租客，便於統計與權責管理。" workflow={["依住戶實際身份選擇戶主/成員/租客。","同戶多位住戶時，確認戶主標記正確。","變更租賃狀態時同步調整關係欄位。"]} logic={["關係欄影響戶別統計與權責判斷。","關係資料正確可降低後續管理爭議。"]} align="center" /></label>
            <select
              value={resident.relationship || "household_member"}
              onChange={(e) => onChange("relationship", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="household_member">戶長</option>
              <option value="family_member">家屬</option>
              <option value="tenant">租客</option>
            </select>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 px-4 py-3 rounded-xl font-semibold bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? "儲存中..." : isEditing ? "儲存變更" : "新增"}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-[var(--theme-border)] last:border-0">
      <span className="text-[var(--theme-text-secondary)] w-28 flex-shrink-0 text-sm">{label}</span>
      <span className="text-[var(--theme-text-primary)] text-sm break-all">{value || "-"}</span>
    </div>
  )
}

function ResidentDetailModal({ resident, onClose }: { resident: Resident; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">
            <span className="material-icons">person</span>
            住戶完整資料
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>
        <div className="p-4 space-y-0">
          <InfoRow label="姓名" value={resident.name} />
          <InfoRow label="房號" value={resident.room} />
          <InfoRow label="電話" value={resident.phone} />
          <InfoRow label="Email" value={resident.email} />
          <InfoRow label="緊急聯絡人" value={resident.emergency_contact_name} />
          <InfoRow label="緊急聯絡電話" value={resident.emergency_contact_phone} />
          <InfoRow label="身分" value={getResidentRoleLabel(resident.role)} />
          <InfoRow label="關係" value={getRelationshipLabel(resident.relationship)} />
          <InfoRow label="坪數" value={resident.ping_size ? `${resident.ping_size} 坪` : undefined} />
          <InfoRow label="汽車位" value={resident.car_spots} />
          <InfoRow label="機車位" value={resident.moto_spots} />
        </div>
        <div className="p-4 border-t border-[var(--theme-border)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}

// 預覽模式的模擬資料
const PREVIEW_RESIDENTS: Resident[] = [
  { id: "preview-1", name: "測試資料", room: "測試資料", phone: "測試資料", email: "測試資料", emergency_contact_name: "測試資料", emergency_contact_phone: "測試資料", relationship: "household_member", role: "resident" as const },
  { id: "preview-2", name: "測試資料", room: "測試資料", phone: "測試資料", email: "測試資料", emergency_contact_name: "測試資料", emergency_contact_phone: "測試資料", relationship: "family_member", role: "resident" as const },
  { id: "preview-3", name: "測試資料", room: "測試資料", phone: "測試資料", email: "測試資料", emergency_contact_name: "測試資料", emergency_contact_phone: "測試資料", relationship: "tenant", role: "committee" as const },
]

interface ResidentManagementAdminProps {
  isPreviewMode?: boolean
}



export function ResidentManagementAdmin({ isPreviewMode = false }: ResidentManagementAdminProps) {
  const { residents: realResidents, loading, addNewRow, updateRow, handleSave, handleDelete, refresh } = useResidents()

  // 預覽模式使用模擬資料
  const residents = isPreviewMode ? PREVIEW_RESIDENTS : realResidents

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<Resident>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [viewingResident, setViewingResident] = useState<Resident | null>(null)

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
      false ||
      resident.emergency_contact_name?.toLowerCase().includes(term) ||
      false ||
      resident.emergency_contact_phone?.toLowerCase().includes(term) ||
      false
    )
  })

  const handleOpenAddModal = () => {
    setFormData({
      name: "",
      room: "",
      ping_size: 0,
      car_spots: 0,
      moto_spots: 0,
      phone: "",
      email: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      role: "resident",
      relationship: "household_member",
    })
    setEditingIndex(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (resident: Resident, index: number) => {
    setFormData({
      ...resident,
      ping_size: resident.ping_size ?? 0,
      car_spots: resident.car_spots ?? 0,
      moto_spots: resident.moto_spots ?? 0,
    })
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingIndex(null)
    setFormData({})
  }

  const handleFormChange = (field: keyof Resident, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFormSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
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
    } finally {
      setIsSaving(false)
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
          <span className="material-icons">people</span>
          住戶/人員管理
          <HelpHint title="管理端住戶管理" description="集中維護住戶與工作人員資料，支援搜尋、編輯與刪除。" workflow={["先用搜尋定位住戶，再決定新增或編輯。","資料更新後檢查角色、關係與聯絡資訊是否一致。","刪除前確認該帳號是否仍在住或仍需保留紀錄。"]} logic={["此模組是帳號與住戶資料主檔，會影響多個功能模組。","建議先編輯再刪除，減少誤刪造成的關聯問題。"]} />
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--theme-text-primary)] text-sm">搜尋住戶資料</span>
            <HelpHint title="管理端住戶搜尋" description="可依姓名、房號、電話或 Email 快速定位。" workflow={["輸入姓名、房號、電話或 Email 任一關鍵字。","從結果清單挑選目標住戶進行操作。","查無結果時清空關鍵字或改用其他欄位搜尋。"]} logic={["搜尋為即時過濾，不會修改資料。","多欄位關鍵字可提升定位效率。"]} align="center" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
            <Input
              placeholder="搜尋姓名、房號、電話或 Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4 mr-2" />
            新增一筆
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--theme-accent-light)]">
              <th className="py-2 px-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">姓名</th>
              <th className="py-2 px-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">房號</th>
              <th className="py-2 px-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">電話</th>
              <th className="py-2 px-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">Email</th>
              <th className="py-2 px-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">身分</th>
              <th className="py-2 px-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">關係</th>
              <th className="py-2 px-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredResidents.length > 0 ? (
              filteredResidents
                .filter((r) => r.id)
                .map((row: Resident, index: number) => (
                  <tr key={row.id || `new-${index}`} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="py-2 px-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-[120px]">
                      <span className="block truncate" title={row.name || "-"}>{row.name || "-"}</span>
                    </td>
                    <td className="py-2 px-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-[140px]">
                      <span className="block truncate" title={row.room || "-"}>{row.room || "-"}</span>
                    </td>
                    <td className="py-2 px-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-[120px]">
                      <span className="block truncate" title={row.phone || "-"}>{row.phone || "-"}</span>
                    </td>
                    <td className="py-2 px-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-[160px]">
                      <span className="block truncate" title={row.email || "-"}>{row.email || "-"}</span>
                    </td>
                    <td className="py-2 px-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] whitespace-nowrap">
                      {getResidentRoleLabel(row.role)}
                    </td>
                    <td className="py-2 px-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] whitespace-nowrap">
                      {getRelationshipLabel(row.relationship)}
                    </td>
                    <td className="py-2 px-3 border-b border-[var(--theme-border)] whitespace-nowrap">
                      <div className="flex gap-1.5 flex-nowrap">
                        <button
                          onClick={() => setViewingResident(row)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="查看詳情"
                        >
                          <span className="material-icons text-lg">visibility</span>
                        </button>
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
        isSaving={isSaving}
      />
      {viewingResident && (
        <ResidentDetailModal
          resident={viewingResident}
          onClose={() => setViewingResident(null)}
        />
      )}
    </div>
  )
}
