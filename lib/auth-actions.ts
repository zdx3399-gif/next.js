"use server"

import { createClient } from "@supabase/supabase-js"

export type TenantId = "tenant_a" | "tenant_b"
export type UserRole = "resident" | "guard" | "committee" | "vendor" | "admin"

// --- CONFIGURATION (UPDATED to match your .env file) ---
const TENANT_CONFIG = {
  tenant_a: {
    // We now look for NEXT_PUBLIC_... variables
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

  // Debug log to help you see if it's reading the right keys
  console.log(`[v0] Validating config for ${tenantId}:`, {
    hasUrl: !!config.url,
    hasKey: !!config.anonKey,
  })

  if (!config.url || !config.anonKey) {
    const missing = []
    if (!config.url) missing.push(`NEXT_PUBLIC_${tenantId.toUpperCase()}_SUPABASE_URL`)
    if (!config.anonKey) missing.push(`NEXT_PUBLIC_${tenantId.toUpperCase()}_SUPABASE_ANON_KEY`)

    throw new Error(
      `環境變數未設定：${missing.join(", ")}。請檢查 .env.local 檔案。`,
    )
  }
  return config
}

// --- LOGIN (From anrui-main: Better logging structure) ---
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
        .select("*")
        .eq("email", email)
        .eq("password", password)

      if (error) {
        errors.push(`${config.name}: ${error.message}`)
        continue
      }

      if (users && users.length > 0) {
        const user = users[0]
        console.log(`[v0] User found in ${tenantId}:`, user.email)
        
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
            room: user.room,
            status: user.status,
            // Added safe accessors for anrui fields
            unit_type: user.unit_type || null, 
            monthly_fee: user.monthly_fee || 0
          },
        }
      }

      console.log(`[v0] No user found in ${tenantId}`)
    } catch (err: any) {
      console.error(`[v0] Error in ${tenantId}:`, err)
      if (err.message.includes("環境變數未設定")) {
        return { success: false, error: err.message }
      }
      errors.push(`${tenantId}: ${err.message}`)
    }
  }

  console.log("[v0] Authentication failed for all tenants")
  return {
    success: false,
    error: errors.length > 0
        ? `登入失敗：${errors.join("; ")}`
        : "登入失敗，請檢查您的帳號密碼。此帳號可能不存在於任何社區資料庫中。",
  }
}

// --- REGISTER (HYBRID: anrui logic inside anrui-main wrapper) ---
export async function registerUser(
  tenantId: TenantId,
  email: string,
  password: string,
  name: string,
  phone: string,
  room: string,        // Matches 'unit' from anrui
  role: UserRole,
  relationship: string, // Kept from anrui-main
  unitType: string = "", // Added from anrui (optional to prevent breaking)
  monthlyFee: number = 0 // Added from anrui (optional to prevent breaking)
) {
  try {
    console.log(`[v0] Registering user in ${tenantId}:`, email)
    const config = validateTenantConfig(tenantId)
    const supabase = createClient(config.url, config.anonKey)

    // 1. Create Supabase Auth User (Logic from anrui)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, tenantId } },
    })

    if (authError) {
      console.error("[v0] Auth SignUp Error:", authError)
      return { success: false, error: authError.message }
    }
    
    if (!authData.user) {
      return { success: false, error: "用戶建立失敗 (User creation failed)" }
    }

    // 2. Upsert Profile (Logic from anrui, mixed with anrui-main fields)
    console.log(`[v0] Auth created. Upserting profile for ID: ${authData.user.id}`)
    
    const { data, error: profileError } = await supabase
      .from("profiles")
      .upsert([
        {
          id: authData.user.id, // Link to Auth ID
          email,
          password, // Storing password as per your logic
          name,
          phone,
          room,     // 'unit' in anrui, 'room' in anrui-main
          role,
          relationship, // Field from anrui-main
          tenant_id: tenantId,
          unit_type: unitType || null, // Field from anrui
          monthly_fee: monthlyFee || 0, // Field from anrui
          status: "active",
        },
      ])
      .select()

    if (profileError) {
      console.error("[v0] Profile Upsert Error:", profileError)
      if (profileError.code === "23505") {
        return { success: false, error: "此電子郵件已被註冊 (Profile duplicate)" }
      }
      return { success: false, error: "個人資料建立失敗: " + profileError.message }
    }

    return {
      success: true,
      user: data?.[0] || authData.user,
    }

  } catch (err: any) {
    console.error("[v0] Register exception:", err)
    return {
      success: false,
      error: err.message || "註冊失敗，請稍後再試",
    }
  }
}

// --- GET CONFIG (From anrui-main) ---
export async function getTenantConfig(tenantId: TenantId) {
  const config = TENANT_CONFIG[tenantId]
  return {
    url: config.url,
    anonKey: config.anonKey,
    name: config.name,
  }
}