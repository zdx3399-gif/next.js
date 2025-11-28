"use server"

import { createClient } from "@supabase/supabase-js"

export type TenantId = "tenant_a" | "tenant_b"
export type UserRole = "resident" | "guard" | "committee" | "vendor" | "admin"

// Server-side tenant configuration
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
  if (!config || !config.url || !config.anonKey) {
    throw new Error(`Configuration Error: Missing keys for ${tenantId}`)
  }
  return config
}

// 1. LOGIN FUNCTION
export async function authenticateUser(email: string, password: string) {
  const tenants: TenantId[] = ["tenant_a", "tenant_b"]
  
  for (const tenantId of tenants) {
    try {
      const config = validateTenantConfig(tenantId)
      const supabase = createClient(config.url, config.anonKey)

      const { data: users, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .eq("password", password) 

      if (users && users.length > 0) {
        return {
          success: true,
          tenantId,
          tenantConfig: { url: config.url, anonKey: config.anonKey, name: config.name },
          user: users[0],
        }
      }
    } catch (err) {
      continue
    }
  }
  return { success: false, error: "登入失敗：找不到此帳號或密碼錯誤。" }
}

// 2. REGISTER FUNCTION (Fixed with Upsert & Specific Connection)
export async function registerUser(
  tenantId: string,
  email: string,
  password: string,
  name: string,
  phone: string,
  unit: string,
  role: string,
  unitType: string = "", 
  monthlyFee: number = 0   
) {
  try {
    // A. Connect to the SPECIFIC Tenant Database
    const config = validateTenantConfig(tenantId as TenantId)
    const supabase = createClient(config.url, config.anonKey)

    // B. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, tenantId } },
    })

    if (authError) return { success: false, error: authError.message }
    if (!authData.user) return { success: false, error: "User creation failed" }

    // C. Upsert Profile (Saves Money & Password safely)
    const { error: profileError } = await supabase.from("profiles").upsert([
      {
        id: authData.user.id,
        email,
        password, // Storing password (as per your logic)
        name,
        phone,
        room: unit,
        role,
        tenant_id: tenantId,
        unit_type: unitType || null, 
        monthly_fee: monthlyFee || 0 
      },
    ])

    if (profileError) {
      return { success: false, error: "Profile Error: " + profileError.message }
    }

    return { success: true, user: authData.user }

  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function getTenantConfig(tenantId: TenantId) {
  const config = TENANT_CONFIG[tenantId]
  return { url: config.url, anonKey: config.anonKey, name: config.name }
}