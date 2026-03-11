"use client"

import { useState, useCallback } from "react"
import { feesAPI } from "@/lib/api-client"

interface UseFeesOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useFees(options: UseFeesOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notifyFee = useCallback(
    async (room: string, amount: number, due: string, invoice?: string, test?: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const response = await feesAPI.notifyFee(room, amount, due, invoice, test)
        options.onSuccess?.()
        return response
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "繳費通知發送失敗"
        setError(errorMessage)
        options.onError?.(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [options],
  )

  return { notifyFee, loading, error }
}
