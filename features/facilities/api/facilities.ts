import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

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

const INITIAL_FACILITY_POINTS = 100

async function resolveFacilityPointsBalance(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userId: string,
  rawBalance?: number | null,
) {
  if (typeof rawBalance === "number" && Number.isFinite(rawBalance) && rawBalance >= 0) {
    return rawBalance
  }

  const { data: transactions } = await supabase.from("points_transactions").select("amount").eq("user_id", userId)
  const totalDelta = (transactions || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  const normalizedBalance = Math.max(0, INITIAL_FACILITY_POINTS + totalDelta)

  await supabase
    .from("profiles")
    .update({ points_balance: normalizedBalance })
    .eq("id", userId)

  return normalizedBalance
}

function getCurrentOperator() {
  if (typeof window === "undefined") return { id: "", role: "unknown" }

  try {
    const raw = localStorage.getItem("currentUser")
    if (!raw) return { id: "", role: "unknown" }
    const parsed = JSON.parse(raw)
    return { id: parsed?.id || "", role: parsed?.role || "unknown" }
  } catch {
    return { id: "", role: "unknown" }
  }
}

async function logFacilityAudit(params: {
  action: string
  targetId: string
  reason: string
  status: "success" | "failed" | "blocked"
  afterState?: Record<string, any>
  errorCode?: string
}) {
  const operator = getCurrentOperator()
  if (!operator.id) return

  await createAuditLog({
    operatorId: operator.id,
    operatorRole: operator.role,
    actionType: "system_action",
    targetType: "system",
    targetId: params.targetId,
    reason: params.reason,
    afterState: params.afterState,
    additionalData: {
      module: "facilities",
      status: params.status,
      action: params.action,
      error_code: params.errorCode,
    },
  })
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

  const pointsBalance = await resolveFacilityPointsBalance(supabase, userId, profile?.points_balance)

  // 計算有效預約數量
  const { count } = await supabase
    .from("facility_bookings")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "confirmed")

  return {
    points_balance: pointsBalance,
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
  const currentBalance = await resolveFacilityPointsBalance(supabase, userId, profile?.points_balance)

  if (!profile || currentBalance < amount) {
    await logFacilityAudit({
      action: "deduct_points",
      targetId: userId,
      reason: "點數不足",
      status: "blocked",
      afterState: { amount, transactionType },
      errorCode: "insufficient_points",
    })
    return false
  }

  // 寫入交易明細
  const { error: txError } = await supabase.from("points_transactions").insert({
    user_id: userId,
    amount: -amount,
    transaction_type: transactionType,
    reference_id: referenceId,
    description,
  })

  if (txError) {
    console.error("Error deducting points:", txError)
    await logFacilityAudit({
      action: "deduct_points",
      targetId: userId,
      reason: txError.message,
      status: "failed",
      afterState: { amount, transactionType },
      errorCode: txError.message,
    })
    return false
  }

  // 直接更新餘額（delta 方式，相容於無觸發器的環境）
  await supabase
    .from("profiles")
    .update({ points_balance: currentBalance - amount })
    .eq("id", userId)

  await logFacilityAudit({
    action: "deduct_points",
    targetId: userId,
    reason: description || "扣除點數",
    status: "success",
    afterState: { amount, transactionType, referenceId },
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

  // 取得當前餘額供直接更新用
  const { data: profileForRefund } = await supabase
    .from("profiles")
    .select("points_balance")
    .eq("id", userId)
    .single()
  const currentBalance = await resolveFacilityPointsBalance(supabase, userId, profileForRefund?.points_balance)

  const { error: txError } = await supabase.from("points_transactions").insert({
    user_id: userId,
    amount: amount,
    transaction_type: transactionType,
    reference_id: referenceId,
    description,
  })

  if (txError) {
    console.error("Error refunding points:", txError)
    await logFacilityAudit({
      action: "refund_points",
      targetId: userId,
      reason: txError.message,
      status: "failed",
      afterState: { amount, transactionType },
      errorCode: txError.message,
    })
    return false
  }

  // 直接更新餘額（delta 方式）
  if (profileForRefund) {
    await supabase
      .from("profiles")
      .update({ points_balance: currentBalance + amount })
      .eq("id", userId)
  }

  await logFacilityAudit({
    action: "refund_points",
    targetId: userId,
    reason: description || "退還點數",
    status: "success",
    afterState: { amount, transactionType, referenceId },
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
    await logFacilityAudit({
      action: "generate_time_slots",
      targetId: facilityId,
      reason: error.message,
      status: "failed",
      afterState: { date, slots: slots.length },
      errorCode: error.message,
    })
    return []
  }

  await logFacilityAudit({
    action: "generate_time_slots",
    targetId: facilityId,
    reason: "生成設施時段",
    status: "success",
    afterState: { date, slots: slots.length },
  })

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
    await logFacilityAudit({
      action: "attempt_booking",
      targetId: slotId,
      reason: validation.message,
      status: "blocked",
      afterState: { userId, facilityId },
      errorCode: "booking_validation_failed",
    })
    return { success: false, message: validation.message }
  }

  // 獲取時段資訊
  const { data: slot } = await supabase.from("facility_time_slots").select("*").eq("id", slotId).single()

  if (!slot || slot.status !== "OPEN") {
    await logFacilityAudit({
      action: "attempt_booking",
      targetId: slotId,
      reason: "此時段已被預約",
      status: "blocked",
      afterState: { userId, facilityId },
      errorCode: "slot_not_open",
    })
    return { success: false, message: "此時段已被預約" }
  }

  // 如果是抽籤時段，不能直接預約
  if (slot.booking_type === "LOTTERY") {
    await logFacilityAudit({
      action: "attempt_booking",
      targetId: slotId,
      reason: "此為抽籤時段，請使用抽籤登記功能",
      status: "blocked",
      afterState: { userId, facilityId },
      errorCode: "lottery_slot",
    })
    return { success: false, message: "此為抽籤時段，請使用抽籤登記功能" }
  }

  const finalPrice = validation.finalPrice || 10
  const bookingUserContext = await resolveBookingUserContext(supabase, userId)

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
      await logFacilityAudit({
        action: "attempt_booking",
        targetId: slotId,
        reason: "扣除點數失敗",
        status: "failed",
        afterState: { userId, finalPrice },
        errorCode: "deduct_points_failed",
      })
      return { success: false, message: "扣除點數失敗" }
    }

    // 2. 建立預約
    const { data: booking, error: bookingError } = await supabase
      .from("facility_bookings")
      .insert({
        facility_id: facilityId,
        user_id: userId,
        unit_id: bookingUserContext.unit_id,
        time_slot_id: slotId,
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
      await logFacilityAudit({
        action: "attempt_booking",
        targetId: slotId,
        reason: bookingError.message,
        status: "failed",
        afterState: { userId, facilityId },
        errorCode: bookingError.message,
      })
      return { success: false, message: "建立預約失敗：" + bookingError.message }
    }

    // 3. 更新時段狀態
    await supabase.from("facility_time_slots").update({ status: "BOOKED" }).eq("id", slotId)

    await logFacilityAudit({
      action: "attempt_booking",
      targetId: booking.id,
      reason: "預約成功",
      status: "success",
      afterState: { facilityId, slotId, points_spent: finalPrice },
    })

    return { success: true, message: `預約成功！已扣除 ${finalPrice} 點`, bookingId: booking.id }
  } catch (error: any) {
    await logFacilityAudit({
      action: "attempt_booking",
      targetId: slotId,
      reason: error.message,
      status: "failed",
      afterState: { userId, facilityId },
      errorCode: error.message,
    })
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
    await logFacilityAudit({
      action: "cancel_booking_with_refund",
      targetId: bookingId,
      reason: "找不到預約",
      status: "blocked",
      errorCode: "booking_not_found",
    })
    return { success: false, message: "找不到預約" }
  }

  if (booking.status !== "confirmed") {
    await logFacilityAudit({
      action: "cancel_booking_with_refund",
      targetId: bookingId,
      reason: "此預約無法取消",
      status: "blocked",
      errorCode: "invalid_status",
    })
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

    await logFacilityAudit({
      action: "cancel_booking_with_refund",
      targetId: bookingId,
      reason: "取消預約",
      status: "success",
      afterState: { refundAmount, feeAmount },
    })

    return { success: true, message }
  } catch (error: any) {
    await logFacilityAudit({
      action: "cancel_booking_with_refund",
      targetId: bookingId,
      reason: error.message,
      status: "failed",
      errorCode: error.message,
    })
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
    await logFacilityAudit({ action: "check_in", targetId: bookingId, reason: "找不到預約", status: "blocked", errorCode: "booking_not_found" })
    return { success: false, message: "找不到預約" }
  }

  if (booking.status !== "confirmed") {
    await logFacilityAudit({ action: "check_in", targetId: bookingId, reason: "此預約狀態無法簽到", status: "blocked", errorCode: "invalid_status" })
    return { success: false, message: "此預約狀態無法簽到" }
  }

  if (booking.check_in_time) {
    await logFacilityAudit({ action: "check_in", targetId: bookingId, reason: "已經簽到過了", status: "blocked", errorCode: "already_checked_in" })
    return { success: false, message: "已經簽到過了" }
  }

  // 檢查簽到時間（使用前 15 分鐘至開始後 15 分鐘）
  const now = new Date()
  const bookingStart = new Date(`${booking.booking_date}T${booking.start_time}`)
  const checkInStart = new Date(bookingStart.getTime() - 15 * 60 * 1000)
  const checkInEnd = new Date(bookingStart.getTime() + 15 * 60 * 1000)

  if (now < checkInStart) {
    await logFacilityAudit({ action: "check_in", targetId: bookingId, reason: "還未到簽到時間", status: "blocked", errorCode: "too_early" })
    return { success: false, message: "還未到簽到時間" }
  }

  if (now > checkInEnd) {
    await logFacilityAudit({ action: "check_in", targetId: bookingId, reason: "已超過簽到時間", status: "blocked", errorCode: "too_late" })
    return { success: false, message: "已超過簽到時間" }
  }

  const { error } = await supabase
    .from("facility_bookings")
    .update({ check_in_time: now.toISOString() })
    .eq("id", bookingId)

  if (error) {
    await logFacilityAudit({ action: "check_in", targetId: bookingId, reason: "簽到失敗", status: "failed", errorCode: error.message || "check_in_failed" })
    return { success: false, message: "簽到失敗" }
  }

  await logFacilityAudit({ action: "check_in", targetId: bookingId, reason: "簽到成功", status: "success", afterState: { userId } })

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
    await logFacilityAudit({ action: "join_lottery", targetId: slotId, reason: "此時段不是抽籤模式", status: "blocked", errorCode: "not_lottery_slot" })
    return { success: false, message: "此時段不是抽籤模式" }
  }

  if (slot.status !== "OPEN" && slot.status !== "LOCKED_FOR_LOTTERY") {
    await logFacilityAudit({ action: "join_lottery", targetId: slotId, reason: "此時段已不開放登記", status: "blocked", errorCode: "slot_closed" })
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
    await logFacilityAudit({ action: "join_lottery", targetId: slotId, reason: "您已經登記過此時段", status: "blocked", errorCode: "already_joined" })
    return { success: false, message: "您已經登記過此時段" }
  }

  // 驗證用戶和預約條件
  const validation = await validateBooking(userId, slot.facility_id, slotId)
  if (!validation.valid) {
    await logFacilityAudit({ action: "join_lottery", targetId: slotId, reason: validation.message, status: "blocked", errorCode: "lottery_validation_failed" })
    return { success: false, message: validation.message }
  }

  // 檢查點數是否足夠支付投標
  const userInfo = await getUserPointsInfo(userId)
  if (!userInfo || userInfo.points_balance < pointsBid) {
    await logFacilityAudit({ action: "join_lottery", targetId: slotId, reason: "點數不足", status: "blocked", errorCode: "insufficient_points" })
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
    await logFacilityAudit({ action: "join_lottery", targetId: slotId, reason: error.message, status: "failed", errorCode: error.message })
    return { success: false, message: "登記失敗：" + error.message }
  }

  await logFacilityAudit({ action: "join_lottery", targetId: slotId, reason: "抽籤登記成功", status: "success", afterState: { userId, pointsBid } })

  return { success: true, message: "抽籤登記成功！結果將於截止後公布" }
}

// ==================== 查詢相關 ====================

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
  if (!supabase) return false
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
  if (!supabase) throw new Error("Supabase client unavailable")
  const bookingUserContext = await resolveBookingUserContext(supabase, booking.user_id)
  const { error } = await supabase.from("facility_bookings").insert([
    {
      ...booking,
      unit_id: booking.unit_id || bookingUserContext.unit_id,
      status: "confirmed",
    },
  ])

  if (error) {
    await logFacilityAudit({ action: "create_booking", targetId: booking.user_id, reason: error.message, status: "failed", errorCode: error.message })
    throw error
  }

  await logFacilityAudit({ action: "create_booking", targetId: booking.user_id, reason: "建立預約", status: "success", afterState: booking as Record<string, any> })
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client unavailable")
  const { error } = await supabase.from("facility_bookings").update({ status: "cancelled" }).eq("id", bookingId)

  if (error) {
    await logFacilityAudit({ action: "cancel_booking", targetId: bookingId, reason: error.message, status: "failed", errorCode: error.message })
    throw error
  }

  await logFacilityAudit({ action: "cancel_booking", targetId: bookingId, reason: "取消預約", status: "success" })
}

export async function createFacility(facility: Omit<Facility, "id" | "created_at">): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client unavailable")
  const { error } = await supabase.from("facilities").insert([facility])
  if (error) {
    await logFacilityAudit({ action: "create_facility", targetId: facility.name, reason: error.message, status: "failed", errorCode: error.message })
    throw error
  }
  await logFacilityAudit({ action: "create_facility", targetId: facility.name, reason: "建立設施", status: "success", afterState: facility as Record<string, any> })
}

export async function updateFacility(id: string, facility: Partial<Facility>): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client unavailable")
  const { error } = await supabase.from("facilities").update(facility).eq("id", id)
  if (error) {
    await logFacilityAudit({ action: "update_facility", targetId: id, reason: error.message, status: "failed", errorCode: error.message })
    throw error
  }
  await logFacilityAudit({ action: "update_facility", targetId: id, reason: "更新設施", status: "success", afterState: facility as Record<string, any> })
}

export async function deleteFacility(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client unavailable")
  const { error } = await supabase.from("facilities").delete().eq("id", id)
  if (error) {
    await logFacilityAudit({ action: "delete_facility", targetId: id, reason: error.message, status: "failed", errorCode: error.message })
    throw error
  }
  await logFacilityAudit({ action: "delete_facility", targetId: id, reason: "刪除設施", status: "success" })
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

type BookingUserContext = {
  user_name?: string
  unit_id?: string
  user_room?: string
}

function isMeaningfulBookingValue(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value.trim() !== "-" && value.trim() !== "未知"
}

async function resolveBookingUserContext(supabase: any, userId: string): Promise<BookingUserContext> {
  if (!userId) return {}

  const { data: profile } = await supabase.from("profiles").select("id, name, unit_id").eq("id", userId).maybeSingle()

  const { data: membersByProfile } = await supabase
    .from("household_members")
    .select("id, name, unit_id, profile_id")
    .eq("profile_id", userId)
    .limit(1)

  const { data: membersById } = await supabase
    .from("household_members")
    .select("id, name, unit_id, profile_id")
    .eq("id", userId)
    .limit(1)

  const householdByProfile = membersByProfile?.[0] || null
  const householdById = membersById?.[0] || null
  const resolvedUnitId = profile?.unit_id || householdByProfile?.unit_id || householdById?.unit_id

  let userRoom = ""
  if (resolvedUnitId) {
    const { data: unit } = await supabase.from("units").select("unit_code").eq("id", resolvedUnitId).maybeSingle()
    userRoom = unit?.unit_code || ""
  }

  return {
    user_name: profile?.name || householdByProfile?.name || householdById?.name || undefined,
    unit_id: resolvedUnitId || undefined,
    user_room: userRoom || undefined,
  }
}

async function enrichBookingsWithProfileAndUnit(
  supabase: any,
  rows: any[],
): Promise<FacilityBooking[]> {
  if (!rows || rows.length === 0) return []

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]
  const unitIds = [...new Set(rows.map((r) => r.unit_id).filter(Boolean))]

  let profileNameMap: Record<string, string> = {}
  let profileUnitIdMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name, unit_id").in("id", userIds)
    if (profiles) {
      profileNameMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.name || ""]))
      profileUnitIdMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.unit_id || ""]))
    }
  }

  let householdNameByProfileMap: Record<string, string> = {}
  let householdUnitByProfileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: membersByProfile } = await supabase
      .from("household_members")
      .select("profile_id, name, unit_id")
      .in("profile_id", userIds)
    if (membersByProfile) {
      householdNameByProfileMap = Object.fromEntries(
        membersByProfile.filter((m: any) => m.profile_id).map((m: any) => [m.profile_id, m.name || ""]),
      )
      householdUnitByProfileMap = Object.fromEntries(
        membersByProfile.filter((m: any) => m.profile_id).map((m: any) => [m.profile_id, m.unit_id || ""]),
      )
    }
  }

  let householdNameByIdMap: Record<string, string> = {}
  let householdUnitByIdMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: membersById } = await supabase.from("household_members").select("id, name, unit_id").in("id", userIds)
    if (membersById) {
      householdNameByIdMap = Object.fromEntries(membersById.map((m: any) => [m.id, m.name || ""]))
      householdUnitByIdMap = Object.fromEntries(membersById.map((m: any) => [m.id, m.unit_id || ""]))
    }
  }

  const allUnitIds = [
    ...new Set([
      ...unitIds,
      ...Object.values(profileUnitIdMap),
      ...Object.values(householdUnitByProfileMap),
      ...Object.values(householdUnitByIdMap),
    ].filter(Boolean)),
  ]

  let unitCodeMap: Record<string, string> = {}
  if (allUnitIds.length > 0) {
    const { data: units } = await supabase.from("units").select("id, unit_code").in("id", allUnitIds)
    if (units) {
      unitCodeMap = Object.fromEntries(units.map((u: any) => [u.id, u.unit_code || ""]))
    }
  }

  return rows.map((item: any) => ({
    ...item,
    user_name:
      (isMeaningfulBookingValue(item.user?.name) ? item.user.name : "") ||
      (isMeaningfulBookingValue(item.user_name) ? item.user_name : "") ||
      profileNameMap[item.user_id] ||
      householdNameByProfileMap[item.user_id] ||
      householdNameByIdMap[item.user_id] ||
      "未知",
    user_room:
      (isMeaningfulBookingValue(item.unit?.unit_code) ? item.unit.unit_code : "") ||
      (isMeaningfulBookingValue(item.user_room) ? item.user_room : "") ||
      unitCodeMap[item.unit_id] ||
      unitCodeMap[profileUnitIdMap[item.user_id]] ||
      unitCodeMap[householdUnitByProfileMap[item.user_id]] ||
      unitCodeMap[householdUnitByIdMap[item.user_id]] ||
      "未知",
  }))
}

export async function getUserBookings(userId: string): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

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

  const rows = !error ? data || [] : (
    await supabase
      .from("facility_bookings")
      .select("*, facilities(name)")
      .eq("user_id", userId)
      .order("booking_date", { ascending: false })
  ).data || []

  return enrichBookingsWithProfileAndUnit(supabase, rows)
}

export async function getAllBookings(): Promise<FacilityBooking[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("facility_bookings")
    .select(`
      *,
      facilities(name),
      user:profiles!facility_bookings_user_id_fkey(name),
      unit:units!facility_bookings_unit_id_fkey(unit_code)
    `)
    .order("booking_date", { ascending: false })

  const rows = !error ? data || [] : (
    await supabase
      .from("facility_bookings")
      .select("*, facilities(name)")
      .order("booking_date", { ascending: false })
  ).data || []

  return enrichBookingsWithProfileAndUnit(supabase, rows)
}
