"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  createDecryptionRequest,
  getDecryptionRequests,
  adminReviewDecryptionRequest,
  committeeReviewDecryptionRequest,
  getDecryptedAuthorInfo,
  getAuditLogs,
  type DecryptionRequest,
} from "../api/decryption"

export function useDecryptionRequests(filters?: {
  status?: string | string[]
  requestedBy?: string
}) {
  const [requests, setRequests] = useState<DecryptionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getDecryptionRequests(filtersRef.current)
      setRequests(data)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, []) // Empty dependency array to prevent infinite loop

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  return {
    requests,
    isLoading,
    isError: error,
    refresh: loadRequests,
  }
}

export function useCreateDecryptionRequest() {
  const [isLoading, setIsLoading] = useState(false)

  const create = async (data: {
    requestedBy: string
    targetType: "post" | "comment"
    targetId: string
    reason: string
    triggerCondition?: "multiple_reports" | "serious_violation" | "legal_request"
  }) => {
    setIsLoading(true)
    try {
      const result = await createDecryptionRequest(data)
      return result
    } finally {
      setIsLoading(false)
    }
  }

  return { create, isLoading }
}

// 管理員審核
export function useAdminReviewDecryptionRequest() {
  const [isLoading, setIsLoading] = useState(false)

  const review = async (
    requestId: string,
    data: {
      adminId: string
      approved: boolean
      notes?: string
    },
  ) => {
    setIsLoading(true)
    try {
      const result = await adminReviewDecryptionRequest(requestId, data)
      return result
    } finally {
      setIsLoading(false)
    }
  }

  return { review, isLoading }
}

// 委員會審核
export function useCommitteeReviewDecryptionRequest() {
  const [isLoading, setIsLoading] = useState(false)

  const review = async (
    requestId: string,
    data: {
      committeeId: string
      approved: boolean
      notes?: string
    },
  ) => {
    setIsLoading(true)
    try {
      const result = await committeeReviewDecryptionRequest(requestId, data)
      return result
    } finally {
      setIsLoading(false)
    }
  }

  return { review, isLoading }
}

// 查看解密後作者資訊
export function useDecryptedAuthorInfo() {
  const [isLoading, setIsLoading] = useState(false)
  const [authorInfo, setAuthorInfo] = useState<any>(null)

  const getAuthor = async (requestId: string, viewerId: string) => {
    setIsLoading(true)
    try {
      const result = await getDecryptedAuthorInfo(requestId, viewerId)
      setAuthorInfo(result)
      return result
    } finally {
      setIsLoading(false)
    }
  }

  return { getAuthor, authorInfo, isLoading }
}

export function useAuditLogs(filters?: {
  actorId?: string
  targetType?: string
  action?: string
  startDate?: string
  endDate?: string
}) {
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getAuditLogs(filtersRef.current)
      setLogs(data)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, []) // Empty dependency array to prevent infinite loop

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return {
    logs,
    isLoading,
    isError: error,
    refresh: loadLogs,
  }
}
