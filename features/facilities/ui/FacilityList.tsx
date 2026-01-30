"use client"
import { useState, useEffect } from "react"
import { useFacilities } from "../hooks/useFacilities"
import {
  getUserPointsInfo,
  generateTimeSlots,
  attemptBooking,
  cancelBookingWithRefund,
  checkIn,
  joinLottery,
  getUserPointsHistory,
  type UserPointsInfo,
  type TimeSlot,
  type PointsTransaction,
} from "../api/facilities"

interface FacilityListProps {
  userId?: string
  userName?: string
  userRoom?: string
}

export function FacilityList({ userId, userName, userRoom }: FacilityListProps) {
  const { facilities, myBookings, loading, reload } = useFacilities(userId)

  const [userPoints, setUserPoints] = useState<UserPointsInfo | null>(null)
  const [selectedFacility, setSelectedFacility] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [notes, setNotes] = useState("")
  const [showPointsHistory, setShowPointsHistory] = useState(false)
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([])
  const [lotteryBid, setLotteryBid] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<"booking" | "my-bookings" | "facilities">("booking")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredFacilities = facilities.filter((facility) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      facility.name.toLowerCase().includes(term) ||
      facility.description?.toLowerCase().includes(term) ||
      false ||
      facility.location?.toLowerCase().includes(term) ||
      false
    )
  })

  const filteredBookings = myBookings.filter((booking) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      booking.facilities?.name?.toLowerCase().includes(term) ||
      false ||
      booking.booking_date.includes(term) ||
      booking.status.toLowerCase().includes(term)
    )
  })

  useEffect(() => {
    if (userId) {
      getUserPointsInfo(userId).then(setUserPoints)
    }
  }, [userId])

  useEffect(() => {
    if (selectedFacility && selectedDate) {
      setLoadingSlots(true)
      generateTimeSlots(selectedFacility, selectedDate)
        .then(setTimeSlots)
        .finally(() => setLoadingSlots(false))
    }
  }, [selectedFacility, selectedDate])

  const loadPointsHistory = async () => {
    if (userId) {
      const history = await getUserPointsHistory(userId)
      setPointsHistory(history)
      setShowPointsHistory(true)
    }
  }

  const handleDirectBooking = async () => {
    if (!userId || !selectedSlot) return

    const result = await attemptBooking(userId, selectedFacility, selectedSlot.id, userName || "未知", userRoom, notes)

    alert(result.message)
    if (result.success) {
      setSelectedSlot(null)
      setNotes("")
      reload()
      getUserPointsInfo(userId).then(setUserPoints)
      generateTimeSlots(selectedFacility, selectedDate).then(setTimeSlots)
    }
  }

  const handleJoinLottery = async () => {
    if (!userId || !selectedSlot) return

    const result = await joinLottery(userId, selectedSlot.id, lotteryBid || selectedSlot.final_price || 10)
    alert(result.message)
    if (result.success) {
      setSelectedSlot(null)
      setLotteryBid(0)
    }
  }

  const handleCancel = async (bookingId: string) => {
    if (!userId) return
    if (!confirm("確定要取消此預約？")) return

    const result = await cancelBookingWithRefund(bookingId, userId)
    alert(result.message)
    if (result.success) {
      reload()
      getUserPointsInfo(userId).then(setUserPoints)
    }
  }

  const handleCheckIn = async (bookingId: string) => {
    if (!userId) return

    const result = await checkIn(bookingId, userId)
    alert(result.message)
    if (result.success) {
      reload()
    }
  }

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      confirmed: { color: "bg-green-500/20 text-green-500", text: "已確認" },
      cancelled: { color: "bg-red-500/20 text-red-500", text: "已取消" },
      completed: { color: "bg-blue-500/20 text-blue-500", text: "已完成" },
      no_show: { color: "bg-orange-500/20 text-orange-500", text: "未到場" },
      waitlist: { color: "bg-yellow-500/20 text-yellow-500", text: "候補中" },
      pending_lottery: { color: "bg-purple-500/20 text-purple-500", text: "抽籤中" },
    }
    return statusMap[status] || { color: "bg-gray-500/20 text-gray-500", text: status }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[var(--theme-accent)]">載入中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {userPoints && (
        <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[var(--theme-text-muted)] text-sm">點數餘額</div>
                <div className="text-2xl font-bold text-[var(--theme-accent)]">{userPoints.points_balance} 點</div>
              </div>
              <div className="h-10 w-px bg-[var(--theme-border)]" />
              <div>
                <div className="text-[var(--theme-text-muted)] text-sm">進行中預約</div>
                <div className="text-xl font-bold text-[var(--theme-text-primary)]">
                  {userPoints.active_bookings_count} / 2
                </div>
              </div>
              <div className="h-10 w-px bg-[var(--theme-border)]" />
              <div>
                <div className="text-[var(--theme-text-muted)] text-sm">帳號狀態</div>
                <div
                  className={`text-lg font-bold ${userPoints.booking_status === "active" ? "text-green-500" : "text-red-500"}`}
                >
                  {userPoints.booking_status === "active" ? "正常" : "停權中"}
                </div>
              </div>
            </div>
            <button
              onClick={loadPointsHistory}
              className="px-4 py-2 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all text-sm"
            >
              <span className="material-icons text-sm mr-1">history</span>
              點數紀錄
            </button>
          </div>
          {userPoints.penalty_count > 0 && (
            <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <span className="text-orange-500 text-sm">
                <span className="material-icons text-sm mr-1">warning</span>
                違規次數：{userPoints.penalty_count} 次（累計 3 次將被停權 30 天）
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 border-b border-[var(--theme-border)] pb-2">
        {[
          { key: "booking", label: "預約設施", icon: "add_circle" },
          { key: "my-bookings", label: "我的預約", icon: "list" },
          { key: "facilities", label: "設施總覽", icon: "meeting_room" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
                : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)]"
            }`}
          >
            <span className="material-icons text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "booking" && (
        <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
            <span className="material-icons">event_available</span>
            預約設施
          </h2>

          <div className="space-y-4 max-w-3xl">
            {/* 選擇設施 */}
            <div>
              <label className="block text-[var(--theme-text-primary)] mb-2 font-medium">選擇設施</label>
              <select
                value={selectedFacility}
                onChange={(e) => {
                  setSelectedFacility(e.target.value)
                  setSelectedSlot(null)
                }}
                className="theme-select w-full p-3 rounded-lg"
              >
                <option value="">請選擇設施</option>
                {filteredFacilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} - {facility.location || "無位置資訊"}
                    {facility.base_price ? ` (基礎 ${facility.base_price} 點)` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 選擇日期 */}
            <div>
              <label className="block text-[var(--theme-text-primary)] mb-2 font-medium">選擇日期</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setSelectedSlot(null)
                }}
                min={new Date().toISOString().split("T")[0]}
                max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                className="theme-input w-full p-3 rounded-lg"
              />
              <div className="text-[var(--theme-text-muted)] text-xs mt-1">可預約未來 14 天內的時段</div>
            </div>

            {/* 時段列表 */}
            {selectedFacility && selectedDate && (
              <div>
                <label className="block text-[var(--theme-text-primary)] mb-2 font-medium">選擇時段</label>
                {loadingSlots ? (
                  <div className="text-center py-4 text-[var(--theme-text-muted)]">載入時段中...</div>
                ) : timeSlots.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {timeSlots.map((slot) => {
                      const isSelected = selectedSlot?.id === slot.id
                      const isAvailable = slot.status === "OPEN"
                      const isLottery = slot.booking_type === "LOTTERY"

                      return (
                        <button
                          key={slot.id}
                          onClick={() => isAvailable && setSelectedSlot(slot)}
                          disabled={!isAvailable}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? "border-[var(--theme-accent)] bg-[var(--theme-accent)]/20"
                              : isAvailable
                                ? "border-[var(--theme-border)] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent-light)]"
                                : "border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="font-medium text-[var(--theme-text-primary)]">
                            {slot.start_time} - {slot.end_time}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-sm font-bold ${
                                slot.price_modifier > 1
                                  ? "text-orange-500"
                                  : slot.price_modifier < 1
                                    ? "text-green-500"
                                    : "text-[var(--theme-accent)]"
                              }`}
                            >
                              {slot.final_price} 點
                            </span>
                            {isLottery && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-500">
                                抽籤
                              </span>
                            )}
                            {slot.price_modifier < 1 && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">優惠</span>
                            )}
                            {slot.price_modifier > 1.5 && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500">
                                尖峰
                              </span>
                            )}
                          </div>
                          {!isAvailable && <div className="text-xs text-[var(--theme-text-muted)] mt-1">已預約</div>}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[var(--theme-text-muted)]">無可用時段</div>
                )}
              </div>
            )}

            {/* 選中時段的預約表單 */}
            {selectedSlot && (
              <div className="mt-4 p-4 bg-[var(--theme-bg-secondary)] rounded-lg border border-[var(--theme-accent)]">
                <h3 className="font-bold text-[var(--theme-accent)] mb-3">
                  確認預約：{selectedSlot.start_time} - {selectedSlot.end_time}
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--theme-text-muted)]">所需點數</span>
                    <span className="font-bold text-[var(--theme-accent)]">{selectedSlot.final_price} 點</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--theme-text-muted)]">預約後餘額</span>
                    <span className="font-bold text-[var(--theme-text-primary)]">
                      {(userPoints?.points_balance || 0) - (selectedSlot.final_price || 0)} 點
                    </span>
                  </div>

                  <div>
                    <label className="block text-[var(--theme-text-primary)] mb-1 text-sm">備註（選填）</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="theme-input w-full p-2 rounded-lg text-sm min-h-[60px]"
                      placeholder="請輸入備註事項"
                    />
                  </div>

                  {selectedSlot.booking_type === "LOTTERY" ? (
                    <div>
                      <label className="block text-[var(--theme-text-primary)] mb-1 text-sm">
                        抽籤投標點數（最低 {selectedSlot.final_price} 點）
                      </label>
                      <input
                        type="number"
                        value={lotteryBid || selectedSlot.final_price}
                        onChange={(e) => setLotteryBid(Number(e.target.value))}
                        min={selectedSlot.final_price}
                        max={userPoints?.points_balance || 0}
                        className="theme-input w-full p-2 rounded-lg text-sm"
                      />
                      <button
                        onClick={handleJoinLottery}
                        className="w-full mt-3 px-4 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all"
                      >
                        <span className="material-icons text-sm mr-1">casino</span>
                        登記抽籤
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleDirectBooking}
                      disabled={(userPoints?.points_balance || 0) < (selectedSlot.final_price || 0)}
                      className="w-full px-4 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      確認預約
                    </button>
                  )}
                </div>

                <div className="mt-3 p-2 bg-[var(--theme-bg-card)] rounded text-xs text-[var(--theme-text-muted)]">
                  <div>• 取消規則：24小時前全額退款，24小時內收取50%手續費</div>
                  <div>• 簽到規則：使用前15分鐘至開始後15分鐘內須簽到</div>
                  <div>• 未到場將被扣除懲罰點數並記錄違規</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "my-bookings" && (
        <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
            <span className="material-icons">list</span>
            我的預約記錄
          </h2>

          <div className="mb-4">
            <input
              type="text"
              placeholder="搜尋設施名稱、日期或狀態..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          <div className="space-y-3">
            {filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => {
                const statusDisplay = getStatusDisplay(booking.status)
                const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`)
                const now = new Date()
                const canCheckIn =
                  booking.status === "confirmed" &&
                  !booking.check_in_time &&
                  now >= new Date(bookingDateTime.getTime() - 15 * 60 * 1000) &&
                  now <= new Date(bookingDateTime.getTime() + 15 * 60 * 1000)
                const canCancel = booking.status === "confirmed" && now < bookingDateTime

                return (
                  <div
                    key={booking.id}
                    className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-[var(--theme-text-primary)] font-bold">
                          {booking.facilities?.name || "設施"}
                        </div>
                        <div className="text-[var(--theme-text-muted)] text-sm">
                          日期: {new Date(booking.booking_date).toLocaleDateString("zh-TW")}
                        </div>
                        <div className="text-[var(--theme-text-muted)] text-sm">
                          時間: {booking.start_time} - {booking.end_time}
                        </div>
                        {booking.points_spent && (
                          <div className="text-[var(--theme-accent)] text-sm font-medium">
                            花費: {booking.points_spent} 點
                          </div>
                        )}
                        {booking.check_in_time && (
                          <div className="text-green-500 text-sm">
                            已簽到: {new Date(booking.check_in_time).toLocaleTimeString("zh-TW")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${statusDisplay.color}`}>
                          {statusDisplay.text}
                        </div>
                        <div className="flex gap-2">
                          {canCheckIn && (
                            <button
                              onClick={() => handleCheckIn(booking.id)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-green-400 text-green-400 bg-transparent hover:bg-green-400/15 transition-all"
                            >
                              簽到
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(booking.id)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-rose-400 text-rose-400 bg-transparent hover:bg-rose-400/15 transition-all"
                            >
                              取消
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {booking.notes && (
                      <div className="text-[var(--theme-text-muted)] text-sm">備註: {booking.notes}</div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="text-center text-[var(--theme-text-muted)] py-8">
                {searchTerm ? "沒有符合條件的預約記錄" : "目前沒有預約記錄"}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "facilities" && (
        <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
          <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
            <span className="material-icons">meeting_room</span>
            可用設施
          </h2>

          <div className="mb-4">
            <input
              type="text"
              placeholder="搜尋設施名稱、說明或位置..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFacilities.map((facility) => (
              <div
                key={facility.id}
                className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg overflow-hidden hover:bg-[var(--theme-accent-light)] transition-all"
              >
                <div className="w-full h-40 bg-[var(--theme-bg-card)]">
                  {facility.image_url ? (
                    <img
                      src={facility.image_url || "/placeholder.svg"}
                      alt={facility.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-icons text-6xl text-[var(--theme-text-muted)]">meeting_room</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="text-[var(--theme-text-primary)] font-bold text-lg mb-2">{facility.name}</div>
                    <div className="text-[var(--theme-accent)] font-bold">{facility.base_price || 10} 點起</div>
                  </div>
                  {facility.description && (
                    <div className="text-[var(--theme-text-muted)] text-sm mb-2">{facility.description}</div>
                  )}
                  <div className="flex flex-wrap gap-2 text-sm">
                    {facility.location && (
                      <div className="text-[var(--theme-text-muted)] flex items-center gap-1">
                        <span className="material-icons text-sm">place</span>
                        {facility.location}
                      </div>
                    )}
                    {facility.capacity && (
                      <div className="text-[var(--theme-text-muted)] flex items-center gap-1">
                        <span className="material-icons text-sm">people</span>
                        {facility.capacity} 人
                      </div>
                    )}
                    {facility.cool_down_hours && (
                      <div className="text-[var(--theme-text-muted)] flex items-center gap-1">
                        <span className="material-icons text-sm">schedule</span>
                        冷卻 {facility.cool_down_hours} 小時
                      </div>
                    )}
                    {facility.is_lottery_enabled && (
                      <div className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-500 text-xs">支援抽籤</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredFacilities.length === 0 && (
              <div className="col-span-2 text-center text-[var(--theme-text-muted)] py-8">
                {searchTerm ? "沒有符合條件的設施" : "目前沒有可用設施"}
              </div>
            )}
          </div>
        </div>
      )}

      {showPointsHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
              <h3 className="text-lg font-bold text-[var(--theme-accent)]">點數交易紀錄</h3>
              <button
                onClick={() => setShowPointsHistory(false)}
                className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors"
              >
                <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {pointsHistory.length > 0 ? (
                <div className="space-y-2">
                  {pointsHistory.map((tx) => {
                    const typeLabels: Record<string, string> = {
                      monthly_allocation: "每月配額",
                      booking_deduct: "預約扣款",
                      booking_refund: "預約退款",
                      cancel_fee: "取消手續費",
                      no_show_penalty: "未到場罰款",
                      admin_adjust: "管理員調整",
                    }
                    return (
                      <div
                        key={tx.id}
                        className="flex justify-between items-center p-3 bg-[var(--theme-bg-secondary)] rounded-lg"
                      >
                        <div>
                          <div className="text-[var(--theme-text-primary)] font-medium">
                            {typeLabels[tx.transaction_type] || tx.transaction_type}
                          </div>
                          {tx.description && (
                            <div className="text-[var(--theme-text-muted)] text-xs">{tx.description}</div>
                          )}
                          <div className="text-[var(--theme-text-muted)] text-xs">
                            {new Date(tx.created_at).toLocaleString("zh-TW")}
                          </div>
                        </div>
                        <div className={`font-bold ${tx.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount} 點
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center text-[var(--theme-text-muted)] py-8">暫無交易紀錄</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
