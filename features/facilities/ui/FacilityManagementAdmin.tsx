"use client"

import { useFacilitiesAdmin } from "../hooks/useFacilities"

export function FacilityManagementAdmin() {
  const {
    facilities,
    bookings,
    loading,
    imageFiles,
    updateRow,
    handleImageFileChange,
    handleSave,
    handleDelete,
    addNewFacility,
  } = useFacilitiesAdmin()

  const onSave = async (facility: any, index: number) => {
    const result = await handleSave(facility, index)
    alert(result.message)
  }

  const onDelete = async (id: string) => {
    const result = await handleDelete(id)
    if (result.success) {
      alert(result.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[#ffd700]">載入中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Facilities Management Table */}
      <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-5">
          <h2 className="flex gap-2 items-center text-[#ffd700] text-xl">
            <span className="material-icons">meeting_room</span>
            設施管理
          </h2>
          <button
            onClick={addNewFacility}
            className="px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
          >
            新增設施
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white/5">
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">設施名稱</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">說明</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">位置</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">容納人數</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">圖片</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((facility, index) => (
                <tr key={facility.id || index} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="text"
                      value={facility.name || ""}
                      onChange={(e) => updateRow(index, "name", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <textarea
                      value={facility.description || ""}
                      onChange={(e) => updateRow(index, "description", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="text"
                      value={facility.location || ""}
                      onChange={(e) => updateRow(index, "location", e.target.value)}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <input
                      type="number"
                      value={facility.capacity || 1}
                      onChange={(e) => updateRow(index, "capacity", Number(e.target.value))}
                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    />
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileChange(index, e.target.files?.[0] || null)}
                        className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white text-sm outline-none focus:border-[#ffd700]"
                      />
                      {imageFiles[index] && (
                        <div className="text-green-400 text-xs">已選擇: {imageFiles[index]!.name}</div>
                      )}
                      {facility.image_url && !imageFiles[index] && (
                        <div className="text-[#b0b0b0] text-xs truncate">
                          目前: {facility.image_url.substring(0, 30)}...
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <select
                      value={String(facility.available)}
                      onChange={(e) => updateRow(index, "available", e.target.value === "true")}
                      className="w-full p-2 bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                    >
                      <option value="true">可用</option>
                      <option value="false">不可用</option>
                    </select>
                  </td>
                  <td className="p-3 border-b border-white/5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSave(facility, index)}
                        className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-yellow-400 text-yellow-300 bg-transparent hover:bg-yellow-400/15 transition-all"
                      >
                        儲存
                      </button>
                      {facility.id && (
                        <button
                          onClick={() => onDelete(facility.id)}
                          className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-rose-400 text-rose-300 bg-transparent hover:bg-rose-400/15 transition-all"
                        >
                          刪除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {facilities.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#b0b0b0]">
                    目前沒有設施資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
        <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
          <span className="material-icons">event</span>
          預約紀錄
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white/5">
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">設施</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">預約人</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">日期</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">時間</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">備註</th>
                <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 border-b border-white/5 text-white">{booking.facilities?.name || "未知設施"}</td>
                  <td className="p-3 border-b border-white/5 text-white">{booking.user_name}</td>
                  <td className="p-3 border-b border-white/5 text-white">{booking.user_room || "-"}</td>
                  <td className="p-3 border-b border-white/5 text-white">
                    {new Date(booking.booking_date).toLocaleDateString("zh-TW")}
                  </td>
                  <td className="p-3 border-b border-white/5 text-white">
                    {booking.start_time} - {booking.end_time}
                  </td>
                  <td className="p-3 border-b border-white/5 text-[#b0b0b0]">{booking.notes || "-"}</td>
                  <td className="p-3 border-b border-white/5">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        booking.status === "confirmed" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {booking.status === "confirmed" ? "已確認" : "已取消"}
                    </span>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#b0b0b0]">
                    目前沒有預約紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
