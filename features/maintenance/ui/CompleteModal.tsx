"use client"

import { useState } from "react"

interface CompleteModalProps {
  isOpen: boolean
  onClose: () => void
  maintenanceId: string
  estimatedCost?: number
  onSuccess: () => void
}

export function CompleteModal({ isOpen, onClose, maintenanceId, estimatedCost, onSuccess }: CompleteModalProps) {
  const [formData, setFormData] = useState({
    final_cost: estimatedCost || 0,
    completion_note: "",
    completion_photo_url: "",
    generate_fee: true
  })
  const [isLoading, setIsLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert to base64 for preview and storage
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setPhotoPreview(base64)
      setFormData(prev => ({ ...prev, completion_photo_url: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/maintenance/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceId,
          final_cost: formData.final_cost,
          completion_note: formData.completion_note,
          completion_photo_url: formData.completion_photo_url,
          generate_fee: formData.generate_fee && formData.final_cost > 0
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '結案失敗')
      }

      // Show success message
      let successMsg = '結案成功！'
      if (result.feeGenerated) {
        successMsg += '\n📄 已產生繳費單'
      }
      if (result.lineNotification?.sent) {
        successMsg += '\n📱 已透過 LINE 通知住戶'
      } else if (result.lineNotification?.error) {
        successMsg += `\n⚠ LINE 通知未發送：${result.lineNotification.error}`
      }

      alert(successMsg)
      onSuccess()
      onClose()
      
      // Reset form
      setFormData({
        final_cost: 0,
        completion_note: "",
        completion_photo_url: "",
        generate_fee: true
      })
      setPhotoPreview(null)
    } catch (error: any) {
      console.error("Complete error:", error)
      alert(`結案失敗：${error.message || "請稍後再試"}`)
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
          <h3 className="text-lg font-bold text-green-500 flex items-center gap-2">
            <span className="material-icons">check_circle</span>
            確認結案
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
            {/* Final Cost */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                實際費用 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-secondary)]">NT$</span>
                <input
                  type="number"
                  value={formData.final_cost || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, final_cost: Number(e.target.value) }))}
                  placeholder="0"
                  min="0"
                  required
                  disabled={isLoading}
                  className="w-full p-3 pl-12 rounded-xl theme-input outline-none focus:ring-2 focus:ring-green-500/50 transition-all disabled:opacity-50"
                />
              </div>
              {estimatedCost && estimatedCost !== formData.final_cost && (
                <div className="text-yellow-500 text-sm mt-1">
                  預估費用：NT$ {estimatedCost.toLocaleString()}
                </div>
              )}
            </div>

            {/* Generate Fee Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="generate_fee"
                checked={formData.generate_fee}
                onChange={(e) => setFormData(prev => ({ ...prev, generate_fee: e.target.checked }))}
                disabled={isLoading || formData.final_cost <= 0}
                className="w-5 h-5 rounded accent-green-500"
              />
              <label htmlFor="generate_fee" className="text-[var(--theme-text-primary)]">
                自動產生繳費單
              </label>
            </div>

            {/* Completion Note */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                完工備註
              </label>
              <textarea
                value={formData.completion_note}
                onChange={(e) => setFormData(prev => ({ ...prev, completion_note: e.target.value }))}
                placeholder="請輸入完工備註（選填）"
                rows={3}
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none resize-none focus:ring-2 focus:ring-green-500/50 transition-all disabled:opacity-50"
              />
            </div>

            {/* Completion Photo */}
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                完工照片（選填）
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none focus:ring-2 focus:ring-green-500/50 transition-all disabled:opacity-50"
              />
              {photoPreview && (
                <div className="mt-2 relative">
                  <img
                    src={photoPreview}
                    alt="完工照片預覽"
                    className="w-full max-h-40 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null)
                      setFormData(prev => ({ ...prev, completion_photo_url: "" }))
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                  >
                    <span className="material-icons text-sm">close</span>
                  </button>
                </div>
              )}
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
              className="flex-1 px-4 py-3 rounded-xl font-semibold bg-green-500 text-white hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  處理中...
                </>
              ) : (
                <>
                  <span className="material-icons text-sm">check</span>
                  確認結案
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
