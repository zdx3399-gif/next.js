import type { UserRole, Section } from "@/lib/permissions"
import {
  USER_ROLES,
  clearRolePermissionOverrides,
  setRolePermissionOverrides,
} from "@/lib/permissions"
import { getSupabaseClient, createClientForTenant, type TenantId } from "@/lib/supabase"

const ROLE_PERMISSION_SETTING_KEY = "role_permissions"

type RolePermissionPayload = Partial<Record<UserRole, Section[]>>
type ModePermissionPayload = {
  residentMode?: RolePermissionPayload
  adminMode?: RolePermissionPayload
}

function isTableMissingError(error: any): boolean {
  if (!error || typeof error !== "object") return false
  // Empty error object — typically means the table/relation doesn't exist
  // and PostgREST returned a non-standard error payload.
  if (Object.keys(error).length === 0) return true
  const message = String(error?.message || "")
  const hint = String(error?.hint || "")
  const details = String(error?.details || "")
  return (
    error?.code === "42P01" ||           // PostgreSQL undefined_table
    error?.code === "PGRST204" ||        // PostgREST: schema cache miss
    message.includes("system_settings") ||
    message.includes("does not exist") ||
    hint.includes("system_settings") ||
    details.includes("system_settings")
  )
}

export async function loadRolePermissionsFromSupabase(): Promise<ModePermissionPayload | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", ROLE_PERMISSION_SETTING_KEY)
    .maybeSingle()

  if (error) {
    if (!isTableMissingError(error)) {
      console.error("Failed to load role permissions from Supabase:", error)
    }
    return null
  }

  const value = data?.setting_value
  if (!value || typeof value !== "object") return {}

  const parsed = value as Record<string, any>

  // Backward compatibility: old shape { role: Section[] } maps to admin mode.
  const isLegacy = USER_ROLES.some((role) => Array.isArray(parsed[role]))
  if (isLegacy) {
    const legacy: RolePermissionPayload = {}
    for (const role of USER_ROLES) {
      if (Array.isArray(parsed[role])) {
        legacy[role] = parsed[role]
      }
    }
    return { adminMode: legacy, residentMode: {} }
  }

  const residentMode: RolePermissionPayload = {}
  const adminMode: RolePermissionPayload = {}

  for (const role of USER_ROLES) {
    if (Array.isArray(parsed?.residentMode?.[role])) {
      residentMode[role] = parsed.residentMode[role]
    }
    if (Array.isArray(parsed?.adminMode?.[role])) {
      adminMode[role] = parsed.adminMode[role]
    }
  }

  return { residentMode, adminMode }
}

export async function saveRolePermissionsToSupabase(payload: ModePermissionPayload): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const { error } = await supabase.from("system_settings").upsert(
    {
      setting_key: ROLE_PERMISSION_SETTING_KEY,
      setting_value: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" },
  )

  if (error) {
    if (!isTableMissingError(error)) {
      console.error("Failed to save role permissions to Supabase:", error)
    }
    return false
  }

  return true
}

export function applyRolePermissionOverridesToLocal(payload: ModePermissionPayload): void {
  clearRolePermissionOverrides()

  const residentMode = payload.residentMode || {}
  const adminMode = payload.adminMode || {}

  for (const role of USER_ROLES) {
    if (residentMode[role]) {
      setRolePermissionOverrides(role, residentMode[role] || [], true)
    }
    if (adminMode[role]) {
      setRolePermissionOverrides(role, adminMode[role] || [], false)
    }
  }
}

export async function syncRolePermissionsFromSupabase(): Promise<boolean> {
  const payload = await loadRolePermissionsFromSupabase()
  if (payload === null) return false
  applyRolePermissionOverridesToLocal(payload)
  return true
}

// ── Tenant-specific helpers for PermissionsManagementAdmin ──

function parsePermissionPayload(value: unknown): ModePermissionPayload {
  if (!value || typeof value !== "object") return {}
  const parsed = value as Record<string, any>

  const isLegacy = USER_ROLES.some((role) => Array.isArray(parsed[role]))
  if (isLegacy) {
    const legacy: RolePermissionPayload = {}
    for (const role of USER_ROLES) {
      if (Array.isArray(parsed[role])) legacy[role] = parsed[role]
    }
    return { adminMode: legacy, residentMode: {} }
  }

  const residentMode: RolePermissionPayload = {}
  const adminMode: RolePermissionPayload = {}
  for (const role of USER_ROLES) {
    if (Array.isArray(parsed?.residentMode?.[role])) residentMode[role] = parsed.residentMode[role]
    if (Array.isArray(parsed?.adminMode?.[role])) adminMode[role] = parsed.adminMode[role]
  }
  return { residentMode, adminMode }
}

export async function loadRolePermissionsForTenant(tenantId: TenantId): Promise<ModePermissionPayload | null> {
  const supabase = createClientForTenant(tenantId)
  if (!supabase) return null

  const { data, error } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", ROLE_PERMISSION_SETTING_KEY)
    .maybeSingle()

  if (error) {
    if (!isTableMissingError(error)) {
      console.error(`Failed to load role permissions for ${tenantId}:`, error)
    }
    return null
  }

  return parsePermissionPayload(data?.setting_value)
}

export async function saveRolePermissionsForTenant(
  tenantId: TenantId,
  payload: ModePermissionPayload,
): Promise<boolean> {
  const supabase = createClientForTenant(tenantId)
  if (!supabase) return false

  const { error } = await supabase.from("system_settings").upsert(
    {
      setting_key: ROLE_PERMISSION_SETTING_KEY,
      setting_value: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" },
  )

  if (error) {
    if (!isTableMissingError(error)) {
      console.error(`Failed to save role permissions for ${tenantId}:`, error)
    }
    return false
  }

  return true
}
