"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { EmergencyManagementAdmin } from "@/features/emergencies/ui/EmergencyManagementAdmin"
import { ArduinoConsole } from "@/features/arduino/ui/ArduinoConsole"
import { canAccessSection, getRoleLabel, shouldUseBackend, type UserRole } from "@/lib/permissions"

interface StoredUser {
  id?: string
  name?: string
  role?: string
}

export default function AdminEventsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser")
    if (!storedUser) {
      router.push("/auth")
      return
    }
    try {
      const user: StoredUser = JSON.parse(storedUser)
      if (!shouldUseBackend((user.role || "") as UserRole)) {
        router.push("/dashboard")
        return
      }
      setCurrentUser(user)
    } catch {
      router.push("/auth")
    } finally {
      setLoading(false)
    }
  }, [router])

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)] flex items-center justify-center">
        <div className="text-[var(--theme-text-primary)]">載入中...</div>
      </div>
    )
  }

  const normalizedRole = String(currentUser.role || "").trim().toLowerCase() as UserRole
  const canAccessEmergencies = canAccessSection(normalizedRole, "emergencies", false)
  const canAccessArduino = canAccessSection(normalizedRole, "arduino", false)

  if (!canAccessEmergencies && !canAccessArduino) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)] flex items-center justify-center">
        <div className="bg-[var(--theme-bg-card)] border-2 border-[var(--theme-danger)] rounded-2xl p-8 text-center max-w-md">
          <span className="material-icons text-6xl text-[var(--theme-danger)] mb-4 block">block</span>
          <h2 className="text-2xl font-bold text-[var(--theme-danger)] mb-2">沒有權限</h2>
          <p className="text-[var(--theme-text-primary)] mb-4">
            您的身份 ({getRoleLabel(normalizedRole)}) 無法訪問此功能
          </p>
          <button
            onClick={() => router.push("/admin")}
            className="px-4 py-2 rounded-lg bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] font-semibold hover:opacity-90 transition-all"
          >
            返回後台
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 頁頭 */}
        <div className="flex items-center justify-between">
          <h1 className="text-[var(--theme-accent)] text-2xl font-bold flex items-center gap-2">
            <span className="material-icons">sensors</span>
            IoT 事件管理
          </h1>
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-colors text-sm"
          >
            <span className="material-icons text-base">arrow_back</span>
            返回後台
          </button>
        </div>

        {/* IoT 控制台 */}
        {canAccessArduino && (
          <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
            <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
              <span className="material-icons">sensors</span>
              IoT 控制台
            </h2>
            <ArduinoConsole />
          </div>
        )}

        {/* 緊急事件管理 */}
        {canAccessEmergencies && (
          <EmergencyManagementAdmin
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            isPreviewMode={false}
          />
        )}
      </div>
    </div>
  )
}
