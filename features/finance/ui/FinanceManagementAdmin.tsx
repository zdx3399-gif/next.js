"use client"

import { useState, useEffect, useMemo } from "react"
import { useFinanceAdmin } from "../hooks/useFinance"
import { getSupabaseClient } from "@/lib/supabase"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Plus, Search } from "lucide-react"

// --- Types ---
interface FinanceRecord {
  id?: string
  room: string
  amount: number
  due: string
  invoice: string
  paid: boolean
  unit_id?: string
  monthly_fee?: number
}

interface ExpenseRecord {
  id: string
  date: string
  item: string
  category: string
  amount: number
  vendor: string
  note?: string
}

interface UnitOption {
  id: string
  unit_code: string
  ping_size: number
  car_spots: number
  moto_spots: number
  monthly_fee: number
}

type TabType = "income" | "expense" | "report"

// --- Mock Data for Expenses ---
const INITIAL_EXPENSES: ExpenseRecord[] = [
  { id: "1", date: "2025-11-28", item: "大廳燈泡更換", category: "維護費", amount: 12321, vendor: "水电行" },
  { id: "2", date: "2025-11-28", item: "電梯保養 (11月)", category: "維護費", amount: 9000, vendor: "迅達電梯" },
  { id: "3", date: "2025-11-27", item: "外牆清洗", category: "清潔費", amount: 10000, vendor: "潔淨公司" },
  { id: "4", date: "2025-11-26", item: "管理員薪資", category: "人事費", amount: 3000, vendor: "-" },
]

// --- Income Modal ---
interface FinanceFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: FinanceRecord
  onChange: (field: keyof FinanceRecord, value: any) => void
  onSave: () => void
  isEditing: boolean
}

function FinanceFormModal({ isOpen, onClose, formData, onChange, onSave, isEditing }: FinanceFormModalProps) {
  const [calc, setCalc] = useState({ parking: 0, car: 0, ping: 0 })
  const [units, setUnits] = useState<UnitOption[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCalc({ parking: 0, car: 0, ping: 0 })
      loadUnits()
    }
  }, [isOpen])

  const loadUnits = async () => {
    setLoadingUnits(true)
    const supabase = getSupabaseClient()
    if (supabase) {
      const { data } = await supabase
        .from("units")
        .select("id, unit_code, ping_size, car_spots, moto_spots, monthly_fee")
        .order("unit_code")
      if (data) {
        setUnits(data)
      }
    }
    setLoadingUnits(false)
  }

  const handleUnitSelect = (unitId: string) => {
    const unit = units.find((u) => u.id === unitId)
    if (unit) {
      onChange("unit_id", unit.id)
      onChange("room", unit.unit_code)
      onChange("monthly_fee", unit.monthly_fee || 0)
      setCalc({
        parking: unit.car_spots > 0 ? 1 : 0,
        car: unit.car_spots || 0,
        ping: unit.ping_size || 0,
      })
    }
  }

  useEffect(() => {
    const total = calc.parking * 500 + calc.car * 100 + calc.ping * 90
    if (total > 0) onChange("amount", total)
  }, [calc])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--theme-border)]">
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">
            {isEditing ? "編輯收入記錄" : "新增收入記錄"}
            <HelpHint
              title="管理端收入記錄"
              description="建立或更新住戶收費資料，包含房號、金額、到期日與繳費狀態。"
              workflow={[
                "先選房號，再確認每月管理費與本期金額。",
                "設定到期日、發票資訊與繳費狀態。",
                "儲存後回收入列表確認資料正確。",
              ]}
              logic={[
                "收入資料會同步影響住戶端繳費清單與提醒。",
              ]}
            />
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-[var(--theme-text-primary)] font-medium">房號</label>
              <HelpHint title="管理端房號" description="選擇對應住戶房號，系統會帶入關聯設定。" workflow={["先選擇住戶房號。","確認自動帶入的基礎設定是否正確。","若房號異常請先修正主檔再建立收費。"]} logic={["房號是收費記錄關聯主鍵。"]} align="center" />
            </div>
            {loadingUnits ? (
              <div className="w-full p-3 rounded-xl theme-input text-center">載入中...</div>
            ) : (
              <select
                value={formData.unit_id || ""}
                onChange={(e) => handleUnitSelect(e.target.value)}
                className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
              >
                <option value="">-- 選擇房號 --</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_code}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">
              每月管理費 <span className="text-xs text-[var(--theme-text-secondary)]">(將更新該房號的管理費設定)</span>
              <HelpHint title="管理端每月管理費" description="更新後會影響該房號後續收費基準。" workflow={["確認住戶最新管理費標準。","輸入新金額並儲存。","後續新增收費時會沿用此基準。"]} logic={["此欄為長期基準值，不只影響單筆資料。"]} align="center" />
            </label>
            <input
              type="number"
              value={formData.monthly_fee || 0}
              onChange={(e) => onChange("monthly_fee", Number(e.target.value))}
              className="w-full p-3 rounded-xl theme-input outline-none font-semibold"
              placeholder="輸入每月管理費"
            />
          </div>

          <div className="bg-[var(--theme-accent-light)] p-3 rounded-xl space-y-2 border border-[var(--theme-border)]">
            <label className="block text-[var(--theme-accent)] font-bold text-sm mb-2">
              <span className="material-icons text-sm align-middle mr-1">calculate</span>
              費用試算 (自動填入)
              <span className="inline-flex ml-2 align-middle"><HelpHint title="管理端費用試算" description="可用車位與坪數快速試算金額，仍可手動調整。" workflow={["輸入汽車、機車與坪數數值。","系統會自動計算建議金額。","若有特殊情況可再手動調整總金額。"]} logic={["試算是輔助工具，最終收費以總金額欄為準。"]} align="center" /></span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-[var(--theme-text-secondary)] block mb-1">汽車 ($500)</label>
                <input
                  type="number"
                  min="0"
                  value={calc.parking || ""}
                  onChange={(e) => setCalc((prev) => ({ ...prev, parking: Number(e.target.value) }))}
                  className="w-full p-2 text-sm rounded-lg theme-input outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--theme-text-secondary)] block mb-1">機車 ($100)</label>
                <input
                  type="number"
                  min="0"
                  value={calc.car || ""}
                  onChange={(e) => setCalc((prev) => ({ ...prev, car: Number(e.target.value) }))}
                  className="w-full p-2 text-sm rounded-lg theme-input outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--theme-text-secondary)] block mb-1">坪數 ($90/坪)</label>
                <input
                  type="number"
                  min="0"
                  value={calc.ping || ""}
                  onChange={(e) => setCalc((prev) => ({ ...prev, ping: Number(e.target.value) }))}
                  className="w-full p-2 text-sm rounded-lg theme-input outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">總金額<HelpHint title="管理端總金額" description="本期實際收費金額，將顯示於住戶端繳費清單。" workflow={["檢查試算結果是否合理。","必要時直接手動修正總金額。","儲存前確認金額與公告一致。"]} logic={["總金額是住戶端最終應繳金額。"]} align="center" /></label>
            <input
              type="number"
              value={formData.amount || 0}
              onChange={(e) => onChange("amount", Number(e.target.value))}
              className="w-full p-3 rounded-xl theme-input outline-none font-bold text-lg"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">到期日<HelpHint title="管理端到期日" description="住戶繳費截止日期，建議配合公告與催繳時程設定。" workflow={["設定本期繳費截止日。","確認與公告時程一致。","必要時保留催繳緩衝天數。"]} logic={["到期日會驅動未繳提醒與催繳節奏。"]} align="center" /></label>
            <input
              type="date"
              value={formData.due ? formData.due.split("T")[0] : ""}
              onChange={(e) => onChange("due", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">發票/收據<HelpHint title="管理端發票收據" description="填寫單據編號，便於後續對帳與查核。" workflow={["輸入發票或收據編號。","核對格式避免重號或漏號。","對帳時可依此欄快速追溯。"]} logic={["單據欄是財務稽核與追蹤的重要索引。"]} align="center" /></label>
            <input
              type="text"
              value={formData.invoice || ""}
              onChange={(e) => onChange("invoice", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">狀態<HelpHint title="管理端繳費狀態" description="標示已繳或未繳，影響住戶端提醒顯示。" workflow={["依實際收款狀況切換已繳/未繳。","收款後立即更新狀態。","更新後回列表檢查標籤是否正確。"]} logic={["狀態欄會直接影響住戶端未繳提醒顯示。"]} align="center" /></label>
            <select
              value={String(formData.paid)}
              onChange={(e) => onChange("paid", e.target.value === "true")}
              className="w-full p-3 rounded-xl theme-select outline-none"
            >
              <option value="true">已繳</option>
              <option value="false">未繳</option>
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)]"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-3 rounded-xl font-semibold bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90"
          >
            {isEditing ? "儲存" : "新增"}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Expense Modal ---
interface ExpenseFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: ExpenseRecord
  onChange: (field: keyof ExpenseRecord, value: any) => void
  onSave: () => void
  isEditing: boolean
}

function ExpenseFormModal({ isOpen, onClose, formData, onChange, onSave, isEditing }: ExpenseFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--theme-border)]">
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">{isEditing ? "編輯支出記錄" : "新增支出記錄"}<HelpHint title="管理端支出記錄" description="建立或更新社區支出明細，供報表與公開資訊使用。" workflow={["先填日期、項目、類別與廠商。","再輸入實際支出金額。","儲存後在支出列表與報表確認更新。"]} logic={["支出資料會即時影響損益與類別分析。"]} /></h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">日期<HelpHint title="管理端支出日期" description="實際發生支出日期，供期間統計使用。" workflow={["填寫實際支出發生日。","與憑證日期比對確認。","避免跨期誤填影響報表。"]} logic={["日期欄影響期間統計與月報歸屬。"]} align="center" /></label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => onChange("date", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">項目名稱<HelpHint title="管理端支出項目" description="填寫支出用途，例如電梯保養、清潔服務。" workflow={["輸入可辨識的支出項目名稱。","項目名稱建議含用途關鍵字。","避免使用過於籠統描述。"]} logic={["項目名稱會影響後續查詢與報表可讀性。"]} align="center" /></label>
            <input
              type="text"
              value={formData.item}
              onChange={(e) => onChange("item", e.target.value)}
              placeholder="例如：電梯保養"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">類別<HelpHint title="管理端支出類別" description="用於報表分類與預算分析。" workflow={["選擇最符合用途的支出類別。","跨類型項目請依主要用途歸類。","儲存後在報表查看類別占比。"]} logic={["類別欄是支出分析與預算檢討基礎。"]} align="center" /></label>
            <select
              value={formData.category}
              onChange={(e) => onChange("category", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none"
            >
              <option value="維護費">維護費</option>
              <option value="清潔費">清潔費</option>
              <option value="人事費">人事費</option>
              <option value="行政費">行政費</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">廠商<HelpHint title="管理端廠商" description="記錄供應商或承包商名稱，便於後續追蹤。" workflow={["輸入供應商或承包商名稱。","統一命名以避免同廠商多種寫法。","查帳時可用廠商欄快速過濾。"]} logic={["廠商欄便於採購追蹤與供應商分析。"]} align="center" /></label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => onChange("vendor", e.target.value)}
              placeholder="廠商名稱"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">金額 (支出)<HelpHint title="管理端支出金額" description="填寫實際支出金額，會納入財務報表統計。" workflow={["輸入實際付款金額。","確認單位與小數位正確。","儲存前與憑證金額再次核對。"]} logic={["金額欄直接影響損益與支出分析結果。"]} align="center" /></label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => onChange("amount", Number(e.target.value))}
              className="w-full p-3 rounded-xl theme-input outline-none font-bold text-red-500"
            />
          </div>
        </div>

        <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)]"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-3 rounded-xl font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            {isEditing ? "儲存" : "新增支出"}
          </button>
        </div>
      </div>
    </div>
  )
}

// 預覽模式的模擬資料
const PREVIEW_RECORDS: FinanceRecord[] = [
  { id: "preview-1", room: "A棟 5樓 501室", amount: 3500, due: new Date(Date.now() + 7 * 86400000).toISOString(), invoice: "INV-***-001", paid: false, unit_id: "preview-unit-1", monthly_fee: 3500 },
  { id: "preview-2", room: "B棟 3樓 302室", amount: 4200, due: new Date(Date.now() - 3 * 86400000).toISOString(), invoice: "INV-***-002", paid: true, unit_id: "preview-unit-2", monthly_fee: 4200 },
  { id: "preview-3", room: "A棟 8樓 801室", amount: 3800, due: new Date(Date.now() + 14 * 86400000).toISOString(), invoice: "INV-***-003", paid: false, unit_id: "preview-unit-3", monthly_fee: 3800 },
]

interface FinanceManagementAdminProps {
  isPreviewMode?: boolean
}

// --- Main Component ---
export function FinanceManagementAdmin({ isPreviewMode = false }: FinanceManagementAdminProps) {
  const { records: realRecords, saveRecord, deleteRecord, updateRecord, loading, refresh } = useFinanceAdmin()

  // 預覽模式使用模擬資料
  const records = isPreviewMode ? PREVIEW_RECORDS : realRecords
  const [activeTab, setActiveTab] = useState<TabType>("income")
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES)
  const [searchTerm, setSearchTerm] = useState("")

  // Income State
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [incomeEditingIndex, setIncomeEditingIndex] = useState<number | null>(null)
  const [incomeFormData, setIncomeFormData] = useState<Omit<FinanceRecord, 'id'> & { id?: string }>({
    room: "",
    amount: 0,
    due: "",
    invoice: "",
    paid: false,
    unit_id: "",
    monthly_fee: 0,
  })

  // Expense State
  const [expenseEditingId, setExpenseEditingId] = useState<string | null>(null)
  const [expenseFormData, setExpenseFormData] = useState<ExpenseRecord>({
    id: "",
    date: new Date().toISOString().split("T")[0],
    item: "",
    category: "維護費",
    amount: 0,
    vendor: "",
  })
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)

  // --- Report Calculations ---
  const reportData = useMemo(() => {
    const totalIncome = records.filter((r) => r.paid).reduce((sum, r) => sum + (r.amount || 0), 0)
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0)
    const categoryTotals: Record<string, number> = {}
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount
    })

    return {
      totalIncome,
      totalExpense,
      netIncome: totalIncome - totalExpense,
      categoryAnalysis: Object.entries(categoryTotals)
        .map(([name, value]) => ({
          name,
          value,
          percent: totalExpense > 0 ? (value / totalExpense) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value),
    }
  }, [records, expenses])

  // --- Handlers: Income ---
  const handleAddIncome = () => {
    setIncomeFormData({ room: "", amount: 0, due: "", invoice: "", paid: false, unit_id: "", monthly_fee: 0 })
    setIncomeEditingIndex(null)
    setIsIncomeModalOpen(true)
  }

  const handleEditIncome = (index: number) => {
    const record = records[index]
    setIncomeFormData({
      id: record.id,
      room: record.room || "",
      amount: record.amount || 0,
      due: record.due || "",
      invoice: record.invoice || "",
      paid: record.paid || false,
      unit_id: record.unit_id || "",
      monthly_fee: record.monthly_fee || 0,
    })
    setIncomeEditingIndex(index)
    setIsIncomeModalOpen(true)
  }

  const handleSaveIncome = async () => {
    console.log("[v0] handleSaveIncome called", { incomeEditingIndex, incomeFormData })

    if (incomeEditingIndex !== null) {
      const recordToSave = {
        ...records[incomeEditingIndex],
        ...incomeFormData,
      }
      console.log("[v0] Saving updated record:", recordToSave)
      const success = await saveRecord(recordToSave, incomeEditingIndex)
      if (success) {
        console.log("[v0] Save successful, refreshing...")
      } else {
        console.log("[v0] Save failed")
      }
    } else {
      console.log("[v0] Creating new record:", incomeFormData)
      const success = await saveRecord({ ...incomeFormData, id: undefined }, records.length)
      if (success) {
        console.log("[v0] Create successful, refreshing...")
      } else {
        console.log("[v0] Create failed")
      }
    }
    setIsIncomeModalOpen(false)
  }

  // --- Handlers: Expense ---
  const handleAddExpense = () => {
    setExpenseFormData({
      id: "",
      date: new Date().toISOString().split("T")[0],
      item: "",
      category: "維護費",
      amount: 0,
      vendor: "",
    })
    setExpenseEditingId(null)
    setIsExpenseModalOpen(true)
  }

  const handleEditExpense = (id: string) => {
    const exp = expenses.find((e) => e.id === id)
    if (exp) {
      setExpenseFormData({ ...exp })
      setExpenseEditingId(id)
      setIsExpenseModalOpen(true)
    }
  }

  const handleSaveExpense = () => {
    if (expenseEditingId) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === expenseEditingId ? { ...expenseFormData, id: expenseEditingId } : e)),
      )
    } else {
      const newExp = { ...expenseFormData, id: Math.random().toString(36).substr(2, 9) }
      setExpenses((prev) => [newExp, ...prev])
    }
    setIsExpenseModalOpen(false)
  }

  const handleDeleteExpense = (id: string) => {
    if (confirm("確定要刪除此筆支出記錄嗎？")) {
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    }
  }

  const renderIncomeTable = () => {
    const filteredRecords = records.filter((row) => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        row.room?.toLowerCase().includes(term) ||
        row.invoice?.toLowerCase().includes(term) ||
        row.amount?.toString().includes(term)
      )
    })

    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-muted)]" />
            <Input
              placeholder="搜尋房號、單號或金額..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重新整理
            </Button>
            <Button onClick={handleAddIncome}>
              <Plus className="w-4 h-4 mr-2" />
              新增一筆
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] rounded-tl-lg whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>房號</span><HelpHint title="收入房號欄" description="對應收費住戶房號。" /></div></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>金額</span><HelpHint title="收入金額欄" description="本期應收金額。" /></div></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>到期日</span><HelpHint title="收入到期日欄" description="繳費截止日期。" /></div></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>發票</span><HelpHint title="收入發票欄" description="收據或發票編號。" /></div></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>狀態</span><HelpHint title="收入狀態欄" description="顯示已繳或未繳。" /></div></th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] rounded-tr-lg whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>操作</span><HelpHint title="收入操作欄" description="可編輯或刪除收費記錄。" /></div></th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((row, index) => (
                  <tr
                    key={row.id || `new-${index}`}
                    className="hover:bg-[var(--theme-bg-secondary)] transition-colors border-b border-[var(--theme-border)] last:border-0"
                  >
                    <td className="p-3 text-[var(--theme-text-primary)]">{row.room || "-"}</td>
                    <td className="p-3 text-[var(--theme-text-primary)] font-medium">
                      ${row.amount?.toLocaleString() || 0}
                    </td>
                    <td className="p-3 text-[var(--theme-text-secondary)]">
                      {row.due ? new Date(row.due).toLocaleDateString("zh-TW") : "-"}
                    </td>
                    <td className="p-3 text-[var(--theme-text-secondary)]">{row.invoice || "-"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${row.paid ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}
                      >
                        {row.paid ? "已繳" : "未繳"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditIncome(index)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="編輯"
                        >
                          <span className="material-icons text-lg">edit</span>
                        </button>
                        {row.id && (
                          <button
                            onClick={() => deleteRecord(row.id!)}
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
                  <td colSpan={7} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    {searchTerm ? "沒有符合條件的收入記錄" : "目前沒有收入記錄"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  const renderExpenseTable = () => {
    const filteredExpenses = expenses.filter((row) => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        row.item?.toLowerCase().includes(term) ||
        row.category?.toLowerCase().includes(term) ||
        row.vendor?.toLowerCase().includes(term) ||
        row.amount?.toString().includes(term)
      )
    })

    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-muted)]" />
            <Input
              placeholder="搜尋項目、類別、廠商或金額..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSearchTerm("")}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重新整理
            </Button>
            <Button onClick={handleAddExpense} className="bg-red-500 hover:bg-red-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              新增支出
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
            <thead>
              <tr className="bg-red-500/10">
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] rounded-tl-lg whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>日期</span><HelpHint title="支出日期欄" description="支出發生日期。" /></div></th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>項目</span><HelpHint title="支出項目欄" description="支出用途項目。" /></div></th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>類別</span><HelpHint title="支出類別欄" description="支出分類。" /></div></th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>廠商</span><HelpHint title="支出廠商欄" description="供應商或承包商。" /></div></th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>金額</span><HelpHint title="支出金額欄" description="單筆支出金額。" /></div></th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] rounded-tr-lg whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>操作</span><HelpHint title="支出操作欄" description="可編輯或刪除支出記錄。" /></div></th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((row, index) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--theme-bg-secondary)] transition-colors border-b border-[var(--theme-border)] last:border-0"
                  >
                    <td className="p-3 text-[var(--theme-text-primary)]">{row.date}</td>
                    <td className="p-3 text-[var(--theme-text-primary)] font-bold">{row.item}</td>
                    <td className="p-3 text-[var(--theme-text-secondary)]">
                      <span className="bg-[var(--theme-bg-secondary)] px-2 py-1 rounded text-xs">{row.category}</span>
                    </td>
                    <td className="p-3 text-[var(--theme-text-secondary)]">{row.vendor}</td>
                    <td className="p-3 text-red-500 font-bold">-${row.amount.toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditExpense(row.id)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="編輯"
                        >
                          <span className="material-icons text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(row.id)}
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
                  <td colSpan={6} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    {searchTerm ? "沒有符合條件的支出記錄" : "目前沒有支出記錄"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  const tabButtons = (
    <div className="overflow-x-auto">
      <div className="inline-flex bg-[var(--theme-bg-secondary)] p-1 rounded-lg border border-[var(--theme-border)] min-w-max">
        <button
          onClick={() => setActiveTab("income")}
          className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "income"
              ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] shadow-md"
              : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          }`}
        >
          <span className="material-icons text-sm">payments</span> 收費
        </button>
        <button
          onClick={() => setActiveTab("expense")}
          className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "expense"
              ? "bg-red-500 text-white shadow-md"
              : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          }`}
        >
          <span className="material-icons text-sm">shopping_cart</span> 支出
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "report"
              ? "bg-[var(--theme-text-primary)] text-[var(--theme-bg-primary)] shadow-md"
              : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          }`}
        >
          <span className="material-icons text-sm">analytics</span> 報表
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5 min-h-[600px]">
      {/* Header & Tabs */}
      <div className="mb-6">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold">
          <span className="material-icons">account_balance</span>
          財務管理
          <HelpHint
            title="管理端財務管理"
            description="可管理收費、支出與報表。建議維持資料即時更新，確保住戶端資訊與報表一致。"
            workflow={[
              "依需求切換收費、支出或報表分頁。",
              "在收費/支出分頁維護明細資料。",
              "到報表分頁檢查整體財務結果。",
            ]}
            logic={[
              "財務資料互相連動，明細更新會同步反映在報表。",
            ]}
          />
        </h2>
      </div>

      {/* === 1. INCOME TAB === */}
      {activeTab === "income" && (
        <div className="animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-3">
              {tabButtons}
              <div className="flex items-center gap-2">
                <span className="text-[var(--theme-text-primary)] text-sm">收費管理</span>
                <HelpHint
                  title="管理端收費管理"
                  description="建立住戶應繳資料與狀態更新，作為催繳與對帳依據。"
                  workflow={[
                    "先新增或搜尋目標收費記錄。",
                    "更新狀態與到期日後儲存。",
                    "回列表確認資料與標籤正確。",
                  ]}
                  logic={[
                    "收費資料是住戶端帳單與提醒來源。",
                  ]}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--theme-text-primary)] text-sm">搜尋收入</span>
                <HelpHint title="管理端收入搜尋" description="可依房號、單號或金額快速找出收費資料。" workflow={["輸入房號、單號或金額關鍵字。","從過濾後列表執行編輯或刪除。","無結果時調整條件再查詢。"]} logic={["搜尋僅過濾顯示，不會改變記錄內容。"]} />
              </div>
            </div>
          </div>
          {renderIncomeTable()}
        </div>
      )}
      {/* === 2. EXPENSE TAB === */}
      {activeTab === "expense" && (
        <div className="animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-3">
              {tabButtons}
              <div className="flex items-center gap-2">
                <span className="text-[var(--theme-text-primary)] text-sm">支出管理</span>
                <HelpHint
                  title="管理端支出管理"
                  description="維護社區支出明細，作為報表與年度預算檢討資料。"
                  workflow={[
                    "新增或搜尋既有支出記錄。",
                    "完成編輯後儲存更新。",
                    "到報表分頁確認支出分析變化。",
                  ]}
                  logic={[
                    "支出分頁明細會直接影響報表損益與類別占比。",
                  ]}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--theme-text-primary)] text-sm">搜尋支出</span>
                <HelpHint title="管理端支出搜尋" description="可依項目、類別、廠商或金額快速查找支出資料。" workflow={["輸入項目、類別、廠商或金額關鍵字。","定位目標後執行編輯或刪除。","無結果時清空關鍵字回看全部資料。"]} logic={["搜尋僅影響顯示，不會修改支出資料。"]} />
              </div>
            </div>
          </div>
          {renderExpenseTable()}
        </div>
      )}

      {/* === 3. REPORTS TAB === */}
      {activeTab === "report" && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {tabButtons}
            <div className="flex items-center gap-2">
              <span className="text-[var(--theme-text-primary)] text-sm">報表管理</span>
              <HelpHint
                title="管理端財務報表"
                description="整合收入與支出形成損益與類別分析，可作為管委會決策依據。"
                workflow={[
                  "先看收入、支出與損益總覽。",
                  "再查看支出類別分析與資產概況。",
                  "依結果回到收費或支出分頁調整策略。",
                ]}
                logic={[
                  "報表為決策視角，明細異常應回來源分頁修正。",
                ]}
              />
            </div>
          </div>
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Income */}
            <div className="p-6 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-icons text-6xl">payments</span>
              </div>
              <div className="text-[var(--theme-text-primary)] font-bold mb-1">總收入</div>
              <div className="text-3xl font-bold text-[var(--theme-text-primary)] mb-2 tracking-tight">
                +${reportData.totalIncome.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--theme-text-muted)]">來自管理費收入</div>
            </div>

            {/* Total Expenses */}
            <div className="p-6 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-icons text-6xl text-red-500">trending_down</span>
              </div>
              <div className="text-red-400 font-bold mb-1">總支出</div>
              <div className="text-3xl font-bold text-[var(--theme-text-primary)] mb-2 tracking-tight">
                -${reportData.totalExpense.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--theme-text-muted)]">維護、人事、行政費用</div>
            </div>

            {/* Net Income */}
            <div className="p-6 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-icons text-6xl text-blue-500">account_balance_wallet</span>
              </div>
              <div className="text-[var(--theme-text-primary)] font-bold mb-1">本期損益</div>
              <div
                className={`text-3xl font-bold mb-2 tracking-tight ${reportData.netIncome >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                ${reportData.netIncome.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Bottom Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Expenditure Analysis */}
            <div className="p-5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)]">
              <h3 className="flex items-center gap-2 text-[var(--theme-text-primary)] font-bold mb-6">
                <span className="material-icons text-red-500 text-lg">pie_chart</span>
                支出類別分析
              </h3>
              <div className="space-y-6">
                {reportData.categoryAnalysis.length > 0 ? (
                  reportData.categoryAnalysis.map((cat, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm text-[var(--theme-text-primary)] mb-2">
                        <span>{cat.name}</span>
                        <span className="font-bold">${cat.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-[var(--theme-bg-primary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${cat.percent}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-[var(--theme-text-secondary)] py-8">暫無支出數據</div>
                )}
              </div>
            </div>

            {/* Right: Assets Overview */}
            <div className="p-5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)]">
              <h3 className="flex items-center gap-2 text-[var(--theme-text-primary)] font-bold mb-6">
                <span className="material-icons text-[var(--theme-accent)] text-lg">account_balance</span>
                資產概況
              </h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-primary)] font-medium">銀行存款</span>
                  <span className="text-[var(--theme-text-primary)] font-bold text-lg">$ 2,681,720</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-primary)] font-medium">定存</span>
                  <span className="text-[var(--theme-text-primary)] font-bold text-lg">$ 36,000,000</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-[var(--theme-text-muted)]">資產總計</span>
                  <span className="text-[var(--theme-accent)] font-bold text-xl">$ 38,690,354</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <FinanceFormModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        formData={incomeFormData}
        onChange={(f, v) => setIncomeFormData((prev) => ({ ...prev, [f]: v }))}
        onSave={handleSaveIncome}
        isEditing={incomeEditingIndex !== null}
      />

      <ExpenseFormModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        formData={expenseFormData}
        onChange={(f, v) => setExpenseFormData((prev) => ({ ...prev, [f]: v }))}
        onSave={handleSaveExpense}
        isEditing={expenseEditingId !== null}
      />
    </div>
  )
}
