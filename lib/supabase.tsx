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

// Get current Supabase client
export function getSupabaseClient() {
  try {
    return createTenantClient()
  } catch (error) {
    console.error("[v0] Supabase client error:", error)
    // If tenant config is missing, redirect to auth page
    if (typeof window !== "undefined" && error instanceof Error && error.message.includes("Tenant configuration not found")) {
      window.location.href = "/auth"
    }
    throw error
  }
}



