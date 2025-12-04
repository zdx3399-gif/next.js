"use client"

import { useFinance } from "../hooks/useFinance"

interface FinanceListProps {
  userRoom?: string
}

export function FinanceList({ userRoom }: FinanceListProps) {
  const { records, loading } = useFinance(userRoom)

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      
      {records.length > 0 ? (
        records.map((finance) => (
          <div
            key={finance.id}
            className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex gap-2 items-center mb-1">
                  <span className="text-[var(--theme-text-primary)] font-bold">房號: {finance.room}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      finance.paid ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                    }`}
                  >
                    {finance.paid ? "已繳" : "未繳"}
                  </span>
                </div>
                {finance.invoice && (
                  <div className="text-[var(--theme-text-muted)] text-sm">發票: {finance.invoice}</div>
                )}
                {finance.note && <div className="text-[var(--theme-text-muted)] text-sm">{finance.note}</div>}
                <div className="text-[var(--theme-text-muted)] text-sm mt-1">
                  到期日: {new Date(finance.due).toLocaleDateString("zh-TW")}
                </div>
              </div>
              <div className={`text-xl font-bold ${finance.paid ? "text-green-500" : "text-red-500"}`}>
                ${finance.amount.toLocaleString()}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-[var(--theme-text-muted)] py-8">目前沒有財務記錄</div>
      )}
    </div>
  )
}
