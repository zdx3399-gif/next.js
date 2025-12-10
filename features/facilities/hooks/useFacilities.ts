"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getFacilities,
  getAllFacilities,
  getUserBookings,
  getAllBookings,
  checkBookingConflicts,
  createBooking,
  cancelBooking,
  createFacility,
  updateFacility,
  deleteFacility,
  uploadFacilityImage,
  type Facility,
  type FacilityBooking,
} from "../api/facilities"

interface BookingForm {
  facilityId: string
  bookingDate: string
  startTime: string
  endTime: string
  notes: string
}

// Hook for residents
export function useFacilities(userId?: string) {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [myBookings, setMyBookings] = useState<FacilityBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    facilityId: "",
    bookingDate: "",
    startTime: "",
    endTime: "",
    notes: "",
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const facilitiesData = await getFacilities()
      setFacilities(facilitiesData)

      if (userId) {
        const bookingsData = await getUserBookings(userId)
        setMyBookings(bookingsData)
      }
    } catch (error) {
      console.error("Failed to load facilities data:", error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleBooking = async (userName: string, userRoom?: string): Promise<{ success: boolean; message: string }> => {
    if (!userId) {
      return { success: false, message: "請先登入" }
    }

    if (!bookingForm.facilityId || !bookingForm.bookingDate || !bookingForm.startTime || !bookingForm.endTime) {
      return { success: false, message: "請填寫所有必填欄位" }
    }

    try {
      const hasConflict = await checkBookingConflicts(
        bookingForm.facilityId,
        bookingForm.bookingDate,
        bookingForm.startTime,
        bookingForm.endTime,
      )

      if (hasConflict) {
        return { success: false, message: "此時段已被預約，請選擇其他時段" }
      }

      await createBooking({
        facility_id: bookingForm.facilityId,
        user_id: userId,
        user_name: userName,
        user_room: userRoom,
        booking_date: bookingForm.bookingDate,
        start_time: bookingForm.startTime,
        end_time: bookingForm.endTime,
        notes: bookingForm.notes,
      })

      setBookingForm({
        facilityId: "",
        bookingDate: "",
        startTime: "",
        endTime: "",
        notes: "",
      })

      await loadData()
      return { success: true, message: "預約成功！" }
    } catch (error: any) {
      return { success: false, message: "預約失敗：" + error.message }
    }
  }

  const handleCancelBooking = async (bookingId: string): Promise<{ success: boolean; message: string }> => {
    try {
      await cancelBooking(bookingId)
      await loadData()
      return { success: true, message: "預約已取消" }
    } catch (error: any) {
      return { success: false, message: "取消失敗：" + error.message }
    }
  }

  return {
    facilities,
    myBookings,
    loading,
    bookingForm,
    setBookingForm,
    handleBooking,
    handleCancelBooking,
    reload: loadData,
  }
}

// Hook for admin
export function useFacilitiesAdmin() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [bookings, setBookings] = useState<FacilityBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [imageFiles, setImageFiles] = useState<{ [key: number]: File | null }>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [facilitiesData, bookingsData] = await Promise.all([getAllFacilities(), getAllBookings()])
      setFacilities(facilitiesData)
      setBookings(bookingsData)
    } catch (error) {
      console.error("Failed to load admin facilities data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateRow = (index: number, field: string, value: any) => {
    setFacilities((prev) => {
      const newData = [...prev]
      newData[index] = { ...newData[index], [field]: value }
      return newData
    })
  }

  const handleImageFileChange = (index: number, file: File | null) => {
    setImageFiles((prev) => ({ ...prev, [index]: file }))
  }

  const handleSave = async (
    facility: Facility,
    index: number,
    imageFile?: File | null,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      let imageUrl = facility.image_url

      const fileToUpload = imageFile || imageFiles[index]
      console.log("[v0] handleSave called, facility:", facility)
      console.log("[v0] fileToUpload:", fileToUpload)

      if (fileToUpload) {
        imageUrl = await uploadFacilityImage(fileToUpload)
        console.log("[v0] uploaded imageUrl:", imageUrl?.substring(0, 100) + "...")
        setImageFiles((prev) => ({ ...prev, [index]: null }))
      }

      const facilityData: Record<string, any> = {
        name: facility.name,
        description: facility.description || null,
        location: facility.location || null,
        capacity: facility.capacity || 1,
        available: facility.available ?? true,
        image_url: imageUrl || null,
      }

      console.log("[v0] facilityData to save:", {
        ...facilityData,
        image_url: facilityData.image_url ? facilityData.image_url.substring(0, 100) + "..." : "null",
      })

      if (facility.id) {
        console.log("[v0] updating facility with id:", facility.id)
        await updateFacility(facility.id, facilityData)
      } else {
        console.log("[v0] creating new facility")
        await createFacility(facilityData as Omit<Facility, "id" | "created_at">)
      }

      await loadData()
      return { success: true, message: "儲存成功！" }
    } catch (error: any) {
      console.error("[v0] handleSave error:", error)
      return { success: false, message: "儲存失敗：" + error.message }
    }
  }

  const handleDelete = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (!confirm("確定要刪除此設施？")) {
      return { success: false, message: "已取消" }
    }

    try {
      await deleteFacility(id)
      await loadData()
      return { success: true, message: "刪除成功！" }
    } catch (error: any) {
      return { success: false, message: "刪除失敗：" + error.message }
    }
  }

  const addNewFacility = () => {
    setFacilities((prev) => [
      ...prev,
      {
        id: "",
        name: "",
        description: "",
        location: "",
        capacity: 1,
        available: true,
        image_url: "",
      } as Facility,
    ])
  }

  return {
    facilities,
    bookings,
    loading,
    imageFiles,
    updateRow,
    handleImageFileChange,
    handleSave,
    handleDelete,
    addNewFacility,
    reload: loadData,
  }
}
