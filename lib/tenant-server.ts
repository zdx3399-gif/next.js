import { createClient } from "@supabase/supabase-js"

export type TenantId = "tenant_a" | "tenant_b"

function resolveTenantConfig(tenantId: TenantId) {
  const isTenantA = tenantId === "tenant_a"
  const url = isTenantA
    ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL
    : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_URL || process.env.SUPABASE_URL

  const key = isTenantA
    ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  return {
    url: url || "",
    key: key || "",
  }
}

export function createTenantServerClient(tenantId: TenantId) {
  const { url, key } = resolveTenantConfig(tenantId)
  if (!url || !key) {
    throw new Error(`Missing Supabase env for ${tenantId}`)
  }
  return createClient(url, key)
}

export function toTenantId(value: string | null | undefined): TenantId {
  return value === "tenant_b" ? "tenant_b" : "tenant_a"
}
