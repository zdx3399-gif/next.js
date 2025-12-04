"use client"

import { useState } from "react"
import { useFinanceAdmin } from "../hooks/useFinance"

interface FinanceRecord {
  id?: string
  room: string
  amount: number
  due: string
  invoice: string
  paid: boolean
}

interface FinanceFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: FinanceRecord
  onChange: (field: keyof FinanceRecord, value: string | number | boolean) => void
  onSave: () => void
  isEditing: boolean
}

function FinanceFormModal({ isOpen, onClose, formData, onChange, onSave, isEditing }: FinanceFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">
            {isEditing ? "編輯財務記錄" : "新增財務記錄"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">房號</label>
            <input
              type="text"
              value={formData.room || ""}
              onChange={(e) => onChange("room", e.target.value)}
              placeholder="例：A棟 10樓 1001室"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">金額</label>
            <input
              type="number"
              value={formData.amount || 0}
              onChange={(e) => onChange("amount", Number(e.target.value))}
              placeholder="請輸入金額"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">到期日</label>
            <input
              type="date"
              value={formData.due ? formData.due.split("T")[0] : ""}
              onChange={(e) => onChange("due", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">發票</label>
            <input
              type="text"
              value={formData.invoice || ""}
              onChange={(e) => onChange("invoice", e.target.value)}
              placeholder="請輸入發票號碼"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">繳費狀態</label>
            <select
              value={String(formData.paid)}
              onChange={(e) => onChange("paid", e.target.value === "true")}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="true">已繳</option>
              <option value="false">未繳</option>
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

export function FinanceManagementAdmin() {
  const { records, loading, updateRow, addRow, saveRecord, removeRecord } = useFinanceAdmin()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<FinanceRecord>({
    room: "",
    amount: 0,
    due: "",
    invoice: "",
    paid: false,
  })

  const handleAdd = () => {
    setFormData({ room: "", amount: 0, due: "", invoice: "", paid: false })
    setEditingIndex(null)
    setIsModalOpen(true)
  }

  const handleEdit = (index: number) => {
    const record = records[index]
    setFormData({
      id: record.id,
      room: record.room || "",
      amount: record.amount || 0,
      due: record.due || "",
      invoice: record.invoice || "",
      paid: record.paid || false,
    })
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof FinanceRecord, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (editingIndex !== null) {
      const keys = Object.keys(formData) as Array<keyof FinanceRecord>
      keys.forEach((key) => {
        if (formData[key] !== undefined) {
          updateRow(editingIndex, key as any, formData[key] as any)
        }
      })
      await saveRecord(records[editingIndex], editingIndex)
    } else {
      addRow()
      const newIndex = 0
      const keys = Object.keys(formData) as Array<keyof FinanceRecord>
      keys.forEach((key) => {
        if (formData[key] !== undefined) {
          updateRow(newIndex, key as any, formData[key] as any)
        }
      })
      await saveRecord({ ...formData, id: undefined } as any, newIndex)
    }
    setIsModalOpen(false)
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
          <span className="material-icons">account_balance</span>
          管理費/收支管理
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
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">房號</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">金額</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">到期日</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">發票</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">已繳</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((row, index) => (
                <tr key={row.id || `new-${index}`} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {row.room || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    ${row.amount?.toLocaleString() || 0}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {row.due ? new Date(row.due).toLocaleDateString("zh-TW") : "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {row.invoice || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)]">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${row.paid ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}
                    >
                      {row.paid ? "已繳" : "未繳"}
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
                      {row.id && (
                        <button
                          onClick={() => removeRecord(row.id)}
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
                  目前沒有財務記錄
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FinanceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onChange={handleFormChange}
        onSave={handleSave}
        isEditing={editingIndex !== null}
      />
    </div>
  )
}
