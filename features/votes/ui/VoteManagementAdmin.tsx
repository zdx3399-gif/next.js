"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface Vote {
  id: string | null
  title: string
  description: string
  options: string
  author: string
  status: string
  ends_at: string
}

interface VoteManagementAdminProps {
  currentUserName?: string
}

interface VoteFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: Vote
  onChange: (field: keyof Vote, value: string) => void
  onSave: () => void
  isEditing: boolean
}

function VoteFormModal({ isOpen, onClose, formData, onChange, onSave, isEditing }: VoteFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">{isEditing ? "編輯投票" : "新增投票"}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">投票標題</label>
            <input
              type="text"
              value={formData.title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="請輸入投票標題"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">詳細說明</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="請詳細描述投票內容"
              rows={3}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">選項 (JSON格式)</label>
            <textarea
              value={formData.options || ""}
              onChange={(e) => onChange("options", e.target.value)}
              placeholder='例：["同意","反對","棄權"]'
              rows={2}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">發起人</label>
            <input
              type="text"
              value={formData.author || ""}
              onChange={(e) => onChange("author", e.target.value)}
              placeholder="發起人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">截止日期</label>
            <input
              type="date"
              value={formData.ends_at ? formData.ends_at.split("T")[0] : ""}
              onChange={(e) => onChange("ends_at", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">狀態</label>
            <select
              value={formData.status || "active"}
              onChange={(e) => onChange("status", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="active">進行中</option>
              <option value="closed">已結束</option>
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

export function VoteManagementAdmin({ currentUserName }: VoteManagementAdminProps) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<Vote>({
    id: null,
    title: "",
    description: "",
    options: '["同意","反對","棄權"]',
    author: currentUserName || "",
    status: "active",
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  })

  const loadVotes = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from("votes").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading votes:", error)
    } else {
      setVotes(
        (data || []).map((v) => ({
          ...v,
          options: typeof v.options === "string" ? v.options : JSON.stringify(v.options),
        })),
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    loadVotes()
  }, [])

  const handleAdd = () => {
    setFormData({
      id: null,
      title: "",
      description: "",
      options: '["同意","反對","棄權"]',
      author: currentUserName || "",
      status: "active",
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    })
    setEditingIndex(null)
    setIsModalOpen(true)
  }

  const handleEdit = (index: number) => {
    setFormData({ ...votes[index] })
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof Vote, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      const supabase = getSupabaseClient()
      let parsedOptions
      try {
        parsedOptions = JSON.parse(formData.options)
      } catch {
        parsedOptions = formData.options.split(",").map((s) => s.trim())
      }

      const voteData = {
        title: formData.title,
        description: formData.description,
        options: parsedOptions,
        author: formData.author,
        status: formData.status,
        ends_at: formData.ends_at,
      }

      if (formData.id) {
        const { error } = await supabase.from("votes").update(voteData).eq("id", formData.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("votes").insert([voteData])
        if (error) throw error
      }

      alert("儲存成功！")
      setIsModalOpen(false)
      await loadVotes()
    } catch (e: any) {
      console.error(e)
      alert("儲存失敗：" + e.message)
    }
  }

  const handleDelete = async (id: string | null) => {
    if (!id) return
    if (!confirm("確定要刪除此投票？")) return

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from("votes").delete().eq("id", id)
      if (error) throw error

      alert("刪除成功！")
      await loadVotes()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
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
          <span className="material-icons">how_to_vote</span>
          投票管理
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
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">標題</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">說明</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">選項</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">發起人</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                截止日期
              </th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {votes.length > 0 ? (
              votes.map((vote, index) => (
                <tr key={vote.id || `new-${index}`} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {vote.title || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] max-w-xs truncate">
                    {vote.description || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    <code className="text-xs bg-black/10 dark:bg-black/30 px-2 py-1 rounded">{vote.options}</code>
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {vote.author || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {vote.ends_at ? new Date(vote.ends_at).toLocaleDateString("zh-TW") : "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)]">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${vote.status === "active" ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"}`}
                    >
                      {vote.status === "active" ? "進行中" : "已結束"}
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
                      <button
                        onClick={() => handleDelete(vote.id)}
                        className="p-2 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                        title="刪除"
                      >
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[var(--theme-text-secondary)]">
                  目前沒有投票
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <VoteFormModal
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
