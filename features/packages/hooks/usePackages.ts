"use client"

import { useState, useEffect, useCallback } from "react"
import { type Package, type AddPackageData, fetchPackages, addPackage, markPackageAsPickedUp } from "../api/packages"

interface UsePackagesOptions {
  userRoom?: string
  isAdmin?: boolean
  userUnitId?: string
}

export function usePackages(options: UsePackagesOptions = {}) {
  const { userRoom, isAdmin = false, userUnitId } = options

  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPackages(userRoom, isAdmin, userUnitId)
      setPackages(data)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error"
      console.error("Error loading packages:", e)
      setError(errorMessage)
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [userRoom, userUnitId, isAdmin])

  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  const handleAddPackage = async (packageData: {
    courier: string
    recipient_name: string
    recipient_room: string
    tracking_number?: string
    arrived_at?: string
  }) => {
    try {
      await addPackage(packageData as AddPackageData)
      await loadPackages()
      return true
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error"
      setError(errorMessage)
      return false
    }
  }

  const handleMarkAsPickedUp = async (packageId: string, pickedUpBy: string) => {
    try {
      const updatedPackage = await markPackageAsPickedUp(packageId, pickedUpBy)
      if (updatedPackage) {
        setPackages((prev) => prev.map((pkg) => (pkg.id === packageId ? updatedPackage : pkg)))
      }
      return true
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error"
      setError(errorMessage)
      return false
    }
  }

  const pendingPackages = packages.filter((pkg) => pkg.status === "pending")
  const pickedUpPackages = packages.filter((pkg) => pkg.status === "picked_up")

  return {
    packages,
    pendingPackages,
    pickedUpPackages,
    loading,
    error,
    reload: loadPackages,
    handleAddPackage,
    handleMarkAsPickedUp,
  }
}
