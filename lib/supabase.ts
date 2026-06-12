import { createBrowserClient } from "@supabase/ssr"

export type TenantId = "tenant_a" | "tenant_b"

// Get tenant from localStorage
export function getCurrentTenant(): TenantId {
  if (typeof window === "undefined") return "tenant_a"
  const stored = localStorage.getItem("currentTenant")
  return (stored as TenantId) || "tenant_a"
}

// Set current tenant
export function setCurrentTenant(tenantId: TenantId) {
  if (typeof window !== "undefined") {
    localStorage.setItem("currentTenant", tenantId)
  }
}

// Get tenant config from localStorage
export function getTenantConfigFromStorage() {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("tenantConfig")
  return stored ? JSON.parse(stored) : null
}

// Set tenant config in localStorage
export function setTenantConfig(config: { url: string; anonKey: string; name: string }) {
  if (typeof window !== "undefined") {
    localStorage.setItem("tenantConfig", JSON.stringify(config))
  }
}

// Create Supabase client for current tenant using stored config
export function createTenantClient() {
  const config = getTenantConfigFromStorage()
  if (!config) {
    throw new Error("Tenant configuration not found. Please log in again.")
  }
  return createBrowserClient(config.url, config.anonKey)
}

export function getSupabaseClient() {
  try {
    const config = getTenantConfigFromStorage()
    if (!config) {
      return null
    }
    return createBrowserClient(config.url, config.anonKey)
  } catch (error) {
    console.error("Failed to create Supabase client:", error)
    return null
  }
}

export const supabase = typeof window !== "undefined" ? getSupabaseClient() : null

// Create a Supabase client for a specific tenant using NEXT_PUBLIC env vars
export function createClientForTenant(tenantId: TenantId) {
  const url =
    tenantId === "tenant_a"
      ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || ""
      : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_URL || ""
  const anonKey =
    tenantId === "tenant_a"
      ? process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || ""
      : process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_ANON_KEY || ""
  if (!url || !anonKey) return null
  try {
    return createBrowserClient(url, anonKey)
  } catch {
    return null
  }
}

export const TENANT_LABELS: Record<TenantId, string> = {
  tenant_a: "社區 A",
  tenant_b: "社區 B",
}
