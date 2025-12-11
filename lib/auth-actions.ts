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

interface ParsedUnit {
  unit_number: string // Format: A-10-1001
  building: string | null
  floor: number | null
  room_number: string | null
  unit_code: string // Format: A棟-10F-1001
}

function parseUnitInput(input: string): ParsedUnit {
  const trimmed = input.trim()

  // Default result
  const result: ParsedUnit = {
    unit_number: trimmed,
    building: null,
    floor: null,
    room_number: null,
    unit_code: trimmed,
  }

  const combineFloorRoom = (floor: number, room: number): string => {
    // Format: floor * 100 + room, with room padded to 2 digits
    const roomPadded = room.toString().padStart(2, "0")
    return `${floor}${roomPadded}`
  }

  // Pattern 1: Chinese format - A棟1樓1號, A棟12樓3號, B棟5層之2
  const chinesePattern = /^([A-Za-z0-9]+)棟?(\d+)[樓F層]?(?:之|-)?([\d]+)號?$/i
  const chineseMatch = trimmed.match(chinesePattern)

  if (chineseMatch) {
    result.building = chineseMatch[1].toUpperCase()
    result.floor = Number.parseInt(chineseMatch[2], 10)
    const roomNum = Number.parseInt(chineseMatch[3], 10)
    result.room_number = combineFloorRoom(result.floor, roomNum)
    result.unit_number = `${result.building}-${result.floor}-${result.room_number}`
    result.unit_code = `${result.building}棟-${result.floor}F-${result.room_number}`
    return result
  }

  // Pattern 2: Dash/separator format - C-3-302, A/5/12, B_6_601
  const dashPattern = /^([A-Za-z0-9]+)[-/_](\d+)[-/_](\d+)$/
  const dashMatch = trimmed.match(dashPattern)

  if (dashMatch) {
    result.building = dashMatch[1].toUpperCase()
    result.floor = Number.parseInt(dashMatch[2], 10)
    result.room_number = dashMatch[3] // Already in combined format like 302, 1001
    result.unit_number = `${result.building}-${result.floor}-${result.room_number}`
    result.unit_code = `${result.building}棟-${result.floor}F-${result.room_number}`
    return result
  }

  // Pattern 3: Compact format - A12F3, B5F12
  const compactPattern = /^([A-Za-z]+)(\d+)[Ff](\d+)$/
  const compactMatch = trimmed.match(compactPattern)

  if (compactMatch) {
    result.building = compactMatch[1].toUpperCase()
    result.floor = Number.parseInt(compactMatch[2], 10)
    const roomNum = Number.parseInt(compactMatch[3], 10)
    result.room_number = combineFloorRoom(result.floor, roomNum)
    result.unit_number = `${result.building}-${result.floor}-${result.room_number}`
    result.unit_code = `${result.building}棟-${result.floor}F-${result.room_number}`
    return result
  }

  // Pattern 4: Simple number format - 302, A302
  const simplePattern = /^([A-Za-z]?)(\d+)$/
  const simpleMatch = trimmed.match(simplePattern)

  if (simpleMatch) {
    if (simpleMatch[1]) {
      result.building = simpleMatch[1].toUpperCase()
    }
    // Try to extract floor from room number (e.g., 302 -> floor 3, room 02)
    const roomNum = simpleMatch[2]
    if (roomNum.length >= 3) {
      result.floor = Number.parseInt(roomNum.substring(0, roomNum.length - 2), 10)
      result.room_number = roomNum // Keep original combined format
    } else {
      result.room_number = roomNum
    }
    if (result.building && result.floor !== null) {
      result.unit_number = `${result.building}-${result.floor}-${result.room_number}`
      result.unit_code = `${result.building}棟-${result.floor}F-${result.room_number}`
    } else {
      result.unit_number = trimmed.toUpperCase()
      result.unit_code = trimmed.toUpperCase()
    }
    return result
  }

  // If no pattern matches, use input as-is
  return result
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
  unitNumber: string,
  role: UserRole,
  relationship: string,
) {
  try {
    console.log(`[v0] Registering user in ${tenantId}:`, email)
    const config = validateTenantConfig(tenantId)
    const supabase = createClient(config.url, config.anonKey)

    const parsedUnit = parseUnitInput(unitNumber)
    console.log("[v0] Parsed unit:", parsedUnit)

    let unitId: string | null = null

    // First, try to find existing unit by unit_number OR unit_code
    const { data: existingUnit, error: findUnitError } = await supabase
      .from("units")
      .select("id")
      .or(`unit_number.eq.${parsedUnit.unit_number},unit_code.eq.${parsedUnit.unit_code}`)
      .maybeSingle()

    if (findUnitError) {
      console.error("[v0] Error finding unit:", findUnitError)
    }

    if (existingUnit) {
      unitId = existingUnit.id
      console.log("[v0] Found existing unit:", unitId)
    } else {
      const { data: newUnit, error: createUnitError } = await supabase
        .from("units")
        .insert([
          {
            unit_number: parsedUnit.unit_number,
            unit_code: parsedUnit.unit_code,
            building: parsedUnit.building,
            floor: parsedUnit.floor,
            room_number: parsedUnit.room_number,
          },
        ])
        .select("id")
        .single()

      if (createUnitError) {
        console.error("[v0] Error creating unit:", createUnitError)
        // If unit creation fails due to unique constraint, try to fetch it again
        if (createUnitError.code === "23505") {
          const { data: retryUnit } = await supabase
            .from("units")
            .select("id")
            .or(`unit_number.eq.${parsedUnit.unit_number},unit_code.eq.${parsedUnit.unit_code}`)
            .maybeSingle()
          if (retryUnit) {
            unitId = retryUnit.id
          }
        }
      } else if (newUnit) {
        unitId = newUnit.id
        console.log("[v0] Created new unit:", unitId)
      }
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .insert([
        {
          email,
          password,
          name,
          phone,
          role,
          status: "active",
          unit_id: unitId,
        },
      ])
      .select()

    console.log("[v0] Register result:", { hasData: !!profileData, hasError: !!profileError })

    if (profileError) {
      console.error("[v0] Register error:", profileError)
      if (profileError.code === "23505") {
        return {
          success: false,
          error: "此電子郵件已被註冊",
        }
      }
      return {
        success: false,
        error: profileError.message || "註冊失敗，請稍後再試",
      }
    }

    if (!profileData || profileData.length === 0) {
      return {
        success: false,
        error: "註冊失敗：未能建立用戶資料",
      }
    }

    const profile = profileData[0]

    if (unitId && relationship) {
      const { error: householdError } = await supabase.from("household_members").insert([
        {
          name,
          role,
          relationship,
          unit_id: unitId,
          profile_id: profile.id,
        },
      ])

      if (householdError) {
        console.error("[v0] Error creating household member:", householdError)
      } else {
        console.log("[v0] Created household member record")
      }
    }

    return {
      success: true,
      user: profile,
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
