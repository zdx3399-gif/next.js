"use client"

import { useResidents } from "../hooks/useResidents"
import type { Resident } from "../api/residents"

const getRelationshipLabel = (relationship?: string): string => {
  const labels: Record<string, string> = {
    owner: "戶主",
    household_member: "住戶成員",
    tenant: "租客",
  }
  return labels[relationship || "household_member"] || "住戶成員"
}

export function ResidentManagementAdmin() {
  const { residents, loading, addNewRow, updateRow, handleSave, handleDelete } = useResidents()

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd700]"></div>
      </div>
    )
  }

  return (
    <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex gap-2 items-center text-[#ffd700] text-xl">
          <span className="material-icons">people</span>
          住戶/人員管理
        </h2>
        <button
          onClick={addNewRow}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-green-400 text-green-300 bg-transparent hover:bg-green-400/15 transition-all"
        >
          <span className="material-icons text-sm">add</span>
          新增一筆
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white/5">
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">姓名</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">電話</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">Email</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">身分</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">關係</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
            </tr>
          </thead>
          <tbody>
            {residents.length > 0 ? (
              residents.map((row: Resident, index: number) => (
                <tr key={row.id || `new-${index}`} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="text"
                      value={row.name || ""}
                      onChange={(e) => updateRow(index, "name", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
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
                      type="text"
                      value={row.phone || ""}
                      onChange={(e) => updateRow(index, "phone", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="email"
                      value={row.email || ""}
                      onChange={(e) => updateRow(index, "email", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <select
                      value={row.role || "resident"}
                      onChange={(e) => updateRow(index, "role", e.target.value)}
                      className="w-full p-2 bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    >
                      <option value="resident">住戶</option>
                      <option value="committee">管委會</option>
                      <option value="guard">警衛</option>
                      <option value="admin">管理員</option>
                    </select>
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <select
                      value={row.relationship || "household_member"}
                      onChange={(e) => updateRow(index, "relationship", e.target.value)}
                      className="w-full p-2 bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700] cursor-pointer [&>option]:bg-[#2a2a2a] [&>option]:text-white"
                    >
                      <option value="owner">戶主</option>
                      <option value="household_member">住戶成員</option>
                      <option value="tenant">租客</option>
                    </select>
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(row, index)}
                        className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-yellow-400 text-yellow-300 bg-transparent hover:bg-yellow-400/15 transition-all"
                      >
                        儲存
                      </button>
                      {row.id && (
                        <button
                          onClick={() => handleDelete(row.id!)}
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
                <td colSpan={7} className="p-8 text-center text-[#b0b0b0]">
                  目前沒有資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
