"use client"

import { useFinanceAdmin } from "../hooks/useFinance"

export function FinanceManagementAdmin() {
  const { records, loading, updateRow, addRow, saveRecord, removeRecord } = useFinanceAdmin()

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ffd700]"></div>
      </div>
    )
  }

  return (
    <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex gap-2 items-center text-[#ffd700] text-xl">
          <span className="material-icons">account_balance</span>
          管理費/收支管理
        </h2>
        <button
          onClick={addRow}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-[#ffd700] text-[#ffd700] bg-transparent hover:bg-[#ffd700]/10 transition-all"
        >
          <span className="material-icons text-sm">add</span>
          新增
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-white">
          <thead>
            <tr>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">金額</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">到期日</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">發票</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">已繳</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((row, index) => (
                <tr key={row.id || `new-${index}`} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="text"
                      value={row.room || ""}
                      onChange={(e) => updateRow(index, "room", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="number"
                      value={row.amount || 0}
                      onChange={(e) => updateRow(index, "amount", Number(e.target.value))}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="date"
                      value={row.due ? row.due.split("T")[0] : ""}
                      onChange={(e) => updateRow(index, "due", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="text"
                      value={row.invoice || ""}
                      onChange={(e) => updateRow(index, "invoice", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <select
                      value={String(row.paid)}
                      onChange={(e) => updateRow(index, "paid", e.target.value === "true")}
                      className="w-full p-2 bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    >
                      <option value="true">已繳</option>
                      <option value="false">未繳</option>
                    </select>
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRecord(row, index)}
                        className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-yellow-400 text-yellow-300 bg-transparent hover:bg-yellow-400/15 transition-all"
                      >
                        儲存
                      </button>
                      {row.id && (
                        <button
                          onClick={() => removeRecord(row.id)}
                          className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-rose-400 text-rose-300 bg-transparent hover:bg-rose-400/15 transition-all"
                        >
                          刪除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#b0b0b0]">
                  目前沒有財務記錄
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
