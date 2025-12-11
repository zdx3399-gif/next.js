"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getFacilities,
  getAllFacilities,
  getUserBookings,
  getAllBookings,
  createFacility,
  updateFacility,
  deleteFacility,
  uploadFacilityImage,
  type Facility,
  type FacilityBooking,
} from "../api/facilities"

// Hook for residents - 簡化版，主要邏輯移至 FacilityList
export function useFacilities(userId?: string) {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [myBookings, setMyBookings] = useState<FacilityBooking[]>([])
  const [loading, setLoading] = useState(true)

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

  return {
    facilities,
    myBookings,
    loading,
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

      if (fileToUpload) {
        imageUrl = await uploadFacilityImage(fileToUpload)
        setImageFiles((prev) => ({ ...prev, [index]: null }))
      }

      const facilityData: Record<string, any> = {
        name: facility.name,
        description: facility.description || null,
        location: facility.location || null,
        capacity: facility.capacity || 1,
        available: facility.available ?? true,
        image_url: imageUrl || null,
        base_price: facility.base_price || 10,
        cool_down_hours: facility.cool_down_hours || 24,
        is_lottery_enabled: facility.is_lottery_enabled || false,
        max_concurrent_bookings: facility.max_concurrent_bookings || 2,
      }

      if (facility.id) {
        await updateFacility(facility.id, facilityData)
      } else {
        await createFacility(facilityData as Omit<Facility, "id" | "created_at">)
      }

      await loadData()
      return { success: true, message: "儲存成功！" }
    } catch (error: any) {
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
        base_price: 10,
        cool_down_hours: 24,
        is_lottery_enabled: false,
        max_concurrent_bookings: 2,
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
