export type UserRole = "resident" | "guard" | "committee" | "vendor" | "admin"

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
  ],

  // 警衛 (Guard): Backend - dashboard, packages, visitors only
  guard: ["dashboard", "packages", "visitors"],

  // 管委會 (Management Committee): Backend access (no packages/visitors management)
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
  ],

  // 廠商 (Vendor): Backend - maintenance only
  vendor: ["dashboard", "maintenance"],

  // 管理員 (Admin): Full access except packages/visitors
  admin: [
    "dashboard",
    "profile",
    "announcements",
    "announcement-details",
    "votes",
    "maintenance",
    "finance",
    "residents",
    "meetings",
    "emergencies",
    "facilities",
  ],
}

const COMMITTEE_RESIDENT_PERMISSIONS: Section[] = [
  "dashboard",
  "profile",
  "announcements",
  "packages",  // Committee members can view their own packages as residents
  "votes",
  "maintenance",
  "finance",
  "visitors",  // Committee members can use visitor functions as residents
  "meetings",
  "emergencies",
  "facilities",
]

export function canAccessSection(role: UserRole, section: Section, isResidentMode: boolean = false): boolean {
  if (role === "committee" && isResidentMode) {
    return COMMITTEE_RESIDENT_PERMISSIONS.includes(section)
  }
  
  const allowedSections = ROLE_PERMISSIONS[role] || []
  return allowedSections.includes(section)
}

export function getAllowedSections(role: UserRole, isResidentMode: boolean = false): Section[] {
  if (role === "committee" && isResidentMode) {
    return COMMITTEE_RESIDENT_PERMISSIONS
  }
  
  return ROLE_PERMISSIONS[role] || []
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
    vendor: "廠商",
    admin: "管理員",
  }
  return roleLabels[role] || "未知"
}
