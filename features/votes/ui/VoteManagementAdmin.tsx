"use client"

import { useState } from "react"
import type { User } from "@/features/profile/api/profile"

interface VoteManagementAdminProps {
  currentUser?: User | null // Made optional to prevent strict type errors if parent doesn't pass it
}

export function VoteManagementAdmin({ currentUser }: VoteManagementAdminProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    endDate: "",
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.endDate) {
      alert("請填寫標題與截止日期")
      return
    }

    setLoading(true)

    try {
      // 呼叫後端 API (對應你上傳的 route-votes.js)
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          ends_at: formData.endDate,
          author: currentUser?.name || "管委會",
          options: ['同意', '反對', '棄權'], // 目前固定三個選項
          test: false // 設定 false 代表真的會推播 LINE
        }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || '發起失敗')
      }

      alert('✅ 投票已建立並推播至 LINE')
      setFormData({ title: "", description: "", endDate: "" })

    } catch (error: any) {
      console.error(error)
      alert(`❌ 錯誤: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-6 min-h-[500px]">
      <div className="flex justify-between items-center mb-8">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold">
          <span className="material-icons">how_to_vote</span>
          發起新投票 (LINE Bot)
        </h2>
      </div>

      <div className="max-w-2xl mx-auto bg-[var(--theme-bg-secondary)] p-6 rounded-xl border border-[var(--theme-border)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 標題 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-1">投票標題</label>
            <input 
              type="text" 
              className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
              placeholder="例如：關於中庭花園整修提案"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          {/* 說明 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-1">詳細說明</label>
            <textarea 
              className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)] min-h-[100px]"
              placeholder="請輸入投票內容細節..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {/* 截止日期 */}
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-1">截止時間</label>
            <input 
              type="datetime-local" 
              className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
              value={formData.endDate}
              onChange={e => setFormData({...formData, endDate: e.target.value})}
              required
            />
          </div>

          {/* 按鈕 */}
          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-[var(--theme-accent)] hover:opacity-90"
            }`}
          >
            {loading ? "處理中..." : "發布並推播投票"}
          </button>

        </form>
      </div>
      
      <div className="mt-8 text-center text-sm text-[var(--theme-text-secondary)]">
        <p>⚠️ 注意：點擊發布後，系統將立即向所有已綁定 LINE 的住戶發送投票通知。</p>
      </div>
    </div>
  )
}