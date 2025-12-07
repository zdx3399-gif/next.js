"use server"

import { createClient } from "@supabase/supabase-js"

export type TenantId = "tenant_a" | "tenant_b"

export type UserRole = "resident" | "guard" | "committee" | "vendor" | "admin"

// Server-side tenant configuration (can access non-public env vars)
const TENANT_CONFIG = {
  tenant_a: {
    url: process.env.TENANT_A_SUPABASE_URL || "",
    anonKey: process.env.TENANT_A_SUPABASE_ANON_KEY || "",
    name: "社區 A",
  },
  tenant_b: {
    url: process.env.TENANT_B_SUPABASE_URL || "",
    anonKey: process.env.TENANT_B_SUPABASE_ANON_KEY || "",
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

// Server action to detect user tenant and authenticate
export async function authenticateUser(email: string, password: string) {
  console.log("[v0] Starting authentication for email:", email)
  const tenants: TenantId[] = ["tenant_a", "tenant_b"]
  const errors: string[] = []

  for (const tenantId of tenants) {
    try {
      console.log(`[v0] Trying to authenticate in ${tenantId}`)
      const config = validateTenantConfig(tenantId)

      const supabase = createClient(config.url, config.anonKey)

      const { data: users, error } = await supabase
        .from("profiles")
        .select(`
          *,
          units ( id, unit_code )
        `)
        .eq("email", email)
        .eq("password", password)

      console.log(`[v0] ${tenantId} query result:`, {
        userCount: users?.length || 0,
        hasError: !!error,
        errorMessage: error?.message,
      })

      if (error) {
        errors.push(`${config.name}: ${error.message}`)
        continue
      }

      if (users && users.length > 0) {
        const user = users[0]
        console.log(`[v0] User found in ${tenantId}:`, user.email)
        // Found user in this tenant
        return {
          success: true,
          tenantId,
          tenantConfig: {
            url: config.url,
            anonKey: config.anonKey,
            name: config.name,
          },
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            room: user.units?.unit_code || "",
            unit_id: user.unit_id,
            status: user.status,
          },
        }
      }

      console.log(`[v0] No user found in ${tenantId}`)
    } catch (err: any) {
      console.error(`[v0] Error in ${tenantId}:`, err)
      if (err.message.includes("環境變數未設定")) {
        return {
          success: false,
          error: err.message,
        }
      }
      errors.push(`${tenantId}: ${err.message}`)
    }
  }

  console.log("[v0] Authentication failed for all tenants")
  return {
    success: false,
    error:
      errors.length > 0
        ? `登入失敗：${errors.join("; ")}`
        : "登入失敗，請檢查您的帳號密碼。此帳號可能不存在於任何社區資料庫中。",
  }
}

export async function registerUser(
  tenantId: TenantId,
  email: string,
  password: string,
  name: string,
  phone: string,
  room: string,
  role: UserRole,
  relationship: string,
) {
  try {
    console.log(`[v0] Registering user in ${tenantId}:`, email)
    const config = validateTenantConfig(tenantId)
    const supabase = createClient(config.url, config.anonKey)

    const { data, error } = await supabase
      .from("profiles")
      .insert([
        {
          email,
          password,
          name,
          phone,
          room,
          role,
          relationship,
          status: "active",
        },
      ])
      .select()

    console.log("[v0] Register result:", { hasData: !!data, hasError: !!error })

    if (error) {
      console.error("[v0] Register error:", error)
      if (error.code === "23505") {
        return {
          success: false,
          error: "此電子郵件已被註冊",
        }
      }
      return {
        success: false,
        error: error.message || "註冊失敗，請稍後再試",
      }
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "註冊失敗：未能建立用戶資料",
      }
    }

    return {
      success: true,
      user: data[0],
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
