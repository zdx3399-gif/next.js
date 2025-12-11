import { getSupabaseClient } from "@/lib/supabase"

export interface Facility {
  id: string
  name: string
  description?: string
  location?: string
  capacity?: number
  available: boolean
  image_url?: string
  created_at?: string
  base_price?: number
  cool_down_hours?: number
  is_lottery_enabled?: boolean
  max_concurrent_bookings?: number
}

export interface TimeSlot {
  id: string
  facility_id: string
  slot_date: string
  start_time: string
  end_time: string
  price_modifier: number
  booking_type: "DIRECT" | "LOTTERY"
  status: "OPEN" | "BOOKED" | "LOCKED_FOR_LOTTERY" | "COMPLETED"
  lottery_deadline?: string
  facility?: Facility
  final_price?: number
}

export interface FacilityBooking {
  id: string
  facility_id: string
  user_id: string
  unit_id?: string
  user_name?: string
  user_room?: string
  booking_date: string
  start_time: string
  end_time: string
  notes?: string
  status: "confirmed" | "cancelled" | "completed" | "no_show" | "waitlist" | "pending_lottery"
  created_at?: string
  facilities?: { name: string }
  time_slot_id?: string
  points_spent?: number
  check_in_time?: string
  waitlist_position?: number
  waitlist_expires_at?: string
}

export interface LotteryEntry {
  id: string
  user_id: string
  time_slot_id: string
  points_bid: number
  register_time: string
  result: "PENDING" | "WON" | "LOST"
}

export interface PointsTransaction {
  id: string
  user_id: string
  amount: number
  transaction_type:
    | "monthly_allocation"
    | "booking_deduct"
    | "booking_refund"
    | "cancel_fee"
    | "no_show_penalty"
    | "admin_adjust"
  reference_id?: string
  description?: string
  created_at: string
}

export interface UserPointsInfo {
  points_balance: number
  penalty_count: number
  booking_status: "active" | "suspended"
  suspend_until?: string
  active_bookings_count: number
}

// ==================== 基本設施查詢 ====================

export async function getFacilities(): Promise<Facility[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("facilities").select("*").eq("available", true).order("name")

  if (error) {
    console.error("Error fetching facilities:", error)
    return []
  }
  return data || []
}

export async function getAllFacilities(): Promise<Facility[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("facilities").select("*").order("name")

  if (error) {
    console.error("Error fetching all facilities:", error)
    return []
  }
  return data || []
}

// ==================== 用戶點數相關 ====================

export async function getUserPointsInfo(userId: string): Promise<UserPointsInfo | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("points_balance, penalty_count, booking_status, suspend_until")
    .eq("id", userId)
    .single()

  if (error) {
    console.error("Error fetching user points:", error)
    return null
  }

  // 計算有效預約數量
  const { count } = await supabase
    .from("facility_bookings")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "confirmed")

  return {
    points_balance: profile?.points_balance || 100,
    penalty_count: profile?.penalty_count || 0,
    booking_status: profile?.booking_status || "active",
    suspend_until: profile?.suspend_until,
    active_bookings_count: count || 0,
  }
}

export async function deductPoints(
  userId: string,
  amount: number,
  transactionType: PointsTransaction["transaction_type"],
  referenceId?: string,
  description?: string,
): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  // 先獲取當前餘額
  const { data: profile } = await supabase.from("profiles").select("points_balance").eq("id", userId).single()

  if (!profile || profile.points_balance < amount) {
    return false
  }

  // 更新餘額
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ points_balance: profile.points_balance - amount })
    .eq("id", userId)

  if (updateError) {
    console.error("Error deducting points:", updateError)
    return false
  }

  // 記錄交易
  await supabase.from("points_transactions").insert({
    user_id: userId,
    amount: -amount,
    transaction_type: transactionType,
    reference_id: referenceId,
    description,
  })

  return true
}

export async function refundPoints(
  userId: string,
  amount: number,
  transactionType: PointsTransaction["transaction_type"],
  referenceId?: string,
  description?: string,
): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const { data: profile } = await supabase.from("profiles").select("points_balance").eq("id", userId).single()

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ points_balance: (profile?.points_balance || 0) + amount })
    .eq("id", userId)

  if (updateError) {
    console.error("Error refunding points:", updateError)
    return false
  }

  await supabase.from("points_transactions").insert({
    user_id: userId,
    amount: amount,
    transaction_type: transactionType,
    reference_id: referenceId,
    description,
  })

  return true
}

// ==================== 時段相關 ====================

export async function getFacilityTimeSlots(facilityId: string, date: string): Promise<TimeSlot[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("facility_time_slots")
    .select("*, facility:facilities(*)")
    .eq("facility_id", facilityId)
    .eq("slot_date", date)
    .order("start_time")

  if (error) {
    console.error("Error fetching time slots:", error)
    return []
  }

  return (data || []).map((slot) => ({
    ...slot,
    final_price: Math.round((slot.facility?.base_price || 10) * slot.price_modifier),
  }))
}

export async function generateTimeSlots(facilityId: string, date: string): Promise<TimeSlot[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  // 先檢查是否已有時段
  const { data: existing } = await supabase
    .from("facility_time_slots")
    .select("id")
    .eq("facility_id", facilityId)
    .eq("slot_date", date)

  if (existing && existing.length > 0) {
    return getFacilityTimeSlots(facilityId, date)
  }

  // 獲取設施資訊
  const { data: facility } = await supabase.from("facilities").select("*").eq("id", facilityId).single()

  if (!facility) return []

  // 生成時段（8:00 - 22:00）
  const slots = []
  const dateObj = new Date(date)
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

  for (let hour = 8; hour < 22; hour++) {
    const startTime = `${hour.toString().padStart(2, "0")}:00`
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`

    // 動態定價：平日晚間(18-22)和週末為尖峰
    let priceModifier = 1.0
    let bookingType: "DIRECT" | "LOTTERY" = "DIRECT"

    if (isWeekend) {
      priceModifier = 2.0 // 週末 2 倍
      if (facility.is_lottery_enabled && hour >= 10 && hour <= 18) {
        bookingType = "LOTTERY"
      }
    } else if (hour >= 18) {
      priceModifier = 1.5 // 平日晚間 1.5 倍
    } else if (hour < 12) {
      priceModifier = 0.5 // 平日早上 0.5 倍（冷門優惠）
    }

    slots.push({
      facility_id: facilityId,
      slot_date: date,
      start_time: startTime,
      end_time: endTime,
      price_modifier: priceModifier,
      booking_type: bookingType,
      status: "OPEN",
      lottery_deadline:
        bookingType === "LOTTERY" ? new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000).toISOString() : null,
    })
  }

  const { error } = await supabase.from("facility_time_slots").insert(slots)
  if (error) {
    console.error("Error generating time slots:", error)
    return []
  }

  return getFacilityTimeSlots(facilityId, date)
}

// ==================== 預約核心邏輯 ====================

export interface BookingValidation {
  valid: boolean
  message: string
  finalPrice?: number
}

export async function validateBooking(userId: string, facilityId: string, slotId?: string): Promise<BookingValidation> {
  const supabase = getSupabaseClient()
  if (!supabase) return { valid: false, message: "系統錯誤" }

  // 1. 檢查用戶狀態
  const userInfo = await getUserPointsInfo(userId)
  if (!userInfo) {
    return { valid: false, message: "無法獲取用戶資訊" }
  }

  if (userInfo.booking_status === "suspended") {
    const suspendUntil = userInfo.suspend_until ? new Date(userInfo.suspend_until).toLocaleDateString("zh-TW") : "未知"
    return { valid: false, message: `帳號已停權，停權至 ${suspendUntil}` }
  }

  // 2. 獲取設施資訊
  const { data: facility } = await supabase.from("facilities").select("*").eq("id", facilityId).single()

  if (!facility) {
    return { valid: false, message: "設施不存在" }
  }

  // 3. 檢查並發預約上限
  const maxConcurrent = facility.max_concurrent_bookings || 2
  if (userInfo.active_bookings_count >= maxConcurrent) {
    return { valid: false, message: `已達同時持有上限（${maxConcurrent} 筆），請先使用或取消現有預約` }
  }

  // 4. 檢查冷卻時間
  const { data: lastBooking } = await supabase
    .from("facility_bookings")
    .select("booking_date, end_time")
    .eq("user_id", userId)
    .eq("facility_id", facilityId)
    .in("status", ["confirmed", "completed"])
    .order("booking_date", { ascending: false })
    .limit(1)
    .single()

  if (lastBooking) {
    const coolDownHours = facility.cool_down_hours || 24
    const lastEndTime = new Date(`${lastBooking.booking_date}T${lastBooking.end_time}`)
    const coolDownEnd = new Date(lastEndTime.getTime() + coolDownHours * 60 * 60 * 1000)

    if (new Date() < coolDownEnd) {
      const remainingHours = Math.ceil((coolDownEnd.getTime() - Date.now()) / (60 * 60 * 1000))
      return { valid: false, message: `此設施冷卻中，還需等待 ${remainingHours} 小時` }
    }
  }

  // 5. 計算最終價格
  let finalPrice = facility.base_price || 10
  if (slotId) {
    const { data: slot } = await supabase
      .from("facility_time_slots")
      .select("price_modifier, status")
      .eq("id", slotId)
      .single()

    if (slot) {
      if (slot.status !== "OPEN") {
        return { valid: false, message: "此時段已被預約或不可用" }
      }
      finalPrice = Math.round(finalPrice * (slot.price_modifier || 1))
    }
  }

  // 6. 檢查點數餘額
  if (userInfo.points_balance < finalPrice) {
    return { valid: false, message: `點數不足（需要 ${finalPrice} 點，目前餘額 ${userInfo.points_balance} 點）` }
  }

  return { valid: true, message: "可以預約", finalPrice }
}

export async function attemptBooking(
  userId: string,
  facilityId: string,
  slotId: string,
  userName: string,
  userRoom?: string,
  notes?: string,
): Promise<{ success: boolean; message: string; bookingId?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, message: "系統錯誤" }

  // 驗證預約
  const validation = await validateBooking(userId, facilityId, slotId)
  if (!validation.valid) {
    return { success: false, message: validation.message }
  }

  // 獲取時段資訊
  const { data: slot } = await supabase.from("facility_time_slots").select("*").eq("id", slotId).single()

  if (!slot || slot.status !== "OPEN") {
    return { success: false, message: "此時段已被預約" }
  }

  // 如果是抽籤時段，不能直接預約
  if (slot.booking_type === "LOTTERY") {
    return { success: false, message: "此為抽籤時段，請使用抽籤登記功能" }
  }

  const finalPrice = validation.finalPrice || 10

  // 開始交易：扣點 + 建立預約 + 更新時段狀態
  try {
    // 1. 扣除點數
    const deducted = await deductPoints(
      userId,
      finalPrice,
      "booking_deduct",
      slotId,
      `預約設施 ${slot.slot_date} ${slot.start_time}`,
    )
    if (!deducted) {
      return { success: false, message: "扣除點數失敗" }
    }

    // 2. 建立預約
    const { data: booking, error: bookingError } = await supabase
      .from("facility_bookings")
      .insert({
        facility_id: facilityId,
        user_id: userId,
        time_slot_id: slotId,
        user_name: userName,
        user_room: userRoom,
        booking_date: slot.slot_date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        notes: notes,
        status: "confirmed",
        points_spent: finalPrice,
      })
      .select()
      .single()

    if (bookingError) {
      await refundPoints(userId, finalPrice, "booking_refund", slotId, "預約失敗退款")
      return { success: false, message: "建立預約失敗：" + bookingError.message }
    }

    // 3. 更新時段狀態
    await supabase.from("facility_time_slots").update({ status: "BOOKED" }).eq("id", slotId)

    return { success: true, message: `預約成功！已扣除 ${finalPrice} 點`, bookingId: booking.id }
  } catch (error: any) {
    return { success: false, message: "預約失敗：" + error.message }
  }
}

// ==================== 取消預約 ====================

export function calculateCancelFee(
  bookingDate: string,
  startTime: string,
  pointsSpent: number,
): { refundAmount: number; feeAmount: number } {
  const bookingDateTime = new Date(`${bookingDate}T${startTime}`)
  const now = new Date()
  const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursUntilBooking > 24) {
    // 超過 24 小時：全額退還
    return { refundAmount: pointsSpent, feeAmount: 0 }
  } else if (hoursUntilBooking > 0) {
    // 24 小時內：收取 50% 手續費
    const feeAmount = Math.floor(pointsSpent * 0.5)
    return { refundAmount: pointsSpent - feeAmount, feeAmount }
  } else {
    // 已過預約時間：不退款
    return { refundAmount: 0, feeAmount: pointsSpent }
  }
}

export async function cancelBookingWithRefund(
  bookingId: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, message: "系統錯誤" }

  // 獲取預約資訊
  const { data: booking } = await supabase
    .from("facility_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .single()

  if (!booking) {
    return { success: false, message: "找不到預約" }
  }

  if (booking.status !== "confirmed") {
    return { success: false, message: "此預約無法取消" }
  }

  const { refundAmount, feeAmount } = calculateCancelFee(
    booking.booking_date,
    booking.start_time,
    booking.points_spent || 0,
  )

  try {
    // 1. 更新預約狀態
    await supabase.from("facility_bookings").update({ status: "cancelled" }).eq("id", bookingId)

    // 2. 釋放時段
    if (booking.time_slot_id) {
      await supabase.from("facility_time_slots").update({ status: "OPEN" }).eq("id", booking.time_slot_id)
    }

    // 3. 退還點數
    if (refundAmount > 0) {
      await refundPoints(userId, refundAmount, "booking_refund", bookingId, "取消預約退款")
    }

    // 4. 如果有手續費，記錄
    if (feeAmount > 0) {
      await supabase.from("points_transactions").insert({
        user_id: userId,
        amount: -feeAmount,
        transaction_type: "cancel_fee",
        reference_id: bookingId,
        description: "取消預約手續費",
      })
    }

    const message =
      feeAmount > 0
        ? `預約已取消，退還 ${refundAmount} 點（手續費 ${feeAmount} 點）`
        : `預約已取消，已退還 ${refundAmount} 點`

    return { success: true, message }
  } catch (error: any) {
    return { success: false, message: "取消失敗：" + error.message }
  }
}

// ==================== 簽到功能 ====================

export async function checkIn(bookingId: string, userId: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, message: "系統錯誤" }

  const { data: booking } = await supabase
    .from("facility_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .single()

  if (!booking) {
    return { success: false, message: "找不到預約" }
  }

  if (booking.status !== "confirmed") {
    return { success: false, message: "此預約狀態無法簽到" }
  }

  if (booking.check_in_time) {
    return { success: false, message: "已經簽到過了" }
  }

  // 檢查簽到時間（使用前 15 分鐘至開始後 15 分鐘）
  const now = new Date()
  const bookingStart = new Date(`${booking.booking_date}T${booking.start_time}`)
  const checkInStart = new Date(bookingStart.getTime() - 15 * 60 * 1000)
  const checkInEnd = new Date(bookingStart.getTime() + 15 * 60 * 1000)

  if (now < checkInStart) {
    return { success: false, message: "還未到簽到時間" }
  }

  if (now > checkInEnd) {
    return { success: false, message: "已超過簽到時間" }
  }

  const { error } = await supabase
    .from("facility_bookings")
    .update({ check_in_time: now.toISOString() })
    .eq("id", bookingId)

  if (error) {
    return { success: false, message: "簽到失敗" }
  }

  return { success: true, message: "簽到成功！" }
}

// ==================== 抽籤相關 ====================

export async function joinLottery(
  userId: string,
  slotId: string,
  pointsBid: number,
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, message: "系統錯誤" }

  // 檢查時段是否為抽籤模式
  const { data: slot } = await supabase
    .from("facility_time_slots")
    .select("*, facility:facilities(*)")
    .eq("id", slotId)
    .single()

  if (!slot || slot.booking_type !== "LOTTERY") {
    return { success: false, message: "此時段不是抽籤模式" }
  }

  if (slot.status !== "OPEN" && slot.status !== "LOCKED_FOR_LOTTERY") {
    return { success: false, message: "此時段已不開放登記" }
  }

  // 檢查是否已登記
  const { data: existing } = await supabase
    .from("facility_lottery_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("time_slot_id", slotId)
    .single()

  if (existing) {
    return { success: false, message: "您已經登記過此時段" }
  }

  // 驗證用戶和預約條件
  const validation = await validateBooking(userId, slot.facility_id, slotId)
  if (!validation.valid) {
    return { success: false, message: validation.message }
  }

  // 檢查點數是否足夠支付投標
  const userInfo = await getUserPointsInfo(userId)
  if (!userInfo || userInfo.points_balance < pointsBid) {
    return { success: false, message: "點數不足" }
  }

  // 建立抽籤登記
  const { error } = await supabase.from("facility_lottery_entries").insert({
    user_id: userId,
    time_slot_id: slotId,
    points_bid: pointsBid,
    result: "PENDING",
  })

  if (error) {
    return { success: false, message: "登記失敗：" + error.message }
  }

  return { success: true, message: "抽籤登記成功！結果將於截止後公布" }
}

// ==================== 查詢相關 ====================

export async function getUserBookings(userId: string): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(`
      *,
      facilities(name),
      user:profiles!facility_bookings_user_id_fkey(name),
      unit:units!facility_bookings_unit_id_fkey(unit_code)
    `)
    .eq("user_id", userId)
    .order("booking_date", { ascending: false })

  if (error) {
    const { data: fallbackData } = await supabase
      .from("facility_bookings")
      .select("*, facilities(name)")
      .eq("user_id", userId)
      .order("booking_date", { ascending: false })
    return fallbackData || []
  }

  return (data || []).map((item: any) => ({
    ...item,
    user_name: item.user?.name || "未知",
    user_room: item.unit?.unit_code || "未知",
  }))
}

export async function getAllBookings(): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(`
      *,
      facilities(name),
      user:profiles!facility_bookings_user_id_fkey(name),
      unit:units!facility_bookings_unit_id_fkey(unit_code)
    `)
    .order("booking_date", { ascending: false })

  if (error) {
    const { data: fallbackData } = await supabase
      .from("facility_bookings")
      .select("*, facilities(name)")
      .order("booking_date", { ascending: false })
    return fallbackData || []
  }

  return (data || []).map((item: any) => ({
    ...item,
    user_name: item.user?.name || "未知",
    user_room: item.unit?.unit_code || "未知",
  }))
}

export async function getUserPointsHistory(userId: string): Promise<PointsTransaction[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("points_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Error fetching points history:", error)
    return []
  }

  return data || []
}

// ==================== 設施管理（管理員） ====================

export async function checkBookingConflicts(
  facilityId: string,
  bookingDate: string,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data: conflicts } = await supabase
    .from("facility_bookings")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("booking_date", bookingDate)
    .eq("status", "confirmed")

  if (conflicts && conflicts.length > 0) {
    const newStartTime = new Date(`1970-01-01T${startTime}:00`)
    const newEndTime = new Date(`1970-01-01T${endTime}:00`)

    return conflicts.some((booking) => {
      const existingStart = new Date(`1970-01-01T${booking.start_time}:00`)
      const existingEnd = new Date(`1970-01-01T${booking.end_time}:00`)
      return newStartTime < existingEnd && newEndTime > existingStart
    })
  }

  return false
}

export async function createBooking(booking: {
  facility_id: string
  user_id: string
  unit_id?: string
  user_name?: string
  user_room?: string
  booking_date: string
  start_time: string
  end_time: string
  notes?: string
}): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facility_bookings").insert([
    {
      ...booking,
      status: "confirmed",
    },
  ])

  if (error) throw error
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facility_bookings").update({ status: "cancelled" }).eq("id", bookingId)

  if (error) throw error
}

export async function createFacility(facility: Omit<Facility, "id" | "created_at">): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facilities").insert([facility])
  if (error) throw error
}

export async function updateFacility(id: string, facility: Partial<Facility>): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facilities").update(facility).eq("id", id)
  if (error) throw error
}

export async function deleteFacility(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("facilities").delete().eq("id", id)
  if (error) throw error
}

export async function uploadFacilityImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      const maxSize = 400
      let width = img.width
      let height = img.height

      if (width > height && width > maxSize) {
        height = (height * maxSize) / width
        width = maxSize
      } else if (height > maxSize) {
        width = (width * maxSize) / height
        height = maxSize
      }

      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)

      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.5)
      if (compressedBase64.length > 500000) {
        const smallerBase64 = canvas.toDataURL("image/jpeg", 0.3)
        resolve(smallerBase64)
      } else {
        resolve(compressedBase64)
      }
    }

    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}

export function getUserName(booking: FacilityBooking): string {
  return booking.user_name || "未知"
}

export function getUserRoom(booking: FacilityBooking): string {
  return booking.user_room || "未知"
}
