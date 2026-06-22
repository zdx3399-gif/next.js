/**
 * 共享的身份驗證服務邏輯
 * 供 server actions 和 API routes 使用
 */

import { createClient } from "@supabase/supabase-js"

export interface LoginResult {
  success: boolean
  message?: string
  error?: string
  user?: {
    id: string
    email: string
    name: string
    phone: string
    role: string
    status: string
    line_user_id?: string
    line_display_name?: string
    line_avatar_url?: string
    line_status_message?: string
    tenant_id: string
    unit_id?: string
    created_at: string
  }
  tenant_id?: string
}

function resolveSupabaseCredentials() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""

  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TENANT_A_SUPABASE_SERVICE_ROLE_KEY ||
    ""

  return {
    url,
    anonKey,
    serviceRoleKey,
    source:
      process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
        ? "SUPABASE_URL/SUPABASE_ANON_KEY"
        : process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL && process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY
          ? "NEXT_PUBLIC_TENANT_A_SUPABASE_URL/NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY"
          : process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            ? "NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY"
            : "",
  }
}

/**
 * 執行登入驗證（共享邏輯）
 */
export async function performLogin(email: string, password: string): Promise<LoginResult> {
  try {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    console.log("[v0] performLogin: Starting authentication for:", normalizedEmail)

    // 檢查環境變數
    const { url, anonKey, serviceRoleKey, source } = resolveSupabaseCredentials()
    if (!url || !anonKey) {
      console.error("[v0] Missing Supabase environment variables for login")
      return {
        success: false,
        error: "伺服器設定錯誤 - 缺少 Supabase 憑證（請設定 SUPABASE_URL/SUPABASE_ANON_KEY 或 NEXT_PUBLIC_TENANT_A_SUPABASE_URL/NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY）",
      }
    }

    console.log("[v0] performLogin: Using Supabase credentials source:", source)
    const supabaseAuth = createClient(url, anonKey)
    const supabaseDb = createClient(url, serviceRoleKey || anonKey)

    if (!serviceRoleKey) {
      console.warn("[v0] performLogin: SUPABASE_SERVICE_ROLE_KEY not set, profiles query may be affected by RLS")
    }

    if (!normalizedEmail || !password) {
      return {
        success: false,
        error: "Email 和密碼為必填",
      }
    }

    const PROFILE_SELECT_FULL = `
      id,
      email,
      password,
      name,
      phone,
      role,
      status,
      line_user_id,
      line_display_name,
      line_avatar_url,
      line_status_message,
      tenant_id,
      unit_id,
      created_at
    `

    const PROFILE_SELECT_FALLBACK = `
      id,
      email,
      password,
      name,
      phone,
      role,
      status,
      tenant_id,
      unit_id,
      created_at
    `

    const isMissingColumnError = (message?: string) => {
      const text = (message || "").toLowerCase()
      return text.includes("column") && text.includes("does not exist")
    }

    const queryProfileById = async (userId: string) => {
      const full = await supabaseDb.from("profiles").select(PROFILE_SELECT_FULL).eq("id", userId).maybeSingle()

      if (!full.error || !isMissingColumnError(full.error.message)) {
        return full
      }

      console.warn("[v0] profiles query fallback by id due to missing column:", full.error.message)
      return await supabaseDb.from("profiles").select(PROFILE_SELECT_FALLBACK).eq("id", userId).maybeSingle()
    }

    const queryProfileByEmail = async (targetEmail: string) => {
      const full = await supabaseDb
        .from("profiles")
        .select(PROFILE_SELECT_FULL)
        .ilike("email", targetEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!full.error || !isMissingColumnError(full.error.message)) {
        return full
      }

      console.warn("[v0] profiles query fallback by email due to missing column:", full.error.message)
      return await supabaseDb
        .from("profiles")
        .select(PROFILE_SELECT_FALLBACK)
        .ilike("email", targetEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    }

    let resolvedUser: any = null

    // 1) 優先走 Supabase Auth（加密密碼的正式來源）
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (!authError && authData.user) {
      const { data: profileById, error: profileError } = await queryProfileById(authData.user.id)

      if (!profileError && profileById) {
        resolvedUser = profileById
      } else {
        // 相容資料重建場景：auth.users id 與 profiles.id 可能不一致，改以 email 補抓
        const { data: profileByEmail, error: profileByEmailError } = await queryProfileByEmail(normalizedEmail)

        if (profileByEmailError || !profileByEmail) {
          return {
            success: false,
            error: "登入成功但找不到個人資料，請聯繫管理員",
          }
        }

        resolvedUser = profileByEmail
      }
    } else {
      // 2) 舊資料相容：若 Auth 驗證失敗，嘗試 profiles 明文密碼
      const authMessage = authError?.message || ""
      const normalizedMsg = authMessage.toLowerCase()
      const isInvalidCredential = normalizedMsg.includes("invalid login credentials") || normalizedMsg.includes("invalid")

      if (!isInvalidCredential) {
        return {
          success: false,
          error: authMessage || "登入失敗",
        }
      }

      const { data: legacyProfile, error: legacyError } = await queryProfileByEmail(normalizedEmail)

      if (legacyError) {
        console.error("[v0] Legacy login failed: profiles query error", {
          email: normalizedEmail,
          message: legacyError.message,
        })
        return {
          success: false,
          error: `登入驗證失敗（profiles 查詢錯誤）：${legacyError.message}`,
        }
      }

      if (!legacyProfile) {
        console.warn("[v0] Legacy login failed: profile not found", { email: normalizedEmail })
      } else if (legacyProfile.password !== password) {
        console.warn("[v0] Legacy login failed: password mismatch", { email: normalizedEmail })
      }

      if (!legacyProfile || legacyProfile.password !== password) {
        return {
          success: false,
          error: "Email 或密碼錯誤",
        }
      }

      resolvedUser = legacyProfile
    }

    // 檢查帳號狀態
    const normalizedStatus = String(resolvedUser.status || "")
      .trim()
      .toLowerCase()

    if (normalizedStatus && normalizedStatus !== "active") {
      return {
        success: false,
        error: `帳號狀態不可登入（目前狀態：${resolvedUser.status}），請聯繫管理員`,
      }
    }

    // 更新最後登入時間
    await supabaseDb.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", resolvedUser.id)

    console.log("[v0] 登入成功:", { email: normalizedEmail, role: resolvedUser.role, tenant_id: resolvedUser.tenant_id })

    // 移除密碼後回傳
    const { password: _, ...userWithoutPassword } = resolvedUser

    return {
      success: true,
      message: "登入成功",
      user: userWithoutPassword,
      tenant_id: resolvedUser.tenant_id,
    }
  } catch (error) {
    console.error("[v0] performLogin error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "登入過程發生錯誤",
    }
  }
}
