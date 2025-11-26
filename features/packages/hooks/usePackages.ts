"use client"

import { useState, useEffect, useCallback } from "react"
import { type Package, fetchPackages, addPackage, markPackageAsPickedUp } from "../api/packages"

interface UsePackagesOptions {
  userRoom?: string
  isAdmin?: boolean
}

export function usePackages({ userRoom, isAdmin = false }: UsePackagesOptions) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true) // 初始為 true
  const [error, setError] = useState<string | null>(null)

  const loadPackages = useCallback(async () => {
    console.log("[v0] Loading packages, userRoom:", userRoom, "isAdmin:", isAdmin)
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPackages(userRoom, isAdmin)
      console.log("[v0] Loaded packages:", data.length)
      setPackages(data)
    } catch (e: any) {
      console.error("[v0] Error loading packages:", e)
      setError(e.message)
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [userRoom, isAdmin])

  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  const handleAddPackage = async (packageData: {
    courier: string
    recipient_name: string
    recipient_room: string
    tracking_number?: string
    arrived_at: string
  }) => {
    try {
      await addPackage(packageData)
      await loadPackages()
      return true
    } catch (e: any) {
      setError(e.message)
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
    } catch (e: any) {
      setError(e.message)
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
    loadPackages,
    handleAddPackage,
    handleMarkAsPickedUp,
  }
}
