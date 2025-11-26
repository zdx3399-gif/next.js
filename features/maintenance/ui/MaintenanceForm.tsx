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
    <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
        <span className="material-icons">build</span>
        提交維修申請
      </h2>
      <form onSubmit={onFormSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-white mb-2">維修類型</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] [&>option]:bg-[#2a2a2a] [&>option]:text-white [&>option]:py-2"
          >
            <option value="水電" className="bg-[#2a2a2a] text-white">
              水電
            </option>
            <option value="門窗" className="bg-[#2a2a2a] text-white">
              門窗
            </option>
            <option value="公共設施" className="bg-[#2a2a2a] text-white">
              公共設施
            </option>
            <option value="其他" className="bg-[#2a2a2a] text-white">
              其他
            </option>
          </select>
        </div>
        <div>
          <label className="block text-white mb-2">位置</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
            placeholder="例如：A棟3樓、中庭"
            required
          />
        </div>
        <div>
          <label className="block text-white mb-2">問題描述</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] min-h-[100px]"
            placeholder="請詳細描述問題"
            required
          />
        </div>
        <div>
          <label className="block text-white mb-2">上傳照片（選填）</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })}
            className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
          />
          {form.image && <div className="text-green-400 text-sm mt-2">已選擇: {form.image.name}</div>}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all disabled:opacity-50"
        >
          {submitting ? "提交中..." : "提交申請"}
        </button>
      </form>
    </div>
  )
}
