"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface MaintenanceRow {
  id: string | null
  equipment: string
  item: string
  description: string
  reported_by: string
  photo_url: string | null
  status: string
  handler: string
  cost: number
}

export function MaintenanceManagementAdmin() {
  const [data, setData] = useState<MaintenanceRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data: maintenanceData, error } = await supabase
      .from("maintenance")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading maintenance:", error)
    } else {
      setData(maintenanceData || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = () => {
    const newRow: MaintenanceRow = {
      id: null,
      equipment: "",
      item: "",
      description: "",
      reported_by: "",
      photo_url: null,
      status: "open",
      handler: "",
      cost: 0,
    }
    setData([newRow, ...data])
  }

  const updateRow = (index: number, field: keyof MaintenanceRow, value: any) => {
    const updated = [...data]
    updated[index] = { ...updated[index], [field]: value }
    setData(updated)
  }

  const handleSave = async (row: MaintenanceRow, index: number) => {
    try {
      const supabase = getSupabaseClient()
      const saveData = {
        equipment: row.equipment,
        item: row.item,
        description: row.description,
        reported_by: row.reported_by,
        status: row.status,
        handler: row.handler,
        cost: row.cost,
      }

      if (row.id) {
        const { error } = await supabase.from("maintenance").update(saveData).eq("id", row.id)
        if (error) throw error
      } else {
        const { data: newData, error } = await supabase.from("maintenance").insert([saveData]).select().single()
        if (error) throw error
        const updated = [...data]
        updated[index] = { ...row, id: newData.id }
        setData(updated)
      }

      alert("儲存成功！")
      await loadData()
    } catch (e: any) {
      console.error(e)
      alert("儲存失敗：" + e.message)
    }
  }

  const handleDelete = async (id: string | null) => {
    if (!id) {
      setData(data.filter((d) => d.id !== null))
      return
    }

    if (!confirm("確定要刪除此維修紀錄？")) return

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from("maintenance").delete().eq("id", id)
      if (error) throw error

      alert("刪除成功！")
      await loadData()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd700]"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold">設備/維護管理</h3>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-[#ffd700] text-[#1a1a1a] rounded-lg font-bold hover:bg-[#ffed4e] transition-all"
        >
          + 新增紀錄
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">設備</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">項目</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">描述</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">報修人</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">照片</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">處理人</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">費用</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={row.id || `new-${index}`} className="hover:bg-white/5 transition-colors">
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={row.equipment || ""}
                    onChange={(e) => updateRow(index, "equipment", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={row.item || ""}
                    onChange={(e) => updateRow(index, "item", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <textarea
                    value={row.description || ""}
                    onChange={(e) => updateRow(index, "description", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={row.reported_by || ""}
                    onChange={(e) => updateRow(index, "reported_by", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  {row.photo_url && (
                    <img
                      src={row.photo_url || "/placeholder.svg"}
                      alt="維修照片"
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                </td>
                <td className="p-3 border-b border-white/5">
                  <select
                    value={row.status || "open"}
                    onChange={(e) => updateRow(index, "status", e.target.value)}
                    className="w-full p-2 bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  >
                    <option value="open">待處理</option>
                    <option value="progress">處理中</option>
                    <option value="done">已完成</option>
                  </select>
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={row.handler || ""}
                    onChange={(e) => updateRow(index, "handler", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="number"
                    value={row.cost || 0}
                    onChange={(e) => updateRow(index, "cost", Number(e.target.value))}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(row, index)}
                      className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-yellow-400 text-yellow-300 bg-transparent hover:bg-yellow-400/15 transition-all"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-rose-400 text-rose-300 bg-transparent hover:bg-rose-400/15 transition-all"
                    >
                      刪除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && <div className="text-center text-[#b0b0b0] py-8">目前沒有維修紀錄</div>}
    </div>
  )
}
