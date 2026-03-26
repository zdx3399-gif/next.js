"use server"

import { createClient } from "@supabase/supabase-js"

export type TenantId = "tenant_a" | "tenant_b"

export type UserRole = "resident" | "guard" | "committee" | "admin"

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

import { performLogin } from "./auth-service"

// Server action to detect user tenant and authenticate
export async function authenticateUser(email: string, password: string) {
  console.log("[v0] Starting authentication for email:", email)

  try {
    // 直接調用共享的登入邏輯（不用 HTTP fetch，避免 server-side 相對路徑問題）
    const result = await performLogin(email, password)

    // 檢查登入是否成功
    if (!result.success || !result.user) {
      console.error("[v0] Login failed:", result.error)
      return {
        success: false,
        error: result.error || result.message || "登入失敗",
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
        room: "", // 暫時留空，後續可從 unit_id 查詢
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
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    if (!normalizedEmail || !password) {
      return {
        success: false,
        error: "Email 和密碼為必填",
      }
    }

    console.log(`[v0] Registering user:`, normalizedEmail)
    console.log("[v0] Input data:", { email: normalizedEmail, name, phone, unitNumber, role, relationship, tenantId })

    const config = validateTenantConfig(tenantId)
    const supabase = createClient(config.url, config.anonKey)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    })

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message || "註冊失敗",
      }
    }

    let unitId: string | null = null
    if (unitNumber) {
      const parsed = parseUnitInput(unitNumber)
      const { data: existingUnit } = await supabase
        .from("units")
        .select("id")
        .eq("unit_code", parsed.unit_code)
        .maybeSingle()

      if (existingUnit) {
        unitId = existingUnit.id
      } else {
        const { data: newUnit, error: createUnitError } = await supabase
          .from("units")
          .insert([{ unit_code: parsed.unit_code, unit_number: parsed.unit_number }])
          .select("id")
          .single()

        if (createUnitError) {
          console.warn("[v0] Create unit failed:", createUnitError.message)
        } else {
          unitId = newUnit?.id || null
        }
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert([
        {
          id: authData.user.id,
          email: normalizedEmail,
          password,
          name: name || null,
          phone: phone || null,
          role: role || "resident",
          status: "active",
          tenant_id: tenantId,
          unit_id: unitId,
        },
      ])
      .select("*")
      .single()

    if (profileError || !profile) {
      return {
        success: false,
        error: profileError?.message || "建立用戶資訊失敗",
      }
    }

    if (unitId) {
      const { error: householdError } = await supabase
        .from("household_members")
        .insert([
          {
            name: name || null,
            role: role || "resident",
            relationship: relationship || "owner",
            unit_id: unitId,
            profile_id: profile.id,
          },
        ])
      if (householdError) {
        console.warn("[v0] 建立 household_member 失敗:", householdError.message)
      }
    }

    console.log("[v0] User registered successfully:", profile.email)

    return {
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        status: profile.status,
        unit_id: profile.unit_id,
      },
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
