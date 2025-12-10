"use client"

import { useState } from "react"
import { useFinance } from "../hooks/useFinance"

interface ExpenseRecord {
  id: string
  date: string
  item: string
  category: string
  amount: number
  vendor: string
  note?: string
}

const INITIAL_EXPENSES: ExpenseRecord[] = [
  { id: "1", date: "2025-11-28", item: "大廳燈泡更換", category: "維護費", amount: 12321, vendor: "水电行" },
  { id: "2", date: "2025-11-28", item: "電梯保養 (11月)", category: "維護費", amount: 9000, vendor: "迅達電梯" },
  { id: "3", date: "2025-11-27", item: "外牆清洗", category: "清潔費", amount: 10000, vendor: "潔淨公司" },
  { id: "4", date: "2025-11-26", item: "管理員薪資", category: "人事費", amount: 3000, vendor: "-" },
]

type TabType = "income" | "expense" | "report"

interface FinanceListProps {
  userRoom?: string
}

export function FinanceList({ userRoom }: FinanceListProps) {
  const { records, loading } = useFinance(userRoom)
  const [activeTab, setActiveTab] = useState<TabType>("income")
  const [expenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES)

  const reportData = {
    totalIncome: records.reduce((sum, r) => sum + (r.amount || 0), 0),
    totalExpense: expenses.reduce((sum, e) => sum + e.amount, 0),
    get netIncome() {
      return this.totalIncome - this.totalExpense
    },
    categoryAnalysis: (() => {
      const categories: Record<string, number> = {}
      expenses.forEach((e) => {
        categories[e.category] = (categories[e.category] || 0) + e.amount
      })
      const total = Object.values(categories).reduce((a, b) => a + b, 0)
      return Object.entries(categories).map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
    })(),
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold">
          <span className="material-icons">account_balance</span>
          管理費/收支
        </h2>

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

      {/* Income Tab - Read Only */}
      {activeTab === "income" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
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
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] rounded-tr-lg">
                  狀態
                </th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((row, index) => (
                  <tr
                    key={row.id || `income-${index}`}
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    目前沒有財務記錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense Tab - Read Only */}
      {activeTab === "expense" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-red-500/10">
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] rounded-tl-lg">日期</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)]">項目</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)]">類別</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)]">廠商</th>
                <th className="p-3 text-left text-red-500 border-b border-[var(--theme-border)] rounded-tr-lg">金額</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? (
                expenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-[var(--theme-bg-secondary)] transition-colors border-b border-[var(--theme-border)] last:border-0"
                  >
                    <td className="p-3 text-[var(--theme-text-primary)]">{exp.date}</td>
                    <td className="p-3 text-[var(--theme-text-primary)] font-bold">{exp.item}</td>
                    <td className="p-3 text-[var(--theme-text-secondary)]">
                      <span className="bg-[var(--theme-bg-secondary)] px-2 py-1 rounded text-xs">{exp.category}</span>
                    </td>
                    <td className="p-3 text-[var(--theme-text-secondary)]">{exp.vendor}</td>
                    <td className="p-3 text-red-500 font-bold">-${exp.amount.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--theme-text-secondary)]">
                    無支出記錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  )
}
