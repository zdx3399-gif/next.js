"use client"

import { useState, useEffect, useCallback } from "react"
import {
  fetchMaintenanceRequests,
  fetchUserMaintenanceRequests,
  submitMaintenanceRequest,
  type MaintenanceRequest,
  type MaintenanceFormData,
} from "../api/maintenance"

export function useMaintenance(userId?: string, userOnly = false) {
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)

  const loadMaintenance = useCallback(async () => {
    setLoading(true)
    let data: MaintenanceRequest[]

    if (userOnly && userId) {
      data = await fetchUserMaintenanceRequests(userId)
    } else {
      data = await fetchMaintenanceRequests()
    }

    setMaintenance(data)
    setLoading(false)
  }, [userId, userOnly])

  useEffect(() => {
    loadMaintenance()
  }, [loadMaintenance])

  const handleSubmit = async (
    formData: MaintenanceFormData,
    userName: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!userId) {
      return { success: false, error: "請先登入" }
    }

    const result = await submitMaintenanceRequest(formData, userId, userName)

    if (result.success) {
      await loadMaintenance()
    }

    return result
  }

  return {
    maintenance,
    loading,
    reload: loadMaintenance,
    handleSubmit,
  }
}
