"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface Vote {
  id: string | null
  title: string
  description: string
  options: string
  author: string
  status: string
  ends_at: string
}

interface VoteManagementAdminProps {
  currentUserName?: string
}

export function VoteManagementAdmin({ currentUserName }: VoteManagementAdminProps) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)

  const loadVotes = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from("votes").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading votes:", error)
    } else {
      setVotes(
        (data || []).map((v) => ({
          ...v,
          options: typeof v.options === "string" ? v.options : JSON.stringify(v.options),
        }))
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    loadVotes()
  }, [])

  const handleAdd = () => {
    const newVote: Vote = {
      id: null,
      title: "",
      description: "",
      options: '["同意","反對","棄權"]',
      author: currentUserName || "",
      status: "active",
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    }
    setVotes([newVote, ...votes])
  }

  const updateVote = (index: number, field: keyof Vote, value: string) => {
    const updated = [...votes]
    updated[index] = { ...updated[index], [field]: value }
    setVotes(updated)
  }

  const handleSave = async (vote: Vote, index: number) => {
    try {
      const supabase = getSupabaseClient()
      let parsedOptions
      try {
        parsedOptions = JSON.parse(vote.options)
      } catch {
        parsedOptions = vote.options.split(",").map((s) => s.trim())
      }

      const voteData = {
        title: vote.title,
        description: vote.description,
        options: parsedOptions,
        author: vote.author,
        status: vote.status,
        ends_at: vote.ends_at,
      }

      if (vote.id) {
        const { error } = await supabase.from("votes").update(voteData).eq("id", vote.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("votes").insert([voteData]).select().single()
        if (error) throw error
        const updated = [...votes]
        updated[index] = { ...vote, id: data.id, options: JSON.stringify(data.options) }
        setVotes(updated)
      }

      alert("儲存成功！")
      await loadVotes()
    } catch (e: any) {
      console.error(e)
      alert("儲存失敗：" + e.message)
    }
  }

  const handleDelete = async (id: string | null) => {
    if (!id) {
      setVotes(votes.filter((v) => v.id !== null))
      return
    }

    if (!confirm("確定要刪除此投票？")) return

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from("votes").delete().eq("id", id)
      if (error) throw error

      alert("刪除成功！")
      await loadVotes()
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
        <h3 className="text-white font-bold">投票管理</h3>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-[#ffd700] text-[#1a1a1a] rounded-lg font-bold hover:bg-[#ffed4e] transition-all"
        >
          + 新增投票
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">標題</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">說明</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">選項(JSON)</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">發起人</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">截止時間</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((vote, index) => (
              <tr key={vote.id || `new-${index}`} className="hover:bg-white/5">
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={vote.title}
                    onChange={(e) => updateVote(index, "title", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <textarea
                    value={vote.description}
                    onChange={(e) => updateVote(index, "description", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <textarea
                    value={vote.options}
                    onChange={(e) => updateVote(index, "options", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={vote.author}
                    onChange={(e) => updateVote(index, "author", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="date"
                    value={vote.ends_at ? vote.ends_at.split("T")[0] : ""}
                    onChange={(e) => updateVote(index, "ends_at", e.target.value)}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <select
                    value={vote.status}
                    onChange={(e) => updateVote(index, "status", e.target.value)}
                    className="w-full p-2 bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  >
                    <option value="active">進行中</option>
                    <option value="closed">已結束</option>
                  </select>
                </td>
                <td className="p-3 border-b border-white/5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(vote, index)}
                      className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-yellow-400 text-yellow-300 bg-transparent hover:bg-yellow-400/15 transition-all"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => handleDelete(vote.id)}
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

      {votes.length === 0 && <div className="text-center text-[#b0b0b0] py-8">目前沒有投票</div>}
    </div>
  )
}
