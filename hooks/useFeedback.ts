"use client"

import { useState, useCallback } from "react"
import { feedbackAPI } from "@/lib/api-client"

interface UseFeedbackOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useFeedback(options: UseFeedbackOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitFeedback = useCallback(
    async (
      chatLogId: string,
      feedbackType: "helpful" | "unclear" | "not_helpful",
      userId?: string,
      clarificationChoice?: string,
      comment?: string,
    ) => {
      setLoading(true)
      setError(null)
      try {
        const response = await feedbackAPI.submitFeedback(
          chatLogId,
          feedbackType,
          userId,
          clarificationChoice,
          comment,
        )
        options.onSuccess?.()
        return response
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "反饋提交失敗"
        setError(errorMessage)
        options.onError?.(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [options],
  )

  return { submitFeedback, loading, error }
}
