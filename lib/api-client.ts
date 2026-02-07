"use client"

/**
 * 統一的 API 客戶端
 * 所有前端對後端 API 的請求都通過這個文件
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

interface FetchOptions extends RequestInit {
  params?: Record<string, any>
}

async function apiCall<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options

  let url = `${API_BASE}${endpoint}`

  // 處理查詢參數
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value)
        }
        return acc
      }, {} as Record<string, string>)
    ).toString()

    if (queryString) {
      url += `?${queryString}`
    }
  }

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
    ...fetchOptions,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || data.error || `API error: ${response.status}`)
  }

  return data
}

// ==================== 認證相關 ====================

export const authAPI = {
  login: (email: string, password: string) =>
    apiCall("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string, phone: string, role?: string, relationship?: string, unit?: string) =>
    apiCall("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, phone, role, relationship, unit }),
    }),

  bindLine: (profileId: string, lineUserId: string, lineDisplayName?: string, lineAvatarUrl?: string, lineStatusMessage?: string) =>
    apiCall("/api/bind-line", {
      method: "POST",
      body: JSON.stringify({
        profile_id: profileId,
        line_user_id: lineUserId,
        line_display_name: lineDisplayName,
        line_avatar_url: lineAvatarUrl,
        line_status_message: lineStatusMessage,
      }),
    }),

  unbindLine: (profileId: string) =>
    apiCall("/api/bind-line", {
      method: "DELETE",
      body: JSON.stringify({ profile_id: profileId }),
    }),
}

// ==================== 包裹相關 ====================

export const packagesAPI = {
  getPackages: () =>
    apiCall("/api/packages", { method: "GET" }),

  addPackage: (courier: string, recipientName: string, recipientRoom: string, trackingNumber?: string, arrivedAt?: string, test?: boolean) =>
    apiCall("/api/packages", {
      method: "POST",
      body: JSON.stringify({
        courier,
        recipient_name: recipientName,
        recipient_room: recipientRoom,
        tracking_number: trackingNumber,
        arrived_at: arrivedAt,
        test,
      }),
    }),

  markPackageAsPickedUp: (packageId: string, pickedUpBy?: string) =>
    apiCall("/api/packages", {
      method: "PUT",
      body: JSON.stringify({
        id: packageId,
        picked_up_by: pickedUpBy,
      }),
    }),
}

// ==================== 訪客相關 ====================

export const visitorsAPI = {
  getVisitors: () =>
    apiCall("/api/visitor", { method: "GET" }),

  addVisitor: (visitorName: string, visitorPhone: string, purpose: string, reserveTime: string, unitId: string, reservedById: string) =>
    apiCall("/api/visitor", {
      method: "POST",
      body: JSON.stringify({
        visitorName,
        visitorPhone,
        purpose,
        reserveTime,
        unitId,
        reservedById,
      }),
    }),

  checkInVisitor: (visitorId: string) =>
    apiCall("/api/visitor", {
      method: "PUT",
      body: JSON.stringify({ id: visitorId, status: "checked_in" }),
    }),

  checkOutVisitor: (visitorId: string) =>
    apiCall("/api/visitor", {
      method: "PUT",
      body: JSON.stringify({ id: visitorId, status: "checked_out" }),
    }),
}

// ==================== 反饋相關 ====================

export const feedbackAPI = {
  submitFeedback: (chatLogId: string, feedbackType: "helpful" | "unclear" | "not_helpful", userId?: string, clarificationChoice?: string, comment?: string) =>
    apiCall("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        chatLogId,
        feedbackType,
        userId,
        clarificationChoice,
        comment,
      }),
    }),
}

// ==================== 費用相關 ====================

export const feesAPI = {
  notifyFee: (room: string, amount: number, due: string, invoice?: string, test?: boolean) =>
    apiCall("/api/fees", {
      method: "POST",
      body: JSON.stringify({
        room,
        amount,
        due,
        invoice,
        test,
      }),
    }),
}

// ==================== AI 聊天相關 ====================

export const llmAPI = {
  chat: (query: string, userId?: string, eventId?: string) =>
    apiCall("/api/llm", {
      method: "POST",
      body: JSON.stringify({
        query,
        userId,
        eventId,
      }),
    }),
}

// ==================== 個人檔案相關 ====================

export const profileAPI = {
  getProfileByName: (name: string) =>
    apiCall("/api/profile-by-name", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
}

// ==================== 其他功能相關 ====================

export const otherAPI = {
  // LINE Notify
  notifyLine: (userId: string, message: string) =>
    apiCall("/api/line-notify", {
      method: "POST",
      body: JSON.stringify({ userId, message }),
    }),

  // Knowledge Gap - 知識庫
  getKnowledgeGap: (query: string) =>
    apiCall("/api/knowledge-gap", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  // Moderation - 內容審核
  moderateContent: (content: string) =>
    apiCall("/api/moderation", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // Decryption - 解密相關
  decryptionRequest: (data: any) =>
    apiCall("/api/decryption/request", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  decryptionReview: (data: any) =>
    apiCall("/api/decryption/review", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Announce - 公告
  getAnnouncements: () =>
    apiCall("/api/announce", { method: "GET" }),

  postAnnouncement: (title: string, content: string) =>
    apiCall("/api/announce", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }),

  // KMS - 知識管理系統
  getKMS: (query: string) =>
    apiCall("/api/kms", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  // Sync - 同步功能
  syncData: (type: string, data: any) =>
    apiCall("/api/sync", {
      method: "POST",
      body: JSON.stringify({ type, data }),
    }),
}

export default {
  auth: authAPI,
  packages: packagesAPI,
  visitors: visitorsAPI,
  feedback: feedbackAPI,
  fees: feesAPI,
  llm: llmAPI,
  profile: profileAPI,
  other: otherAPI,
}
