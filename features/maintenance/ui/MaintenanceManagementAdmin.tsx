"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface MaintenanceRow {
  id: string | null
  equipment: string
  item: string
  description: string
  reported_by_name: string
  reported_by_id: string | null
  photo_url: string | null
  status: string
  handler: string
  cost: number
  note: string
}

interface MaintenanceFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: MaintenanceRow
  onChange: (field: keyof MaintenanceRow, value: any) => void
  onSave: () => void
  isEditing: boolean
}

function MaintenanceFormModal({ isOpen, onClose, formData, onChange, onSave, isEditing }: MaintenanceFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">
            {isEditing ? "編輯維修紀錄" : "新增維修紀錄"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">設備</label>
            <input
              type="text"
              value={formData.equipment || ""}
              onChange={(e) => onChange("equipment", e.target.value)}
              placeholder="例：電梯、空調"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">項目</label>
            <input
              type="text"
              value={formData.item || ""}
              onChange={(e) => onChange("item", e.target.value)}
              placeholder="例：馬達、面板"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">詳細說明</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="請詳細描述問題狀況"
              rows={3}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">報修人</label>
            <input
              type="text"
              value={formData.reported_by_name || ""}
              onChange={(e) => onChange("reported_by_name", e.target.value)}
              placeholder="報修人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">處理狀態</label>
            <select
              value={formData.status || "open"}
              onChange={(e) => onChange("status", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="open">待處理</option>
              <option value="progress">處理中</option>
              <option value="done">已完成</option>
            </select>
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">處理人</label>
            <input
              type="text"
              value={formData.handler || ""}
              onChange={(e) => onChange("handler", e.target.value)}
              placeholder="處理人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">費用</label>
            <input
              type="number"
              value={formData.cost || 0}
              onChange={(e) => onChange("cost", Number(e.target.value))}
              placeholder="請輸入費用"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">備註</label>
            <textarea
              value={formData.note || ""}
              onChange={(e) => onChange("note", e.target.value)}
              placeholder="請輸入備註"
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

export function MaintenanceManagementAdmin() {
  const [data, setData] = useState<MaintenanceRow[]>([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<MaintenanceRow>({
    id: null,
    equipment: "",
    item: "",
    description: "",
    reported_by_name: "",
    reported_by_id: null,
    photo_url: null,
    status: "open",
    handler: "",
    cost: 0,
    note: "",
  })

  const loadData = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()

    const { data: maintenanceData, error } = await supabase
      .from("maintenance")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading maintenance:", error)
      setData([])
      setLoading(false)
      return
    }

    // 收集所有 reported_by_id 和 handler_id
    const reporterIds = [
      ...new Set((maintenanceData || []).filter((m: any) => m.reported_by_id).map((m: any) => m.reported_by_id)),
    ]
    const handlerIds = [
      ...new Set((maintenanceData || []).filter((m: any) => m.handler_id).map((m: any) => m.handler_id)),
    ]
    const allIds = [...new Set([...reporterIds, ...handlerIds])]

    // 批量查詢 profiles 取得名字
    let profilesMap: Record<string, string> = {}
    if (allIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", allIds)

      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.name || "未知"]))
      }
    }

    setData(
      (maintenanceData || []).map((row: any) => ({
        id: row.id,
        equipment: row.equipment || "",
        item: row.item || "",
        description: row.description || "",
        reported_by_name: row.reported_by_name || (row.reported_by_id ? profilesMap[row.reported_by_id] : "") || "",
        reported_by_id: row.reported_by_id || null,
        photo_url: row.photo_url || row.image_url || null,
        status: row.status || "open",
        handler: row.handler_id ? profilesMap[row.handler_id] || "" : "",
        cost: row.cost || 0,
        note: row.note || "",
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = () => {
    setFormData({
      id: null,
      equipment: "",
      item: "",
      description: "",
      reported_by_name: "",
      reported_by_id: null,
      photo_url: null,
      status: "open",
      handler: "",
      cost: 0,
      note: "",
    })
    setEditingIndex(null)
    setIsModalOpen(true)
  }

  const handleEdit = (index: number) => {
    setFormData({ ...data[index] })
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof MaintenanceRow, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      const supabase = getSupabaseClient()
      const saveData = {
        equipment: formData.equipment,
        item: formData.item,
        description: formData.description,
        reported_by_name: formData.reported_by_name,
        reported_by_id: formData.reported_by_id,
        status: formData.status,
        cost: formData.cost,
        note: formData.handler ? `處理人：${formData.handler}` : formData.note,
      }

      if (formData.id) {
        const { error } = await supabase.from("maintenance").update(saveData).eq("id", formData.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("maintenance").insert([saveData])
        if (error) throw error
      }

      alert("儲存成功！")
      setIsModalOpen(false)
      await loadData()
    } catch (e: any) {
      console.error(e)
      alert("儲存失敗：" + e.message)
    }
  }

  const handleDelete = async (id: string | null) => {
    if (!id) return
    if (!confirm("確定要刪除此維修紀錄？")) return

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from("maintenance").delete().eq("id", id)
      if (error) throw error

      alert("刪除成功！")
      await loadData()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { text: string; class: string }> = {
      open: { text: "待處理", class: "bg-yellow-500/20 text-yellow-500" },
      progress: { text: "處理中", class: "bg-blue-500/20 text-blue-500" },
      done: { text: "已完成", class: "bg-green-500/20 text-green-500" },
    }
    return labels[status] || labels.open
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
          <span className="material-icons">build</span>
          設備/維護管理
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
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">設備</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">項目</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">描述</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">報修人</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">處理人</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">費用</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">備註</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((row, index) => {
                const statusInfo = getStatusLabel(row.status)
                return (
                  <tr key={row.id || `new-${index}`} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.equipment || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.item || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-xs truncate">
                      {row.description || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.reported_by_name || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusInfo.class}`}>
                        {statusInfo.text}
                      </span>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.handler || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      ${row.cost?.toLocaleString() || 0}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      {row.note || "-"}
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
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                          title="刪除"
                        >
                          <span className="material-icons text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={9} className="p-8 text-center text-[var(--theme-text-secondary)]">
                  目前沒有維修紀錄
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MaintenanceFormModal
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
