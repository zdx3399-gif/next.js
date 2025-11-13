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

// Get tenant config from localStorage with fallback recovery
export function getTenantConfigFromStorage() {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("tenantConfig")
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      console.error("[v0] Failed to parse tenant config")
      localStorage.removeItem("tenantConfig")
      return null
    }
  }

  // This helps recover from config loss when navigating between pages
  const tenantId = getCurrentTenant()
  if (typeof process !== "undefined" && process.env) {
    const urlKey = tenantId === "tenant_a" ? "TENANT_A_SUPABASE_URL" : "TENANT_B_SUPABASE_URL"
    const keyKey = tenantId === "tenant_a" ? "TENANT_A_SUPABASE_ANON_KEY" : "TENANT_B_SUPABASE_ANON_KEY"

    const url = process.env[`NEXT_PUBLIC_${urlKey}`] || process.env[urlKey]
    const anonKey = process.env[`NEXT_PUBLIC_${keyKey}`] || process.env[keyKey]

    if (url && anonKey) {
      const config = { url, anonKey, name: `Tenant ${tenantId === "tenant_a" ? "A" : "B"}` }
      // Restore to localStorage for future reference
      localStorage.setItem("tenantConfig", JSON.stringify(config))
      return config
    }
  }

  return null
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

// Get current Supabase client with better error handling
export function getSupabaseClient() {
  try {
    return createTenantClient()
  } catch (error) {
    console.error("[v0] Supabase client error:", error)
    // If tenant config is missing, redirect to auth page
    if (
      typeof window !== "undefined" &&
      error instanceof Error &&
      error.message.includes("Tenant configuration not found")
    ) {
      // Give a short delay to allow current operation to complete
      setTimeout(() => {
        window.location.href = "/auth"
      }, 100)
    }
    throw error
  }
}
