"use client"

import { useState, useCallback } from "react"
import { profileAPI } from "@/lib/api-client"

interface UseProfileByNameOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useProfileByName(options: UseProfileByNameOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getProfileByName = useCallback(
    async (name: string) => {
      setLoading(true)
      setError(null)
      try {
        const response = await profileAPI.getProfileByName(name)
        options.onSuccess?.()
        return response
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "查詢失敗"
        setError(errorMessage)
        options.onError?.(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [options],
  )

  return { getProfileByName, loading, error }
}
