"use client"

import { useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface DispatchModalProps {
  isOpen: boolean
  onClose: () => void
  maintenanceId: string
  onSuccess: () => void
}

interface VendorDetails {
  vendor_name: string
  worker_name: string
  worker_phone: string
  scheduled_at: string
  estimated_cost: number
  admin_note: string
}

export function DispatchModal({ isOpen, onClose, maintenanceId, onSuccess }: DispatchModalProps) {
  const [formData, setFormData] = useState<VendorDetails>({
    vendor_name: "",
    worker_name: "",
    worker_phone: "",
    scheduled_at: "",
    estimated_cost: 0,
    admin_note: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (field: keyof VendorDetails, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = getSupabaseClient()

      // Update the maintenance record with vendor/dispatch details
      const { error } = await supabase
        .from("maintenance")
        .update({
          vendor_name: formData.vendor_name,
          worker_name: formData.worker_name,
          worker_phone: formData.worker_phone,
          scheduled_at: formData.scheduled_at,
          estimated_cost: formData.estimated_cost,
          admin_note: formData.admin_note,
          status: "progress", // Update status to "處理中" after dispatch
        })
        .eq("id", maintenanceId)

      if (error) throw error

      alert("派工成功！")
      onSuccess()
      onClose()
      // Reset form
      setFormData({
        vendor_name: "",
        worker_name: "",
        worker_phone: "",
        scheduled_at: "",
        estimated_cost: 0,
        admin_note: "",
      })
    } catch (error: any) {
      console.error("Dispatch error:", error)
      alert(`派工失敗：${error.message || "請稍後再試"}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">
            <span className="material-icons">assignment_ind</span>
            派工給廠商
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors disabled:opacity-50"
          >
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {/* Vendor Name */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                廠商名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.vendor_name}
                onChange={(e) => handleChange("vendor_name", e.target.value)}
                placeholder="請輸入廠商名稱"
                required
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              />
            </div>

            {/* Worker Name */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                師傅姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.worker_name}
                onChange={(e) => handleChange("worker_name", e.target.value)}
                placeholder="請輸入師傅姓名"
                required
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              />
            </div>

            {/* Worker Phone */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                師傅電話 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.worker_phone}
                onChange={(e) => handleChange("worker_phone", e.target.value)}
                placeholder="例：0912-345-678"
                required
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              />
            </div>

            {/* Scheduled Time */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                預約時間 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => handleChange("scheduled_at", e.target.value)}
                required
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              />
            </div>

            {/* Estimated Cost */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                預估費用
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-secondary)]">$</span>
                <input
                  type="number"
                  value={formData.estimated_cost || ""}
                  onChange={(e) => handleChange("estimated_cost", Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  disabled={isLoading}
                  className="w-full p-3 pl-8 rounded-xl theme-input outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Admin Note */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                備註
              </label>
              <textarea
                value={formData.admin_note}
                onChange={(e) => handleChange("admin_note", e.target.value)}
                placeholder="請輸入備註事項（選填）"
                rows={3}
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none resize-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl font-semibold bg-gray-500 text-white hover:bg-gray-600 transition-all disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  處理中...
                </>
              ) : (
                <>
                  <span className="material-icons text-sm">send</span>
                  確認派工
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
