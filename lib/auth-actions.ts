"use server"

import { createClient } from "@supabase/supabase-js"

export type TenantId = "tenant_a" | "tenant_b"

export type UserRole = "resident" | "guard" | "committee" | "vendor" | "admin"

// Server-side tenant configuration (can access non-public env vars)
const TENANT_CONFIG = {
  tenant_a: {
    url: process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || "",
    name: "社區 A",
  },
  tenant_b: {
    url: process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_ANON_KEY || "",
    name: "社區 B",
  },
}

function validateTenantConfig(tenantId: TenantId) {
  const config = TENANT_CONFIG[tenantId]

  console.log(`[v0] Validating config for ${tenantId}:`, {
    hasUrl: !!config.url,
    hasKey: !!config.anonKey,
  })

  if (!config.url || !config.anonKey) {
    const missing = []
    if (!config.url) missing.push(`${tenantId.toUpperCase()}_SUPABASE_URL`)
    if (!config.anonKey) missing.push(`${tenantId.toUpperCase()}_SUPABASE_ANON_KEY`)

    throw new Error(
      `環境變數未設定：${missing.join(", ")}。請在 v0 左側邊欄的「Vars」區域或 .env.local 檔案中設定這些變數。`,
    )
  }

  return config
}

interface ParsedUnit {
  unit_number: string // Format: A-10-1001
  unit_code: string // Format: A棟-10F-1001
}

function parseUnitInput(input: string): ParsedUnit {
  const trimmed = input.trim()

  // Helper function to combine floor and room number
  const combineFloorRoom = (floor: number, room: number): string => {
    // Format: floor * 100 + room, with room padded to 2 digits
    const roomPadded = room.toString().padStart(2, "0")
    return `${floor}${roomPadded}`
  }

  // Pattern 1: Chinese format - A棟1樓1號, A棟12樓3號, B棟5層之2
  const chinesePattern = /^([A-Za-z0-9]+)棟?(\d+)[樓F層]?(?:之|-)?([\d]+)號?$/i
  const chineseMatch = trimmed.match(chinesePattern)

  if (chineseMatch) {
    const building = chineseMatch[1].toUpperCase()
    const floor = Number.parseInt(chineseMatch[2], 10)
    const roomNum = Number.parseInt(chineseMatch[3], 10)
    const room_number = combineFloorRoom(floor, roomNum)

    return {
      unit_number: `${building}-${floor}-${room_number}`,
      unit_code: `${building}棟-${floor}F-${room_number}`,
    }
  }

  // Pattern 2: Dash/separator format - C-3-302, A/5/12, B_6_601
  const dashPattern = /^([A-Za-z0-9]+)[-/_](\d+)[-/_](\d+)$/
  const dashMatch = trimmed.match(dashPattern)

  if (dashMatch) {
    const building = dashMatch[1].toUpperCase()
    const floor = Number.parseInt(dashMatch[2], 10)
    const room_number = dashMatch[3]

    return {
      unit_number: `${building}-${floor}-${room_number}`,
      unit_code: `${building}棟-${floor}F-${room_number}`,
    }
  }

  // Pattern 3: Compact format - A12F3, B5F12
  const compactPattern = /^([A-Za-z]+)(\d+)[Ff](\d+)$/
  const compactMatch = trimmed.match(compactPattern)

  if (compactMatch) {
    const building = compactMatch[1].toUpperCase()
    const floor = Number.parseInt(compactMatch[2], 10)
    const roomNum = Number.parseInt(compactMatch[3], 10)
    const room_number = combineFloorRoom(floor, roomNum)

    return {
      unit_number: `${building}-${floor}-${room_number}`,
      unit_code: `${building}棟-${floor}F-${room_number}`,
    }
  }

  // Pattern 4: Simple number format - 302, A302
  const simplePattern = /^([A-Za-z]?)(\d+)$/
  const simpleMatch = trimmed.match(simplePattern)

  if (simpleMatch) {
    const building = simpleMatch[1] ? simpleMatch[1].toUpperCase() : ""
    const roomNum = simpleMatch[2]

    // Try to extract floor from room number (e.g., 302 -> floor 3, room 02)
    if (roomNum.length >= 3 && building) {
      const floor = Number.parseInt(roomNum.substring(0, roomNum.length - 2), 10)
      return {
        unit_number: `${building}-${floor}-${roomNum}`,
        unit_code: `${building}棟-${floor}F-${roomNum}`,
      }
    }
  }

  // If no pattern matches, use input as-is
  return {
    unit_number: trimmed.toUpperCase(),
    unit_code: trimmed.toUpperCase(),
  }
}

// Server action to detect user tenant and authenticate
export async function authenticateUser(email: string, password: string) {
  console.log("[v0] Starting authentication for email:", email)

  try {
    // 使用相對路徑，自動支持所有環境（localhost、Vercel preview、Vercel production）
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    // 檢查 Content-Type，偵測 HTML 回應（Vercel Protect）
    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      console.error(
        "[v0] API 返回 HTML（被 Vercel Protect 攔截）。請在 Vercel Dashboard 關閉 'Require Authentication' 或為 /api/* 新增例外。",
      )
      return {
        success: false,
        error:
          "伺服器要求驗證（Vercel Protect 啟用中）。\n\n請告知管理者在 Vercel Dashboard 關閉 'Require Authentication' 或為 /api/* 路由新增例外。",
      }
    }

    // 嘗試解析 JSON
    let result
    try {
      result = await response.json()
    } catch (parseError) {
      const errorText = await response.text()
      console.error("[v0] Failed to parse JSON response:", parseError, errorText)
      if (errorText.startsWith("<")) {
        return {
          success: false,
          error:
            "伺服器要求驗證（Vercel Protect 啟用中）。\n\n請告知管理者在 Vercel Dashboard 關閉 'Require Authentication' 或為 /api/* 路由新增例外。",
        }
      }
      return {
        success: false,
        error: "API 回應格式錯誤",
      }
    }

    // 檢查 HTTP 狀態碼
    if (!response.ok) {
      console.error("[v0] API returned error status:", response.status)
      return {
        success: false,
        error: result?.message || `API 錯誤 (${response.status})`,
      }
    }

    // 使用 tenant_a 作為預設租戶（與原邏輯保持一致）
    const tenantId: TenantId = "tenant_a"
    const config = validateTenantConfig(tenantId)

    console.log("[v0] User authenticated successfully:", result.user.email)

    return {
      success: true,
      tenantId,
      tenantConfig: {
        url: config.url,
        anonKey: config.anonKey,
        name: config.name,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        phone: result.user.phone,
        room: result.user.room || "",
        unit_id: result.user.unit_id,
        status: result.user.status,
      },
    }
  } catch (err: any) {
    console.error("[v0] Authentication error:", err)
    return {
      success: false,
      error: err.message || "登入失敗，伺服器錯誤",
    }
  }
}

export async function registerUser(
  tenantId: TenantId,
  email: string,
  password: string,
  name: string,
  phone: string,
  unitNumber: string,
  role: UserRole,
  relationship: string,
) {
  try {
    console.log(`[v0] Registering user:`, email)
    console.log("[v0] Input data:", { email, name, phone, unitNumber, role, relationship })

    // 安全地拼接 API URL（移除結尾斜線，確保不產生雙斜線）
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
    const apiUrl = `${baseUrl}/api/auth/register`
    console.log("[v0] Calling API:", apiUrl)

    // 調用新的 /api/auth/register API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        email, 
        password, 
        name, 
        phone,
        role,
        relationship,
        unit: unitNumber
      }),
    })

    // 檢查 HTTP 狀態碼
    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Register API returned error status:", response.status, errorText)
      return {
        success: false,
        error: `API 錯誤 (${response.status}): ${errorText}`,
      }
    }

    // 嘗試解析 JSON
    let result
    try {
      result = await response.json()
    } catch (parseError) {
      console.error("[v0] Failed to parse register JSON response:", parseError)
      return {
        success: false,
        error: "API 回應格式錯誤",
      }
    }

    if (!result || !result.success) {
      console.error("[v0] Register API failed:", result?.message)
      return {
        success: false,
        error: result?.message || "註冊失敗，請稍後再試",
      }
    }

    console.log("[v0] User registered successfully:", result.user.email)

    return {
      success: true,
      user: result.user,
    }
  } catch (err: any) {
    console.error("[v0] Register exception:", err)
    return {
      success: false,
      error: err.message || "註冊失敗，請稍後再試",
    }
  }
}

// Server action to get tenant config
export async function getTenantConfig(tenantId: TenantId) {
  const config = TENANT_CONFIG[tenantId]
  return {
    url: config.url,
    anonKey: config.anonKey,
    name: config.name,
  }
}
