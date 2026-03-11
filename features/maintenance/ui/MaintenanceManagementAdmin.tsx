"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"
import { HelpHint } from "@/components/ui/help-hint"
import { DispatchModal } from "./DispatchModal"
import { CompleteModal } from "./CompleteModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, Search } from "lucide-react"

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
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">
            {isEditing ? "編輯維修紀錄" : "新增維修紀錄"}
            <HelpHint
              title="管理端維修編輯"
              description="可建立或更新維修案件；案件可透過操作欄進行派工與結案，並同步維護狀態、處理人與費用。"
              workflow={[
                "點新增或編輯後，先填完設備、項目、描述與報修人。",
                "視需要設定狀態、處理人、費用與備註後按儲存。",
                "回到列表再依案件狀態做派工或結案。",
              ]}
              logic={[
                "此視窗負責維護案件基本資料，流程節點操作在列表操作欄進行。",
                "狀態與處理人、費用互相關聯，會影響後續查核與追蹤。",
              ]}
            />
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">設備</label>
              <HelpHint
                title="管理端設備"
                description="填寫故障設備主體，例如電梯、照明、門禁。"
                workflow={[
                  "輸入故障設備大類，例如電梯或空調。",
                  "保持命名一致，方便日後搜尋與報表統計。",
                ]}
                logic={[
                  "設備是案件分類主鍵，會影響查詢與彙整維度。",
                ]}
                align="center"
              />
            </div>
            <input
              type="text"
              value={formData.equipment || ""}
              onChange={(e) => onChange("equipment", e.target.value)}
              placeholder="例：電梯、空調"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">項目</label>
              <HelpHint
                title="管理端項目"
                description="填寫設備下的細項（如馬達、面板），方便工單分類。"
                workflow={[
                  "在項目欄補充設備的故障部位或子項。",
                  "盡量使用現場常用名稱，方便維修人員辨識。",
                ]}
                logic={[
                  "項目可細分同設備不同故障點，提升派工精準度。",
                ]}
                align="center"
              />
            </div>
            <input
              type="text"
              value={formData.item || ""}
              onChange={(e) => onChange("item", e.target.value)}
              placeholder="例：馬達、面板"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">詳細說明</label>
              <HelpHint
                title="管理端詳細說明"
                description="記錄故障狀況與現場觀察，協助判斷處理優先順序。"
                workflow={[
                  "描述故障現象、發生時間與目前影響範圍。",
                  "有臨時處置或風險時一併寫入說明。",
                ]}
                logic={[
                  "描述越完整，越能降低派工來回確認成本。",
                  "可作為後續結案與責任追溯依據。",
                ]}
                align="center"
              />
            </div>
            <textarea
              value={formData.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="請詳細描述問題狀況"
              rows={3}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">報修人</label>
              <HelpHint
                title="管理端報修人"
                description="填報修來源，可用於後續回報進度與責任追蹤。"
                workflow={[
                  "輸入提出報修的人員姓名或來源單位。",
                  "若為管理員代報，也可標示實際反映者。",
                ]}
                logic={[
                  "報修人用於進度回報與溝通窗口追蹤。",
                ]}
                align="center"
              />
            </div>
            <input
              type="text"
              value={formData.reported_by_name || ""}
              onChange={(e) => onChange("reported_by_name", e.target.value)}
              placeholder="報修人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">處理狀態</label>
              <HelpHint
                title="管理端處理狀態"
                description="待處理可派工、處理中可結案、已完成代表案件已收尾。"
                workflow={[
                  "新案件通常先設為待處理。",
                  "派工後會進入處理中，完成施工後再結案為已完成。",
                ]}
                logic={[
                  "狀態控制流程節點，也決定列表操作欄可用按鈕。",
                ]}
                align="center"
              />
            </div>
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
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">處理人</label>
              <HelpHint
                title="管理端處理人"
                description="填寫或更新實際負責人員，便於調度與追蹤。"
                workflow={[
                  "填入承辦人員、廠商或師傅名稱。",
                  "若轉派，請更新為最新負責者。",
                ]}
                logic={[
                  "處理人是責任歸屬欄位，影響追蹤與績效統計。",
                ]}
                align="center"
              />
            </div>
            <input
              type="text"
              value={formData.handler || ""}
              onChange={(e) => onChange("handler", e.target.value)}
              placeholder="處理人姓名"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">費用</label>
              <HelpHint
                title="管理端費用"
                description="填入維修成本，可作為管理費支出與稽核依據。"
                workflow={[
                  "輸入預估或實際金額（純數字）。",
                  "結案前請確認最終費用是否已更新。",
                ]}
                logic={[
                  "費用會進入財務管理與後續稽核記錄。",
                ]}
                align="center"
              />
            </div>
            <input
              type="number"
              value={formData.cost || 0}
              onChange={(e) => onChange("cost", Number(e.target.value))}
              placeholder="請輸入費用"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">備註</label>
              <HelpHint
                title="管理端備註"
                description="補充處理結果、特殊狀況或後續追蹤事項。"
                workflow={[
                  "填寫補充說明，例如暫時修復、待料件或回訪安排。",
                  "結案時可更新最終處理結果。",
                ]}
                logic={[
                  "備註保留非結構化資訊，利於完整還原案件脈絡。",
                ]}
                align="center"
              />
            </div>
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

// 預覽模式的模擬資料
const PREVIEW_MAINTENANCE = [
  { id: "preview-1", equipment: "測試資料", item: "測試資料", description: "測試資料", reported_by_name: "測試資料", reported_by_id: null, photo_url: null, status: "open", handler: "", cost: 0, note: "測試資料" },
  { id: "preview-2", equipment: "測試資料", item: "測試資料", description: "測試資料", reported_by_name: "測試資料", reported_by_id: null, photo_url: null, status: "progress", handler: "測試資料", cost: 2500, note: "測試資料" },
  { id: "preview-3", equipment: "測試資料", item: "測試資料", description: "測試資料", reported_by_name: "測試資料", reported_by_id: null, photo_url: null, status: "done", handler: "測試資料", cost: 800, note: "測試資料" },
]

interface MaintenanceManagementAdminProps {
  isPreviewMode?: boolean
}

export function MaintenanceManagementAdmin({ isPreviewMode = false }: MaintenanceManagementAdminProps) {
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

  const [isDispatchOpen, setIsDispatchOpen] = useState(false)
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState<string | null>(null)

  const [isCompleteOpen, setIsCompleteOpen] = useState(false)
  const [selectedForComplete, setSelectedForComplete] = useState<{ id: string; estimatedCost?: number } | null>(null)

  const [searchTerm, setSearchTerm] = useState("")

  const filteredData = data.filter((row) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      row.equipment?.toLowerCase().includes(term) ||
      false ||
      row.item?.toLowerCase().includes(term) ||
      false ||
      row.description?.toLowerCase().includes(term) ||
      false ||
      row.reported_by_name?.toLowerCase().includes(term) ||
      false ||
      row.handler?.toLowerCase().includes(term) ||
      false
    )
  })

  const loadData = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()
    if (!supabase) {
      setData([])
      setLoading(false)
      return
    }

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
        handler: row.handler || row.handler_name || (row.handler_id ? profilesMap[row.handler_id] || "" : ""),
        cost: row.cost || 0,
        note: row.note || row.admin_note || "",
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    if (isPreviewMode) {
      setData(PREVIEW_MAINTENANCE)
      setLoading(false)
    } else {
      loadData()
    }
  }, [isPreviewMode])

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
      if (!supabase) {
        alert("資料庫連線失敗")
        return
      }
      const saveData = {
        equipment: formData.equipment,
        item: formData.item,
        description: formData.description,
        reported_by_name: formData.reported_by_name,
        reported_by_id: formData.reported_by_id,
        status: formData.status,
        handler_name: formData.handler,
        cost: formData.cost,
        note: formData.note,
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
      if (!supabase) {
        alert("資料庫連線失敗")
        return
      }
      const { error } = await supabase.from("maintenance").delete().eq("id", id)
      if (error) throw error

      alert("刪除成功！")
      await loadData()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
    }
  }

  const handleDispatch = (id: string | null) => {
    if (!id) return
    setSelectedMaintenanceId(id)
    setIsDispatchOpen(true)
  }

  const handleComplete = (id: string | null, estimatedCost?: number) => {
    if (!id) return
    setSelectedForComplete({ id, estimatedCost })
    setIsCompleteOpen(true)
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
          <HelpHint
            title="管理端維護管理"
            description="管理端可統一檢視與維護全社區維修案件，執行新增、派工、結案、編輯、刪除與進度管理。"
            workflow={[
              "按「新增一筆」建立案件，填寫設備、項目、描述與報修人後儲存。",
              "案件顯示「待處理」時，點操作欄「派工」並填入廠商、師傅、時間與預估費用。",
              "派工完成後案件進入「處理中」；確認施工完成後，點「結案」填寫實際費用與完工備註。",
              "結案成功後狀態變「已完成」；全流程可用搜尋快速定位並持續編輯/刪除紀錄。",
            ]}
            logic={[
              "狀態流轉為：待處理(open) → 處理中(progress) → 已完成(done)，依序推進。",
              "派工按鈕只在待處理顯示；結案按鈕只在處理中顯示，避免錯誤操作順序。",
              "派工會寫入派工資訊並可觸發通知；結案可寫入最終費用、備註與完工照片。",
              "預覽模式僅展示流程，不會真的送出派工或結案資料。",
            ]}
          />
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--theme-text-primary)] text-sm">搜尋</span>
            <HelpHint
              title="管理端維修搜尋"
              description="可依設備、項目、描述、報修人或處理人快速找到目標案件。"
              workflow={[
                "輸入設備、項目、描述、報修人或處理人關鍵字。",
                "系統即時過濾清單，幫你快速定位案件。",
              ]}
              logic={[
                "搜尋採前端多欄位比對，不影響資料庫原始紀錄。",
              ]}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
            <Input
              placeholder="搜尋設備、項目、描述、報修人或處理人..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            新增一筆
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-[var(--theme-accent-light)]">
              <th className="w-[9%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>設備</span><HelpHint title="設備欄" description="顯示故障設備類別。" workflow={["查看每筆案件的設備大類。","搭配搜尋可快速篩出同設備問題。"]} logic={["設備欄是案件分類起點，利於統計熱點故障。"]} /></div></th>
              <th className="w-[15%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>項目</span><HelpHint title="項目欄" description="顯示設備細項。" workflow={["查看設備下的故障部位或子項。","配合設備欄可更精準判斷問題位置。"]} logic={["同設備可有多個項目，能避免案件描述過於籠統。"]} /></div></th>
              <th className="w-[20%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>描述</span><HelpHint title="描述欄" description="顯示故障描述摘要。" workflow={["先看摘要掌握故障現象。","必要時進入編輯或結案資訊補充完整內容。"]} logic={["描述提供派工判斷依據，越完整越能減少往返確認。"]} /></div></th>
              <th className="w-[11%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>報修人</span><HelpHint title="報修人欄" description="顯示案件提出者。" workflow={["確認由誰提出案件。","需要追蹤時可依此欄回報進度。"]} logic={["報修人是溝通對象，對應回覆與責任追蹤。"]} /></div></th>
              <th className="w-[9%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>狀態</span><HelpHint title="狀態欄" description="顯示案件進度狀態。" workflow={["查看每筆案件的狀態標籤（待處理/處理中/已完成）。","待處理案件請到操作欄點派工；處理中案件可點結案。","結案後狀態會變為已完成，代表流程收斂。"]} logic={["狀態是流程控制核心，決定操作欄會出現哪個按鈕。","待處理可派工、處理中可結案、已完成通常僅保留查閱與必要修正。"]} /></div></th>
              <th className="w-[11%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>處理人</span><HelpHint title="處理人欄" description="顯示負責人員。" workflow={["查看目前承辦人或廠商。","如有轉派，更新後會同步反映在此欄。"]} logic={["處理人欄對應責任歸屬與調度紀錄。"]} /></div></th>
              <th className="w-[8%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>費用</span><HelpHint title="費用欄" description="顯示維修成本。" workflow={["查看案件的預估或最終費用。","結案前確認金額是否更新為實際值。"]} logic={["費用欄會影響財務統計與成本控管。"]} /></div></th>
              <th className="w-[11%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>備註</span><HelpHint title="備註欄" description="顯示補充資訊。" workflow={["查看案件補充說明與處理細節。","需要時可在編輯或結案時持續更新。"]} logic={["備註保留異常情況與後續追蹤重點。"]} /></div></th>
              <th className="w-[170px] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>操作</span><HelpHint title="操作欄" description="可派工、結案、編輯或刪除維修紀錄。" workflow={["待處理列：點綠色勾勾按鈕進入派工。","處理中列：點綠色勾勾按鈕進入結案。","鉛筆按鈕可編輯欄位內容；垃圾桶按鈕可刪除案件。"]} logic={["按鈕會依狀態切換：open 顯示派工、progress 顯示結案。","編輯與刪除是通用操作；派工/結案屬於流程節點操作。"]} /></div></th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row, index) => {
                const statusInfo = getStatusLabel(row.status)
                return (
                  <tr key={row.id || `new-${index}`} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] truncate" title={row.equipment || "-"}>
                      {row.equipment || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] truncate" title={row.item || "-"}>
                      {row.item || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] truncate" title={row.description || "-"}>
                      {row.description || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] truncate" title={row.reported_by_name || "-"}>
                      {row.reported_by_name || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusInfo.class}`}>
                        {statusInfo.text}
                      </span>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] truncate" title={row.handler || "-"}>
                      {row.handler || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      ${row.cost?.toLocaleString() || 0}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] truncate" title={row.note || "-"}>
                      {row.note || "-"}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] w-[170px]">
                      <div className="flex gap-1 whitespace-nowrap">
                        {row.status === "open" && (
                          <button
                            onClick={() => !isPreviewMode && handleDispatch(row.id)}
                            disabled={isPreviewMode}
                            className="p-2 rounded-lg border border-blue-500 text-blue-500 hover:bg-blue-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isPreviewMode ? "預覽模式不可派工" : "派工"}
                          >
                            <span className="material-icons text-lg">assignment_ind</span>
                          </button>
                        )}
                        {row.status === "progress" && (
                          <button
                            onClick={() => !isPreviewMode && handleComplete(row.id, row.cost)}
                            disabled={isPreviewMode}
                            className="p-2 rounded-lg border border-green-500 text-green-500 hover:bg-green-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isPreviewMode ? "預覽模式不可結案" : "結案"}
                          >
                            <span className="material-icons text-lg">check_circle</span>
                          </button>
                        )}
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
                  {searchTerm ? "沒有符合條件的維修紀錄" : "目前沒有維修紀錄"}
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

      <DispatchModal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        maintenanceId={selectedMaintenanceId || ""}
        onSuccess={loadData}
      />

      <CompleteModal
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        maintenanceId={selectedForComplete?.id || ""}
        estimatedCost={selectedForComplete?.estimatedCost}
        onSuccess={loadData}
      />
    </div>
  )
}
