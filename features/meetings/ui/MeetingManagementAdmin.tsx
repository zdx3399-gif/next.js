"use client"

import { useState } from "react"
import { useMeetings } from "../hooks/useMeetings"
import type { Meeting } from "../api/meetings"

export function MeetingManagementAdmin() {
  const { meetings, loading, addMeeting, editMeeting, removeMeeting, reload } = useMeetings()
  const [editingRows, setEditingRows] = useState<Record<string, Meeting>>({})
  const [newRow, setNewRow] = useState<Omit<Meeting, "id" | "created_at"> | null>(null)

  const handleAddNew = () => {
    setNewRow({ topic: "", time: "", location: "", notes: "" })
  }

  const handleSaveNew = async () => {
    if (!newRow || !newRow.topic || !newRow.time) return
    const success = await addMeeting(newRow)
    if (success) {
      setNewRow(null)
    }
  }

  const handleCancelNew = () => {
    setNewRow(null)
  }

  const handleEdit = (meeting: Meeting) => {
    if (meeting.id) {
      setEditingRows((prev) => ({ ...prev, [meeting.id!]: { ...meeting } }))
    }
  }

  const handleSaveEdit = async (id: string) => {
    const editedMeeting = editingRows[id]
    if (!editedMeeting) return
    const success = await editMeeting(id, editedMeeting)
    if (success) {
      setEditingRows((prev) => {
        const newState = { ...prev }
        delete newState[id]
        return newState
      })
    }
  }

  const handleCancelEdit = (id: string) => {
    setEditingRows((prev) => {
      const newState = { ...prev }
      delete newState[id]
      return newState
    })
  }

  const handleDelete = async (id: string) => {
    if (confirm("確定要刪除此會議/活動嗎？")) {
      await removeMeeting(id)
    }
  }

  const updateEditingRow = (id: string, field: keyof Meeting, value: string) => {
    setEditingRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd700]"></div>
      </div>
    )
  }

  return (
    <div className="bg-[rgba(30,30,30,0.95)] border border-[rgba(255,215,0,0.15)] rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <h3 className="text-[#ffd700] font-bold">會議/活動管理</h3>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#ffd700] text-black hover:bg-[#ffed4a] transition-all"
        >
          新增會議
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5">
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">主題</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">時間</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">地點</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">備註</th>
              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
            </tr>
          </thead>
          <tbody>
            {newRow && (
              <tr className="bg-[#ffd700]/10">
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={newRow.topic}
                    onChange={(e) => setNewRow({ ...newRow, topic: e.target.value })}
                    placeholder="會議主題"
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="datetime-local"
                    value={newRow.time}
                    onChange={(e) => setNewRow({ ...newRow, time: e.target.value })}
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <input
                    type="text"
                    value={newRow.location}
                    onChange={(e) => setNewRow({ ...newRow, location: e.target.value })}
                    placeholder="地點"
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <textarea
                    value={newRow.notes || ""}
                    onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                    placeholder="備註"
                    className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                  />
                </td>
                <td className="p-3 border-b border-white/5">
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNew}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border border-green-400 text-green-300 hover:bg-green-400/15 transition-all"
                    >
                      儲存
                    </button>
                    <button
                      onClick={handleCancelNew}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border border-gray-400 text-gray-300 hover:bg-gray-400/15 transition-all"
                    >
                      取消
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {meetings.length > 0 ? (
              meetings.map((meeting) => {
                const isEditing = meeting.id && editingRows[meeting.id]
                const row = isEditing ? editingRows[meeting.id!] : meeting
                return (
                  <tr key={meeting.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 border-b border-white/5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={row.topic || ""}
                          onChange={(e) => updateEditingRow(meeting.id!, "topic", e.target.value)}
                          className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                        />
                      ) : (
                        <span className="text-white">{meeting.topic}</span>
                      )}
                    </td>
                    <td className="p-3 border-b border-white/5">
                      {isEditing ? (
                        <input
                          type="datetime-local"
                          value={row.time ? row.time.slice(0, 16) : ""}
                          onChange={(e) => updateEditingRow(meeting.id!, "time", e.target.value)}
                          className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                        />
                      ) : (
                        <span className="text-white">
                          {meeting.time ? new Date(meeting.time).toLocaleString("zh-TW") : ""}
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-b border-white/5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={row.location || ""}
                          onChange={(e) => updateEditingRow(meeting.id!, "location", e.target.value)}
                          className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                        />
                      ) : (
                        <span className="text-white">{meeting.location}</span>
                      )}
                    </td>
                    <td className="p-3 border-b border-white/5">
                      {isEditing ? (
                        <textarea
                          value={row.notes || ""}
                          onChange={(e) => updateEditingRow(meeting.id!, "notes", e.target.value)}
                          className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                        />
                      ) : (
                        <span className="text-white">{meeting.notes}</span>
                      )}
                    </td>
                    <td className="p-3 border-b border-white/5">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(meeting.id!)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-green-400 text-green-300 hover:bg-green-400/15 transition-all"
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => handleCancelEdit(meeting.id!)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-gray-400 text-gray-300 hover:bg-gray-400/15 transition-all"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(meeting)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-yellow-400 text-yellow-300 hover:bg-yellow-400/15 transition-all"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => handleDelete(meeting.id!)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-rose-400 text-rose-300 hover:bg-rose-400/15 transition-all"
                            >
                              刪除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[#b0b0b0]">
                  目前沒有會議/活動
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
