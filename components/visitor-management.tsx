"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { getSupabaseClient } from "@/lib/supabase"

interface Visitor {
  id: string
  name: string
  phone?: string
  room: string
  purpose?: string
  reservation_time?: string
  checked_in_at?: string
  checked_out_at?: string
  status: "reserved" | "checked_in" | "checked_out"
  reserved_by?: string
  created_at: string
}

interface VisitorManagementProps {
  userRoom?: string
  currentUser?: any
  isAdmin?: boolean
}

export function VisitorManagement({ userRoom, currentUser, isAdmin = false }: VisitorManagementProps) {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [reservedVisitors, setReservedVisitors] = useState<Visitor[]>([])
  const [checkedInVisitors, setCheckedInVisitors] = useState<Visitor[]>([])
  const [historyVisitors, setHistoryVisitors] = useState<Visitor[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [showReservationForm, setShowReservationForm] = useState(false)

  const [reservationForm, setReservationForm] = useState({
    name: "",
    phone: "",
    purpose: "",
    reservation_time: "",
  })

  useEffect(() => {
    loadVisitors()
  }, [userRoom, currentUser, isAdmin])

  useEffect(() => {
    filterVisitors()
  }, [visitors, searchTerm])

  const loadVisitors = async () => {
    if (!userRoom && !currentUser?.id && !isAdmin) return

    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      let query = supabase.from("visitors").select("*")

      // If resident, only show their room's visitors
      if (userRoom && !isAdmin) {
        query = query.eq("room", userRoom)
      }

      const { data, error } = await query.order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error loading visitors:", error)
        setVisitors([])
      } else {
        setVisitors(data || [])
      }
    } catch (e) {
      console.error("[v0] Failed to load visitors:", e)
      setVisitors([])
    } finally {
      setLoading(false)
    }
  }

  const filterVisitors = () => {
    let reserved = visitors.filter((v) => v.status === "reserved")
    let checkedIn = visitors.filter((v) => v.status === "checked_in")
    let history = visitors.filter((v) => v.status === "checked_out")

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchesTerm = (visitor: Visitor) =>
        visitor.name.toLowerCase().includes(term) ||
        visitor.room.toLowerCase().includes(term) ||
        visitor.phone?.toLowerCase().includes(term)

      reserved = reserved.filter(matchesTerm)
      checkedIn = checkedIn.filter(matchesTerm)
      history = history.filter(matchesTerm)
    }

    setReservedVisitors(reserved)
    setCheckedInVisitors(checkedIn)
    setHistoryVisitors(history)
  }

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) {
      alert("請先登入")
      return
    }

    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase.from("visitors").insert([
        {
          name: reservationForm.name,
          phone: reservationForm.phone,
          room: currentUser.room || userRoom,
          purpose: reservationForm.purpose,
          reservation_time: reservationForm.reservation_time,
          status: "reserved",
          reserved_by: currentUser.name,
        },
      ])

      if (error) throw error

      alert("訪客預約成功！")
      setReservationForm({
        name: "",
        phone: "",
        purpose: "",
        reservation_time: "",
      })
      setShowReservationForm(false)
      await loadVisitors()
    } catch (e: any) {
      console.error("[v0] Error creating reservation:", e)
      alert("預約失敗：" + e.message)
    }
  }

  const handleCheckIn = async (visitorId: string) => {
    try {
      const supabase = getSupabaseClient()
      const checkedInTime = new Date().toISOString()

      const { error } = await supabase
        .from("visitors")
        .update({
          status: "checked_in",
          checked_in_at: checkedInTime,
        })
        .eq("id", visitorId)

      if (error) throw error

      alert("訪客已簽到")
      await loadVisitors()
    } catch (e: any) {
      console.error("[v0] Error checking in:", e)
      alert("簽到失敗：" + e.message)
    }
  }

  const handleCheckOut = async (visitorId: string) => {
    try {
      const supabase = getSupabaseClient()
      const checkedOutTime = new Date().toISOString()

      const { error } = await supabase
        .from("visitors")
        .update({
          status: "checked_out",
          checked_out_at: checkedOutTime,
        })
        .eq("id", visitorId)

      if (error) throw error

      alert("訪客已簽退")
      await loadVisitors()
    } catch (e: any) {
      console.error("[v0] Error checking out:", e)
      alert("簽退失敗：" + e.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      {isAdmin && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="搜尋訪客姓名、房號或電話..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white placeholder-white/50 outline-none focus:border-[#ffd700]"
          />
        </div>
      )}

      {/* Reservation Button */}
      {!isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowReservationForm(!showReservationForm)}
            className="px-4 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
          >
            {showReservationForm ? "取消預約" : "預約訪客"}
          </button>
        </div>
      )}

      {/* Reservation Form */}
      {showReservationForm && !isAdmin && (
        <div className="bg-white/5 border-2 border-[#ffd700]/30 rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-[#ffd700] font-bold text-lg mb-4">
            <span className="material-icons">person_add</span>
            預約訪客
          </h3>
          <form onSubmit={handleReservation} className="space-y-4">
            <div>
              <label className="block text-white mb-2">訪客姓名</label>
              <input
                type="text"
                value={reservationForm.name}
                onChange={(e) => setReservationForm({ ...reservationForm, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                required
              />
            </div>
            <div>
              <label className="block text-white mb-2">訪客電話</label>
              <input
                type="tel"
                value={reservationForm.phone}
                onChange={(e) => setReservationForm({ ...reservationForm, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
              />
            </div>
            <div>
              <label className="block text-white mb-2">來訪目的</label>
              <input
                type="text"
                value={reservationForm.purpose}
                onChange={(e) => setReservationForm({ ...reservationForm, purpose: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                placeholder="例如：親友拜訪、送貨等"
              />
            </div>
            <div>
              <label className="block text-white mb-2">預約時間</label>
              <input
                type="datetime-local"
                value={reservationForm.reservation_time}
                onChange={(e) => setReservationForm({ ...reservationForm, reservation_time: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
            >
              確認預約
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center text-[#b0b0b0] py-8">載入中...</div>
      ) : (
        <>
          {/* Reserved Visitors */}
          <div className="bg-white/5 border-2 border-blue-500/30 rounded-xl p-5">
            <h3 className="flex gap-2 items-center text-blue-400 font-bold text-lg mb-4">
              <span className="material-icons">event</span>
              預約訪客 ({reservedVisitors.length})
            </h3>
            <div className="space-y-3">
              {reservedVisitors.length > 0 ? (
                reservedVisitors.map((visitor) => (
                  <div
                    key={visitor.id}
                    className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-white font-bold text-lg">{visitor.name}</div>
                        <div className="text-[#b0b0b0] text-sm mt-1">拜訪房號: {visitor.room}</div>
                        {visitor.phone && <div className="text-[#b0b0b0] text-sm">電話: {visitor.phone}</div>}
                        {visitor.purpose && <div className="text-[#b0b0b0] text-sm">來訪目的: {visitor.purpose}</div>}
                        {visitor.reserved_by && (
                          <div className="text-[#b0b0b0] text-sm">預約人: {visitor.reserved_by}</div>
                        )}
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-blue-500/20 text-blue-400">
                        已預約
                      </div>
                    </div>
                    <div className="flex justify-between items-end gap-2">
                      {visitor.reservation_time && (
                        <div className="text-[#b0b0b0] text-sm">
                          預約時間: {new Date(visitor.reservation_time).toLocaleString("zh-TW")}
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleCheckIn(visitor.id)}
                          className="px-4 py-2 bg-[#4caf50] text-white rounded-lg text-sm font-bold hover:brightness-90 transition-all"
                        >
                          訪客簽到
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[#b0b0b0] py-6">
                  {searchTerm ? "沒有符合條件的預約訪客" : "目前沒有預約訪客"}
                </div>
              )}
            </div>
          </div>

          {/* Checked-In Visitors */}
          <div className="bg-white/5 border-2 border-yellow-500/30 rounded-xl p-5">
            <h3 className="flex gap-2 items-center text-yellow-400 font-bold text-lg mb-4">
              <span className="material-icons">how_to_reg</span>
              訪客中 ({checkedInVisitors.length})
            </h3>
            <div className="space-y-3">
              {checkedInVisitors.length > 0 ? (
                checkedInVisitors.map((visitor) => (
                  <div
                    key={visitor.id}
                    className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-white font-bold text-lg">{visitor.name}</div>
                        <div className="text-[#b0b0b0] text-sm mt-1">拜訪房號: {visitor.room}</div>
                        {visitor.phone && <div className="text-[#b0b0b0] text-sm">電話: {visitor.phone}</div>}
                        {visitor.purpose && <div className="text-[#b0b0b0] text-sm">來訪目的: {visitor.purpose}</div>}
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-yellow-500/20 text-yellow-400">
                        訪客中
                      </div>
                    </div>
                    <div className="flex justify-between items-end gap-2">
                      {visitor.checked_in_at && (
                        <div className="text-[#b0b0b0] text-sm">
                          簽到時間: {new Date(visitor.checked_in_at).toLocaleString("zh-TW")}
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleCheckOut(visitor.id)}
                          className="px-4 py-2 bg-[#f44336] text-white rounded-lg text-sm font-bold hover:brightness-90 transition-all"
                        >
                          訪客簽退
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[#b0b0b0] py-6">
                  {searchTerm ? "沒有符合條件的訪客" : "目前沒有訪客"}
                </div>
              )}
            </div>
          </div>

          {/* History Visitors */}
          <div className="bg-white/5 border-2 border-green-500/30 rounded-xl p-5">
            <h3 className="flex gap-2 items-center text-green-400 font-bold text-lg mb-4">
              <span className="material-icons">history</span>
              訪客歷史 ({historyVisitors.length})
            </h3>
            <div className="space-y-3">
              {historyVisitors.length > 0 ? (
                historyVisitors.map((visitor) => (
                  <div
                    key={visitor.id}
                    className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all opacity-75"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-white font-bold text-lg">{visitor.name}</div>
                        <div className="text-[#b0b0b0] text-sm mt-1">拜訪房號: {visitor.room}</div>
                        {visitor.phone && <div className="text-[#b0b0b0] text-sm">電話: {visitor.phone}</div>}
                        {visitor.purpose && <div className="text-[#b0b0b0] text-sm">來訪目的: {visitor.purpose}</div>}
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-green-500/20 text-green-400">
                        已離開
                      </div>
                    </div>
                    <div className="text-[#b0b0b0] text-sm space-y-1">
                      {visitor.checked_in_at && (
                        <div>簽到時間: {new Date(visitor.checked_in_at).toLocaleString("zh-TW")}</div>
                      )}
                      {visitor.checked_out_at && (
                        <div className="text-green-400">
                          簽退時間: {new Date(visitor.checked_out_at).toLocaleString("zh-TW")}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[#b0b0b0] py-6">
                  {searchTerm ? "沒有符合條件的訪客歷史" : "目前沒有訪客歷史"}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
