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

/**
 * 執行登入驗證（共享邏輯）
 */
export async function performLogin(email: string, password: string): Promise<LoginResult> {
  try {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    console.log("[v0] performLogin: Starting authentication for:", normalizedEmail)

    // 檢查環境變數
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error("[v0] Missing Supabase environment variables")
      return {
        success: false,
        error: "伺服器設定錯誤 - 缺少 Supabase 憑證",
      }
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

    if (!normalizedEmail || !password) {
      return {
        success: false,
        error: "Email 和密碼為必填",
      }
    }

    const PROFILE_SELECT = `
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

    let resolvedUser: any = null

    // 1) 優先走 Supabase Auth（加密密碼的正式來源）
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (!authError && authData.user) {
      const { data: profileById, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", authData.user.id)
        .maybeSingle()

      if (profileError || !profileById) {
        return {
          success: false,
          error: "登入成功但找不到個人資料，請聯繫管理員",
        }
      }

      resolvedUser = profileById
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

      const { data: legacyProfile, error: legacyError } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .ilike("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (legacyError || !legacyProfile || legacyProfile.password !== password) {
        return {
          success: false,
          error: "Email 或密碼錯誤",
        }
      }

      resolvedUser = legacyProfile
    }

    // 檢查帳號狀態
    if (resolvedUser.status !== "active") {
      return {
        success: false,
        error: "帳號已被停用，請聯繫管理員",
      }
    }

    // 更新最後登入時間
    await supabase.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", resolvedUser.id)

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
