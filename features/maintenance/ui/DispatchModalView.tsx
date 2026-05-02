"use client"

import { useEffect, useState } from "react"
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

interface VendorOption {
  id: string
  name: string
  phone?: string
  specialty?: string
}

interface WorkerOption {
  id: string
  vendor_id: string
  name: string
  phone?: string
  worker_phone?: string
  phone_number?: string
}

interface PendingDispatchData {
  maintenanceId: string
  vendor_name: string
  worker_name: string
  worker_phone: string
  scheduled_at: string
  estimated_cost: number
  admin_note: string
  operatorId: string | null
  operatorRole: string
}

function getCurrentOperator() {
  if (typeof window === "undefined") return { id: "", role: "unknown" }

  try {
    const raw = localStorage.getItem("currentUser")
    if (!raw) return { id: "", role: "unknown" }
    const parsed = JSON.parse(raw)
    return {
      id: parsed?.id || "",
      role: parsed?.role || "unknown",
    }
  } catch {
    return { id: "", role: "unknown" }
  }
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
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [allWorkers, setAllWorkers] = useState<WorkerOption[]>([])
  const [workers, setWorkers] = useState<WorkerOption[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState("")
  const [sendModeDialogOpen, setSendModeDialogOpen] = useState(false)
  const [pendingDispatchData, setPendingDispatchData] = useState<PendingDispatchData | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const loadVendorsAndWorkers = async () => {
      setLoadingVendors(true)
      try {
        const supabase = getSupabaseClient()
        if (!supabase) {
          setVendors([])
          setAllWorkers([])
          return
        }

        const { data: vendorData, error: vendorError } = await supabase
          .from("vendors")
          .select("*")
          .order("name")

        const { data: workerData, error: workerError } = await supabase
          .from("vendor_workers")
          .select("*")
          .order("name")

        if (vendorError || workerError || !vendorData) {
          setVendors([])
          setAllWorkers([])
          return
        }

        setVendors(vendorData)
        setAllWorkers(workerData || [])
      } catch (error) {
        console.error("Error loading vendors/workers:", error)
        setVendors([])
        setAllWorkers([])
      } finally {
        setLoadingVendors(false)
      }
    }

    loadVendorsAndWorkers()
  }, [isOpen])

  const handleChange = (field: keyof VendorDetails, value: string | number) => {
    if (field === "vendor_name") {
      const selectedVendor = vendors.find((v) => v.name === value)
      const vendorId = selectedVendor?.id || ""
      setSelectedVendorId(vendorId)

      const vendorWorkers = allWorkers.filter((w) => w.vendor_id === vendorId)
      setWorkers(vendorWorkers)

      setFormData((prev) => ({
        ...prev,
        vendor_name: value as string,
        worker_name: "",
        worker_phone: "",
      }))
      return
    }

    if (field === "worker_name") {
      const selectedWorker = workers.find((w) => w.name === value)
      const phoneValue = selectedWorker
        ? selectedWorker.phone || selectedWorker.worker_phone || selectedWorker.phone_number || ""
        : ""

      setFormData((prev) => ({
        ...prev,
        worker_name: value as string,
        worker_phone: phoneValue,
      }))
      return
    }

    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      vendor_name: "",
      worker_name: "",
      worker_phone: "",
      scheduled_at: "",
      estimated_cost: 0,
      admin_note: "",
    })
    setWorkers([])
    setSelectedVendorId("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const operator = getCurrentOperator()
    setPendingDispatchData({
      maintenanceId,
      vendor_name: formData.vendor_name,
      worker_name: formData.worker_name,
      worker_phone: formData.worker_phone,
      scheduled_at: formData.scheduled_at,
      estimated_cost: formData.estimated_cost,
      admin_note: formData.admin_note,
      operatorId: operator.id || null,
      operatorRole: operator.role,
    })
    setSendModeDialogOpen(true)
  }

  const handleSendDispatchWithMode = async (sendMode: "test" | "official") => {
    if (!pendingDispatchData) return

    setSendModeDialogOpen(false)
    setIsLoading(true)

    try {
      const response = await fetch("/api/maintenance/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingDispatchData,
          sendMode,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "派工失敗")
      }

      if (result.lineNotification?.sent) {
        alert("派工成功！已透過 LINE 通知住戶。")
      } else if (result.lineNotification?.error) {
        alert(`派工成功！\n\n⚠ LINE 通知未發送：${result.lineNotification.error}`)
      } else {
        alert("派工成功！")
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error("Dispatch error:", error)
      alert(`派工失敗：${error.message || "請稍後再試"}`)
    } finally {
      setIsLoading(false)
      setPendingDispatchData(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
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

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                廠商名稱 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.vendor_name}
                onChange={(e) => handleChange("vendor_name", e.target.value)}
                required
                disabled={isLoading || loadingVendors}
                className="w-full p-3 rounded-xl theme-select text-[var(--theme-text-primary)] outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              >
                <option value="">
                  {loadingVendors ? "載入中..." : vendors.length === 0 ? "-- 尚無廠商資料 --" : "-- 請選擇廠商 --"}
                </option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.name}>
                    {vendor.name} {vendor.specialty ? `(${vendor.specialty})` : ""}
                  </option>
                ))}
              </select>
              {vendors.length === 0 && !loadingVendors && (
                <div className="text-yellow-500 text-sm mt-1">⚠ 請先到資料庫新增廠商資料</div>
              )}
            </div>

            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                師傅姓名 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.worker_name}
                onChange={(e) => handleChange("worker_name", e.target.value)}
                required
                disabled={isLoading || !selectedVendorId}
                className="w-full p-3 rounded-xl theme-select text-[var(--theme-text-primary)] outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              >
                <option value="">
                  {!selectedVendorId
                    ? "-- 請先選擇廠商 --"
                    : workers.length === 0
                      ? "-- 此廠商無師傅資料 --"
                      : "-- 請選擇師傅 --"}
                </option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.name}>
                    {worker.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
                師傅電話 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.worker_phone}
                onChange={(e) => handleChange("worker_phone", e.target.value)}
                placeholder="自動帶入或手動編輯"
                required
                disabled={isLoading}
                className="w-full p-3 rounded-xl theme-input outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              />
              {formData.worker_phone && <div className="text-green-500 text-sm mt-1">✓ 已自動帶入師傅電話</div>}
            </div>

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

            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">預估費用</label>
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

            <div>
              <label className="block text-[var(--theme-text-primary)] font-medium mb-2">備註</label>
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
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
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

      {sendModeDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="border-b border-[var(--theme-border)] p-5">
              <h3 className="text-lg font-bold text-[var(--theme-accent)]">🤖 選擇派工通知頻道</h3>
              <p className="text-sm text-[var(--theme-text-secondary)] mt-3">
                請選擇要使用測試或正式 LINE BOT 發送派工通知
              </p>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => handleSendDispatchWithMode("test")}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-amber-500/20 border border-amber-500 text-amber-600 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                🧪 測試 BOT
                <div className="text-xs font-normal mt-1 opacity-80">限制通知範圍，用於測試</div>
              </button>
              <button
                onClick={() => handleSendDispatchWithMode("official")}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl font-semibold bg-blue-500/20 border border-blue-500 text-blue-600 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                ✓ 正式 BOT
                <div className="text-xs font-normal mt-1 opacity-80">通知所有相關住戶</div>
              </button>
            </div>
            <div className="border-t border-[var(--theme-border)] p-3 bg-[var(--theme-bg-secondary)]">
              <button
                onClick={() => {
                  setSendModeDialogOpen(false)
                  setPendingDispatchData(null)
                }}
                disabled={isLoading}
                className="w-full px-4 py-2 rounded-lg text-[var(--theme-text-secondary)] border border-[var(--theme-border)] hover:bg-[var(--theme-bg-primary)] transition-colors disabled:opacity-50 text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DispatchModal
