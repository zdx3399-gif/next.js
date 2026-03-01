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
    vendor: "警衛",
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
              <option value="vendor">警衛</option>
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
  const { residents: realResidents, loading, addNewRow, updateRow, handleSave, handleDelete, refresh } = useResidents()

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
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]"><span className="inline-flex items-center gap-1">姓名<HelpHint title="管理端姓名欄" description="顯示住戶或人員姓名。" workflow={["先看姓名辨識目標住戶。","再對照房號避免同名誤操作。"]} logic={["姓名是列表主要識別欄位。"]} align="center" /></span></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]"><span className="inline-flex items-center gap-1">房號<HelpHint title="管理端房號欄" description="顯示住戶所屬房號或位置。" workflow={["以房號快速判斷住戶所屬戶別。","操作前先核對姓名與房號組合。"]} logic={["房號是戶別管理與費用關聯關鍵欄位。"]} align="center" /></span></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]"><span className="inline-flex items-center gap-1">電話<HelpHint title="管理端電話欄" description="顯示聯絡電話，供通知或聯繫使用。" workflow={["需要聯絡時先檢查電話欄最新值。","若號碼失效，立即進入編輯更新。"]} logic={["電話欄直接影響緊急聯繫品質。"]} align="center" /></span></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]"><span className="inline-flex items-center gap-1">Email<HelpHint title="管理端 Email 欄" description="顯示電子郵件，供帳號通知使用。" workflow={["檢查 Email 是否完整可用。","通知退信時優先回來修正此欄。"]} logic={["Email 影響帳號通知與重設流程。"]} align="center" /></span></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]"><span className="inline-flex items-center gap-1">身分<HelpHint title="管理端身分欄" description="顯示該帳號在系統中的角色。" workflow={["先檢查角色是否符合職責。","需要調整權限時進入編輯修改。"]} logic={["角色會決定後台可見功能範圍。"]} align="center" /></span></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]"><span className="inline-flex items-center gap-1">關係<HelpHint title="管理端關係欄" description="顯示與該戶的關係類型。" workflow={["核對戶主/成員/租客是否正確。","異動時同步修正，維持戶別資料正確。"]} logic={["關係欄影響住戶統計與管理決策。"]} align="center" /></span></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]"><span className="inline-flex items-center gap-1">操作<HelpHint title="管理端操作" description="可編輯或刪除資料，刪除前請先確認是否仍在住。" workflow={["點編輯更新欄位資料。","確認不再使用時再執行刪除。","操作後回列表確認結果。"]} logic={["刪除屬高風險操作，建議先確認關聯資料影響。"]} align="center" /></span></th>
            </tr>
          </thead>
          <tbody>
            {filteredResidents.length > 0 ? (
              filteredResidents
                .filter((r) => r.id)
                .map((row: Resident, index: number) => (
                  <tr key={row.id || `new-${index}`} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] break-words">
                      {row.name || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] break-words">
                      {row.room || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] break-words">
                      {row.phone || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] break-all">
                      {row.email || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] break-words">
                      {getRoleLabel(row.role)}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] break-words">
                      {getRelationshipLabel(row.relationship)}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] whitespace-nowrap">
                      <div className="flex gap-2 flex-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(row, index)}
                          className="p-1.5 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="編輯"
                        >
                          <span className="material-icons text-base">edit</span>
                        </button>
                        {row.id && (
                          <button
                            onClick={() => handleDelete(row.id!)}
                            className="p-1.5 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                            title="刪除"
                          >
                            <span className="material-icons text-base">delete</span>
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
