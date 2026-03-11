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
    console.log("[v0] performLogin: Starting authentication for:", email)

    // 檢查環境變數
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error("[v0] Missing Supabase environment variables")
      return {
        success: false,
        error: "伺服器設定錯誤 - 缺少 Supabase 憑證",
      }
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

    if (!email || !password) {
      return {
        success: false,
        error: "Email 和密碼為必填",
      }
    }

    // 查詢 profiles 表
    const { data: user, error: queryError } = await supabase
      .from("profiles")
      .select(
        `
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
      `,
      )
      .eq("email", email)
      .single()

    if (queryError || !user) {
      console.error("[v0] 查詢失敗或用戶不存在:", queryError)
      return {
        success: false,
        error: "Email 或密碼錯誤",
      }
    }

    // 檢查帳號狀態
    if (user.status !== "active") {
      return {
        success: false,
        error: "帳號已被停用，請聯繫管理員",
      }
    }

    // 驗證密碼（明文比對）
    if (user.password !== password) {
      return {
        success: false,
        error: "Email 或密碼錯誤",
      }
    }

    // 更新最後登入時間
    await supabase.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", user.id)

    console.log("[v0] 登入成功:", { email, role: user.role, tenant_id: user.tenant_id })

    // 移除密碼後回傳
    const { password: _, ...userWithoutPassword } = user

    return {
      success: true,
      message: "登入成功",
      user: userWithoutPassword,
      tenant_id: user.tenant_id,
    }
  } catch (error) {
    console.error("[v0] performLogin error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "登入過程發生錯誤",
    }
  }
}
