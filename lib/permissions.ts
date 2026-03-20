export type UserRole = "resident" | "guard" | "committee" | "admin"
export type PermissionMode = "resident" | "admin"

export type Section =
  | "dashboard"
  | "profile"
  | "announcements"
  | "announcement-details"
  | "votes"
  | "maintenance"
  | "finance"
  | "residents"
  | "packages"
  | "visitors"
  | "meetings"
  | "emergencies"
  | "facilities"
  | "community"
  | "knowledge-base"
  | "handover-knowledge"
  | "ai-auto-fix"
  | "moderation"
  | "audit-logs"
  | "decryption"

export const USER_ROLES: UserRole[] = ["resident", "guard", "committee", "admin"]

export const CUSTOMIZABLE_SECTIONS: Section[] = [
  "profile",
  "announcements",
  "announcement-details",
  "votes",
  "maintenance",
  "finance",
  "residents",
  "packages",
  "visitors",
  "meetings",
  "emergencies",
  "facilities",
  "community",
  "knowledge-base",
  "handover-knowledge",
  "ai-auto-fix",
  "moderation",
  "audit-logs",
  "decryption",
]

const ROLE_PERMISSION_STORAGE_KEY = "customRolePermissionsByMode"
type RolePermissionOverrides = Record<PermissionMode, Partial<Record<UserRole, Section[]>>>

// Define which sections each role can access
const ROLE_PERMISSIONS: Record<UserRole, Section[]> = {
  // 租戶 (Tenant): Frontend only
  resident: [
    "dashboard",
    "profile",
    "announcements",
    "packages",
    "votes",
    "maintenance",
    "finance",
    "visitors",
    "meetings",
    "emergencies",
    "facilities",
    "community",
    "knowledge-base",
  ],

  // 警衛 (Guard): Backend - dashboard, packages, visitors only
  guard: ["dashboard", "packages", "visitors"],

  // 管委會 (Management Committee): 完整後台權限，包含資料管理
  committee: [
    "dashboard",
    "announcements",
    "announcement-details",
    "votes",
    "maintenance",
    "finance",
    "residents",
    "meetings",
    "emergencies",
    "facilities",
    "community",
    "knowledge-base",
    "handover-knowledge",
    "moderation",
    "audit-logs",
    "decryption",
  ],

  // 系統管理員 (Admin): 可看所有功能 UI，但用戶隱私資料會被遮蔽
  // 主要負責：解密申請覆核（第二層）、系統監控、稽核紀錄
  admin: [
    "dashboard",
    "profile",
    "announcements",
    "announcement-details",
    "votes",
    "maintenance",
    "finance",
    "residents",      // 可看列表但隱私資料遮蔽
    "meetings",
    "emergencies",
    "facilities",
    "community",      // 可看但作者資訊遮蔽
    "knowledge-base",
    "handover-knowledge",
    "ai-auto-fix",
    "moderation",     // 可看但用戶資料遮蔽
    "decryption",     // 解密申請覆核（第二層）
    "audit-logs",
  ],
}

// ============================================
// 系統管理員權限控制
// Admin 只能「預覽」UI 介面，不能看到社區真實資料
// ============================================

// Admin 可以存取但只能預覽（不能看到真實資料）的區塊
export const ADMIN_PREVIEW_ONLY_SECTIONS: Section[] = [
  "dashboard",
  "profile",
  "announcements",
  "announcement-details",
  "residents",
  "community",
  "moderation",
  "votes",
  "maintenance",
  "finance",
  "meetings",
  "emergencies",
  "facilities",
  "knowledge-base",
  "handover-knowledge",
  "ai-auto-fix",
  "packages",
  "visitors",
  "decryption",
  "audit-logs",
]

// Admin 可以正常操作的區塊（解密覆核、稽核紀錄）
export const ADMIN_FULL_ACCESS_SECTIONS: Section[] = [
  // Security policy: admin is UI preview only and cannot access real database records.
]

// 檢查 admin 是否為預覽模式（只能看 UI，不能看真實資料）
export function isAdminPreviewMode(role: UserRole, section: Section): boolean {
  return role === "admin"
}

// 檢查是否可以修改資料（admin 在預覽模式下不能修改）
export function canModifyData(role: UserRole, section: Section): boolean {
  if (role === "admin") {
    return ADMIN_FULL_ACCESS_SECTIONS.includes(section)
  }
  return true // 其他角色可以修改（依各自權限）
}

// 檢查是否可以查看社區真實資料
export function canViewCommunityData(role: UserRole): boolean {
  return role !== "admin" // admin 不能看真實資料
}

// 遮蔽用戶隱私資料的欄位
export const PRIVACY_FIELDS = [
  "email",
  "phone", 
  "unit_number",
  "full_name",
  "name",
  "address",
  "content",      // 貼文內容
  "title",        // 貼文標題
  "author_name",  // 作者名稱
] as const

// 遮蔽敏感資料（給 admin 看的版本）
export function maskPrivacyData<T extends Record<string, any>>(data: T, role: UserRole): T {
  if (role !== "admin") return data
  
  const masked: Record<string, any> = { ...data }
  for (const field of PRIVACY_FIELDS) {
    if (field in masked && masked[field]) {
      const value = String(masked[field])
      if (field === "email") {
        masked[field] = "***@***.com"
      } else if (field === "phone") {
        masked[field] = "****-***-***"
      } else if (field === "content" || field === "title") {
        masked[field] = "[內容已遮蔽 - 系統管理員無權查看]"
      } else {
        masked[field] = "***"
      }
    }
  }
  return masked as T
}

// 檢查用戶是否可以看到完整用戶資料（非遮蔽）
export function canViewFullUserData(role: UserRole): boolean {
  return role === "committee"
}

// 產生 admin 預覽模式的提示訊息
export function getAdminPreviewNotice(): string {
  return "您正在以系統管理員身份預覽此頁面，實際社區資料已被遮蔽以保護用戶隱私。"
}

const COMMITTEE_RESIDENT_PERMISSIONS: Section[] = [
  "dashboard",
  "profile",
  "announcements",
  "packages", // Committee members can view their own packages as residents
  "votes",
  "maintenance",
  "finance",
  "visitors", // Committee members can use visitor functions as residents
  "meetings",
  "emergencies",
  "facilities",
  "community",
  "knowledge-base",
  "handover-knowledge",
]

function normalizeOverrideSections(rawSections: unknown): Section[] {
  if (!Array.isArray(rawSections)) return []
  return rawSections.filter((section): section is Section => {
    return typeof section === "string" && CUSTOMIZABLE_SECTIONS.includes(section as Section)
  })
}

function getEmptyOverrides(): RolePermissionOverrides {
  return { resident: {}, admin: {} }
}

function getModeKey(isResidentMode = false): PermissionMode {
  return isResidentMode ? "resident" : "admin"
}

function getStoredRolePermissionOverrides(): RolePermissionOverrides {
  if (typeof window === "undefined") return getEmptyOverrides()

  try {
    const raw = window.localStorage.getItem(ROLE_PERMISSION_STORAGE_KEY)
    if (!raw) return getEmptyOverrides()

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const overrides: RolePermissionOverrides = getEmptyOverrides()

    // Backward compatibility: old shape { role: Section[] }
    const looksLegacy = USER_ROLES.some((role) => Array.isArray(parsed[role]))
    if (looksLegacy) {
      for (const role of USER_ROLES) {
        if (role in parsed) {
          overrides.admin[role] = normalizeOverrideSections(parsed[role])
        }
      }
      return overrides
    }

    for (const mode of ["resident", "admin"] as const) {
      const modeBlock = parsed[mode]
      if (!modeBlock || typeof modeBlock !== "object") continue
      for (const role of USER_ROLES) {
        if (role in (modeBlock as Record<string, unknown>)) {
          overrides[mode][role] = normalizeOverrideSections((modeBlock as Record<string, unknown>)[role])
        }
      }
    }

    return overrides
  } catch {
    return getEmptyOverrides()
  }
}

function getBaseAllowedSections(role: UserRole, isResidentMode = false): Section[] {
  if (role === "committee" && isResidentMode) {
    return COMMITTEE_RESIDENT_PERMISSIONS
  }

  return ROLE_PERMISSIONS[role] || []
}

export function setRolePermissionOverrides(role: UserRole, sections: Section[], isResidentMode = false): void {
  if (typeof window === "undefined") return

  const mode = getModeKey(isResidentMode)
  const current = getStoredRolePermissionOverrides()
  current[mode][role] = normalizeOverrideSections(sections)
  window.localStorage.setItem(ROLE_PERMISSION_STORAGE_KEY, JSON.stringify(current))
}

export function clearRolePermissionOverrides(role?: UserRole, isResidentMode?: boolean): void {
  if (typeof window === "undefined") return

  if (!role && isResidentMode === undefined) {
    window.localStorage.removeItem(ROLE_PERMISSION_STORAGE_KEY)
    return
  }

  const current = getStoredRolePermissionOverrides()

  if (!role && isResidentMode !== undefined) {
    const mode = getModeKey(isResidentMode)
    current[mode] = {}
  } else if (role && isResidentMode !== undefined) {
    const mode = getModeKey(isResidentMode)
    delete current[mode][role]
  } else if (role) {
    delete current.admin[role]
    delete current.resident[role]
  }

  window.localStorage.setItem(ROLE_PERMISSION_STORAGE_KEY, JSON.stringify(current))
}

export function getRolePermissionOverride(role: UserRole, isResidentMode = false): Section[] | null {
  const mode = getModeKey(isResidentMode)
  const overrides = getStoredRolePermissionOverrides()
  if (!(role in overrides[mode])) return null
  return overrides[mode][role] || []
}

export function canAccessSection(role: UserRole, section: Section, isResidentMode = false): boolean {
  const allowedSections = getAllowedSections(role, isResidentMode)
  return allowedSections.includes(section)
}

export function getAllowedSections(role: UserRole, isResidentMode = false): Section[] {
  const base = getBaseAllowedSections(role, isResidentMode)

  const override = getRolePermissionOverride(role, isResidentMode)
  if (override) {
    const sections: Section[] = ["dashboard", ...override]
    if (role === "admin" && !sections.includes("ai-auto-fix")) {
      sections.push("ai-auto-fix")
    }
    return sections
  }

  if (role === "admin" && !base.includes("ai-auto-fix")) {
    return [...base, "ai-auto-fix"]
  }

  return base
}

export function shouldUseBackend(role: UserRole): boolean {
  // Only residents use frontend, all others use backend
  return role !== "resident"
}

export function getRoleLabel(role: UserRole): string {
  const roleLabels: Record<UserRole, string> = {
    resident: "租戶",
    guard: "警衛",
    committee: "管委會",
    admin: "管理員",
  }
  return roleLabels[role] || "未知"
}
