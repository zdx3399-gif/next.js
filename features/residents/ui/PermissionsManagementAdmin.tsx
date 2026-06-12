"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  CUSTOMIZABLE_SECTIONS,
  USER_ROLES,
  clearRolePermissionOverrides,
  getAllowedSections,
  getRoleLabel,
  setRolePermissionOverrides,
  type Section,
  type UserRole,
} from "@/lib/permissions"
import {
  loadRolePermissionsForTenant,
  saveRolePermissionsForTenant,
} from "@/lib/role-permission-service"
import { getCurrentTenant, TENANT_LABELS, type TenantId } from "@/lib/supabase"

type PermissionPageMode = "resident" | "admin"

const SECTION_LABELS_BY_MODE: Record<PermissionPageMode, Partial<Record<Section, string>>> = {
  resident: {
    profile: "個人資料",
    announcements: "公告",
    votes: "社區投票",
    maintenance: "設備/維護",
    finance: "管理費/收支",
    packages: "我的包裹",
    visitors: "訪客紀錄",
    meetings: "會議記錄",
    emergencies: "緊急事件",
    facilities: "設施預約",
    community: "社區討論",
    "knowledge-base": "知識庫",
    "handover-knowledge": "交接知識庫",
  },
  admin: {
    profile: "個人資料",
    announcements: "公告管理",
    "announcement-details": "公告詳情",
    votes: "投票管理",
    maintenance: "設備/維護管理",
    finance: "財務管理",
    residents: "住戶/人員",
    packages: "包裹管理",
    visitors: "訪客管理",
    meetings: "會議管理",
    emergencies: "緊急事件管理",
    facilities: "設施管理",
    community: "社區討論管理",
    "knowledge-base": "知識庫管理",
    "handover-knowledge": "交接知識庫",
    moderation: "內容審核",
    "audit-logs": "稽核紀錄",
    decryption: "解密申請",
  },
}

const RESIDENT_MODE_SECTIONS: Section[] = [
  "profile",
  "announcements",
  "votes",
  "maintenance",
  "finance",
  "packages",
  "visitors",
  "meetings",
  "emergencies",
  "facilities",
  "community",
  "knowledge-base",
  "handover-knowledge",
]

const ADMIN_MODE_SECTIONS: Section[] = [
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
  "moderation",
  "audit-logs",
  "decryption",
]

interface PermissionsManagementAdminProps {
  isPreviewMode?: boolean
}

export function PermissionsManagementAdmin({ isPreviewMode = false }: PermissionsManagementAdminProps) {
  const [selectedTenant, setSelectedTenant] = useState<TenantId>(() =>
    typeof window !== "undefined" ? getCurrentTenant() : "tenant_a"
  )
  const [permissionPageMode, setPermissionPageMode] = useState<PermissionPageMode>("admin")
  const [permissionSaving, setPermissionSaving] = useState(false)
  const [permissionLoading, setPermissionLoading] = useState(false)

  const makeEmptyDraft = () => {
    const empty = {} as Record<PermissionPageMode, Record<UserRole, Section[]>>
    empty.resident = {} as Record<UserRole, Section[]>
    empty.admin = {} as Record<UserRole, Section[]>
    USER_ROLES.forEach((role) => {
      empty.resident[role] = getAllowedSections(role, true).filter((s) => s !== "dashboard")
      empty.admin[role] = getAllowedSections(role, false).filter((s) => s !== "dashboard")
    })
    return empty
  }

  const [permissionDraft, setPermissionDraft] = useState<Record<PermissionPageMode, Record<UserRole, Section[]>>>(makeEmptyDraft)

  const displayedSections = useMemo(
    () => (permissionPageMode === "resident" ? RESIDENT_MODE_SECTIONS : ADMIN_MODE_SECTIONS),
    [permissionPageMode],
  )

  useEffect(() => {
    if (isPreviewMode) return

    const load = async () => {
      setPermissionLoading(true)
      setPermissionDraft(makeEmptyDraft())
      const payload = await loadRolePermissionsForTenant(selectedTenant)
      setPermissionLoading(false)
      if (!payload) return
      setPermissionDraft((prev) => {
        const next = { ...prev }
        for (const role of USER_ROLES) {
          if (payload.residentMode?.[role]) next.resident[role] = payload.residentMode[role] || []
          if (payload.adminMode?.[role]) next.admin[role] = payload.adminMode[role] || []
        }
        return next
      })
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenant, isPreviewMode])

  const togglePermission = (role: UserRole, section: Section) => {
    setPermissionDraft((prev) => {
      const current = prev[permissionPageMode][role] || []
      const next = current.includes(section) ? current.filter((s) => s !== section) : [...current, section]
      return {
        ...prev,
        [permissionPageMode]: {
          ...prev[permissionPageMode],
          [role]: next,
        },
      }
    })
  }

  const handleSavePermissions = async () => {
    setPermissionSaving(true)

    const residentMode: Partial<Record<UserRole, Section[]>> = {}
    const adminMode: Partial<Record<UserRole, Section[]>> = {}
    USER_ROLES.forEach((role) => {
      residentMode[role] = permissionDraft.resident[role] || []
      adminMode[role] = permissionDraft.admin[role] || []
    })

    const saved = await saveRolePermissionsForTenant(selectedTenant, { residentMode, adminMode })
    setPermissionSaving(false)

    if (saved) {
      window.alert(`「${TENANT_LABELS[selectedTenant]}」權限設定已儲存，重新整理後生效。`)
      return
    }

    window.alert(`「${TENANT_LABELS[selectedTenant]}」儲存失敗，請確認該社區已建立 system_settings 資料表。`)
  }

  const handleResetPermissions = () => {
    setPermissionDraft(makeEmptyDraft())
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
          <span className="material-icons">admin_panel_settings</span>
          社區功能模組權限
        </h2>
      </div>

      {/* 社區選擇器 */}
      <div className="mb-5 p-4 bg-[var(--theme-accent-light)] border border-[var(--theme-border)] rounded-xl">
        <div className="text-xs text-[var(--theme-text-secondary)] mb-2 font-medium">選擇要設定的社區</div>
        <div className="flex gap-2">
          {(Object.keys(TENANT_LABELS) as TenantId[]).map((tid) => (
            <button
              key={tid}
              onClick={() => setSelectedTenant(tid)}
              disabled={isPreviewMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all disabled:opacity-50 ${
                selectedTenant === tid
                  ? "border-[var(--theme-border-accent)] bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
                  : "border-[var(--theme-border)] text-[var(--theme-text-primary)] hover:border-[var(--theme-border-accent)]"
              }`}
            >
              <span className="material-icons text-base">location_city</span>
              {TENANT_LABELS[tid]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-[var(--theme-accent-light)] border border-[var(--theme-border)] rounded-xl p-3 text-sm text-[var(--theme-text-primary)]">
          透過勾選調整各身分可使用的功能，且可分別設定住戶端與管理端。首頁固定保留，不在此清單中。
        </div>

        <div className="flex gap-2">
          <Button
            variant={permissionPageMode === "resident" ? "default" : "outline"}
            onClick={() => setPermissionPageMode("resident")}
            disabled={permissionLoading}
          >
            住戶頁面權限
          </Button>
          <Button
            variant={permissionPageMode === "admin" ? "default" : "outline"}
            onClick={() => setPermissionPageMode("admin")}
            disabled={permissionLoading}
          >
            管理頁面權限
          </Button>
        </div>

        {permissionLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[var(--theme-accent)]" />
            <span className="ml-3 text-sm text-[var(--theme-text-secondary)]">載入{TENANT_LABELS[selectedTenant]}權限設定中...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--theme-border)] rounded-xl">
          <table className="w-full table-auto border-collapse text-sm min-w-[960px]">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] w-[220px]">功能</th>
                {USER_ROLES.map((role) => (
                  <th key={role} className="p-3 text-center text-[var(--theme-accent)] border-b border-[var(--theme-border)]">
                    {getRoleLabel(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedSections.map((section) => (
                <tr key={section} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {SECTION_LABELS_BY_MODE[permissionPageMode][section] || section}
                  </td>
                  {USER_ROLES.map((role) => {
                    const checked = (permissionDraft[permissionPageMode][role] || []).includes(section)
                    return (
                      <td key={`${role}-${section}`} className="p-3 border-b border-[var(--theme-border)] text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(role, section)}
                          disabled={isPreviewMode}
                          className="w-4 h-4 accent-[var(--theme-accent)] disabled:opacity-50"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={handleResetPermissions} disabled={isPreviewMode || permissionLoading}>
            重設為預設
          </Button>
          <Button onClick={handleSavePermissions} disabled={permissionSaving || isPreviewMode || permissionLoading}>
            {permissionSaving ? "儲存中..." : `儲存「${TENANT_LABELS[selectedTenant]}」權限設定`}
          </Button>
        </div>
      </div>
    </div>
  )
}
