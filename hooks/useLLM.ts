"use client"

import { useState, useCallback } from "react"
import { llmAPI } from "@/lib/api-client"

interface UseLLMOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useLLM(options: UseLLMOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chat = useCallback(
    async (query: string, userId?: string, eventId?: string) => {
      setLoading(true)
      setError(null)
      try {
        const response = await llmAPI.chat(query, userId, eventId)
        options.onSuccess?.()
        return response
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "聊天請求失敗"
        setError(errorMessage)
        options.onError?.(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [options],
  )

  return { chat, loading, error }
}
