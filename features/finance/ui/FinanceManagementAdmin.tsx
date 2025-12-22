"use client"

import { useState, useEffect, useMemo } from "react"
import { useFinanceAdmin } from "../hooks/useFinance"
import { getSupabaseClient } from "@/lib/supabase"

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
          <h3 className="text-lg font-bold text-[var(--theme-accent)]">
            {isEditing ? "編輯收入記錄" : "新增收入記錄"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">房號</label>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
              每月管理費 <span className="text-xs text-[var(--theme-text-secondary)]">(將更新該房號的管理費設定)</span>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">總金額</label>
            <input
              type="number"
              value={formData.amount || 0}
              onChange={(e) => onChange("amount", Number(e.target.value))}
              className="w-full p-3 rounded-xl theme-input outline-none font-bold text-lg"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">到期日</label>
            <input
              type="date"
              value={formData.due ? formData.due.split("T")[0] : ""}
              onChange={(e) => onChange("due", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">發票/收據</label>
            <input
              type="text"
              value={formData.invoice || ""}
              onChange={(e) => onChange("invoice", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">狀態</label>
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
          <h3 className="text-lg font-bold text-red-500">{isEditing ? "編輯支出記錄" : "新增支出記錄"}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">日期</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => onChange("date", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">項目名稱</label>
            <input
              type="text"
              value={formData.item}
              onChange={(e) => onChange("item", e.target.value)}
              placeholder="例如：電梯保養"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">類別</label>
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
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">廠商</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => onChange("vendor", e.target.value)}
              placeholder="廠商名稱"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">金額 (支出)</label>
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

// --- Main Component ---
export function FinanceManagementAdmin() {
  const { records, saveRecord, deleteRecord, updateRecord, loading } = useFinanceAdmin()
  const [activeTab, setActiveTab] = useState<TabType>("income")
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES)
  const [searchTerm, setSearchTerm] = useState("")

  // Income State
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [incomeEditingIndex, setIncomeEditingIndex] = useState<number | null>(null)
  const [incomeFormData, setIncomeFormData] = useState<FinanceRecord>({
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
      const success = await saveRecord({ ...incomeFormData, id: undefined } as any, records.length)
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
        <div className="mb-4">
          <input
            type="text"
            placeholder="搜尋房號、單號或金額..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 rounded-xl theme-input outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] rounded-tl-lg">
                  房號
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">金額</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                  到期日
                </th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">發票</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)]">狀態</th>
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] rounded-tr-lg">
                  操作
                </th>
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
        <div className="mb-4">
          <input
            type="text"
            placeholder="搜尋項目、類別、廠商或金額..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 rounded-xl theme-input outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-red-500/10">
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] rounded-tl-lg">日期</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)]">項目</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)]">類別</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)]">廠商</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)]">金額</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] rounded-tr-lg">操作</th>
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

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5 min-h-[600px]">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold">
          <span className="material-icons">account_balance</span>
          財務管理
        </h2>

        {/* TAB BUTTONS */}
        <div className="flex bg-[var(--theme-bg-secondary)] p-1 rounded-lg border border-[var(--theme-border)]">
          <button
            onClick={() => setActiveTab("income")}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "income"
                ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] shadow-md"
                : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            <span className="material-icons text-sm">payments</span> 收費
          </button>
          <button
            onClick={() => setActiveTab("expense")}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "expense"
                ? "bg-red-500 text-white shadow-md"
                : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            <span className="material-icons text-sm">shopping_cart</span> 支出
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "report"
                ? "bg-[var(--theme-text-primary)] text-[var(--theme-bg-primary)] shadow-md"
                : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            <span className="material-icons text-sm">analytics</span> 報表
          </button>
        </div>
      </div>

      {/* === 1. INCOME TAB === */}
      {activeTab === "income" && (
        <div className="animate-fadeIn">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleAddIncome}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--theme-btn-add-border)] text-[var(--theme-btn-add-text)] hover:bg-[var(--theme-btn-add-hover)] transition-all"
            >
              <span className="material-icons text-sm">add</span>
              新增一筆
            </button>
          </div>
          {renderIncomeTable()}
        </div>
      )}

      {/* === 2. EXPENSE TAB === */}
      {activeTab === "expense" && (
        <div className="animate-fadeIn">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleAddExpense}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all"
            >
              <span className="material-icons text-sm">add</span>
              新增支出
            </button>
          </div>
          {renderExpenseTable()}
        </div>
      )}

      {/* === 3. REPORTS TAB === */}
      {activeTab === "report" && (
        <div className="animate-fadeIn space-y-6">
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
