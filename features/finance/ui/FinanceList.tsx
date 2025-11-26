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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ffd700]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {records.length > 0 ? (
        records.map((finance) => (
          <div
            key={finance.id}
            className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex gap-2 items-center mb-1">
                  <span className="text-white font-bold">房號: {finance.room}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      finance.paid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {finance.paid ? "已繳" : "未繳"}
                  </span>
                </div>
                {finance.invoice && <div className="text-[#b0b0b0] text-sm">發票: {finance.invoice}</div>}
                {finance.note && <div className="text-[#b0b0b0] text-sm">{finance.note}</div>}
                <div className="text-[#b0b0b0] text-sm mt-1">
                  到期日: {new Date(finance.due).toLocaleDateString("zh-TW")}
                </div>
              </div>
              <div className={`text-xl font-bold ${finance.paid ? "text-green-400" : "text-red-400"}`}>
                ${finance.amount.toLocaleString()}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-[#b0b0b0] py-8">目前沒有財務記錄</div>
      )}
    </div>
  )
}
