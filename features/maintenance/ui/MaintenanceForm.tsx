"use client"

import type React from "react"

import { useState } from "react"
import { useMaintenance } from "../hooks/useMaintenance"
import type { MaintenanceFormData } from "../api/maintenance"

interface MaintenanceFormProps {
  userId?: string
  userName?: string
  onSuccess?: () => void
}

export function MaintenanceForm({ userId, userName, onSuccess }: MaintenanceFormProps) {
  const { handleSubmit } = useMaintenance(userId, true)
  const [form, setForm] = useState<MaintenanceFormData>({
    type: "水電",
    location: "",
    description: "",
    image: null,
  })
  const [submitting, setSubmitting] = useState(false)

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId) {
      alert("錯誤：用戶資訊不完整，請重新登入")
      return
    }

    setSubmitting(true)
    const result = await handleSubmit(form, userName || "未知")
    setSubmitting(false)

    if (result.success) {
      alert("維修申請已提交！")
      setForm({
        type: "水電",
        location: "",
        description: "",
        image: null,
      })
      onSuccess?.()
    } else {
      alert(`提交失敗：${result.error}\n\n請確認：\n1. 已設定環境變數\n2. 已正確登入\n3. 資料庫連接正常`)
    }
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
        <span className="material-icons">build</span>
        提交維修申請
      </h2>
      <form onSubmit={onFormSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">維修類型</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="theme-select w-full p-3 rounded-lg"
          >
            <option value="水電">水電</option>
            <option value="門窗">門窗</option>
            <option value="公共設施">公共設施</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">位置</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="theme-input w-full p-3 rounded-lg"
            placeholder="例如：A棟3樓、中庭"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">問題描述</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="theme-input w-full p-3 rounded-lg min-h-[100px]"
            placeholder="請詳細描述問題"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">上傳照片（選填）</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })}
            className="theme-input w-full p-3 rounded-lg"
          />
          {form.image && <div className="text-green-500 text-sm mt-2">已選擇: {form.image.name}</div>}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50"
        >
          {submitting ? "提交中..." : "提交申請"}
        </button>
      </form>
    </div>
  )
}
