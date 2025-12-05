"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { VoteManagementAdmin } from "@/features/votes/ui/VoteManagementAdmin"
import { PackageManagementAdmin } from "@/features/packages/ui/PackageManagementAdmin"
import { MaintenanceManagementAdmin } from "@/features/maintenance/ui/MaintenanceManagementAdmin"
import { FinanceManagementAdmin } from "@/features/finance/ui/FinanceManagementAdmin"
import { VisitorManagementAdmin } from "@/features/visitors/ui/VisitorManagementAdmin"
import { MeetingManagementAdmin } from "@/features/meetings/ui/MeetingManagementAdmin"
import { EmergencyManagementAdmin } from "@/features/emergencies/ui/EmergencyManagementAdmin"
import { FacilityManagementAdmin } from "@/features/facilities/ui/FacilityManagementAdmin"
import { ResidentManagementAdmin } from "@/features/residents/ui/ResidentManagementAdmin"
import { AnnouncementDetailsAdmin } from "@/features/announcements/ui/AnnouncementDetailsAdmin"
import { AnnouncementManagementAdmin } from "@/features/announcements/ui/AnnouncementManagementAdmin"
import { canAccessSection, getRoleLabel, shouldUseBackend, type UserRole } from "@/lib/permissions"
import { ProfileDropdown } from "@/features/profile/ui/ProfileDropdown"
import { useAnnouncements } from "@/features/announcements/hooks/useAnnouncements"
import { AnnouncementCarousel } from "@/features/announcements/ui/AnnouncementCarousel"
import { ThemeToggle } from "@/components/theme-toggle"

type User = {
  id: string
  email: string
  name: string
  role: string
  phone: string
  room: string
  status: string
}

type Section =
  | "dashboard"
  | "announcements"
  | "announcement-details" // 新增 announcement-details 到 Section 類型
  | "residents"
  | "packages"
  | "votes"
  | "maintenance"
  | "finance"
  | "visitors"
  | "meetings"
  | "emergencies"
  | "facilities"

export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentSection, setCurrentSection] = useState<Section>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const { announcements, loading: announcementsLoading, reload } = useAnnouncements(false)

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser")
    if (!storedUser) {
      router.push("/auth")
      return
    }

    try {
      const user = JSON.parse(storedUser)

      if (!shouldUseBackend(user.role as UserRole)) {
        router.push("/dashboard")
        return
      }

      setCurrentUser(user)
    } catch (e) {
      localStorage.removeItem("currentUser")
      router.push("/auth")
    }
  }, [router])

  const logout = () => {
    localStorage.removeItem("currentUser")
    router.push("/")
  }

  const switchToResident = () => {
    if (currentUser?.role === "committee") {
      localStorage.setItem("currentUser", JSON.stringify({ ...currentUser, role: "resident" }))
      router.push("/dashboard")
    }
  }

  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed(!sidebarCollapsed)
    } else {
      setSidebarOpen(!sidebarOpen)
      if (!sidebarOpen) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = ""
      }
    }
  }

  const allNavItems = [
    { id: "dashboard", icon: "dashboard", label: "首頁" },
    { id: "announcement-details", icon: "article", label: "公告詳情" },
    { id: "announcements", icon: "campaign", label: "公告管理" },
    { id: "votes", icon: "how_to_vote", label: "投票管理" },
    { id: "maintenance", icon: "build", label: "設備/維護" },
    { id: "finance", icon: "account_balance", label: "管理費/收支" },
    { id: "residents", icon: "people", label: "住戶/人員" },
    { id: "packages", icon: "inventory_2", label: "包裹管理" },
    { id: "visitors", icon: "how_to_reg", label: "訪客管理" },
    { id: "meetings", icon: "event", label: "會議/活動管理" },
    { id: "emergencies", icon: "emergency", label: "緊急事件管理" },
    { id: "facilities", icon: "meeting_room", label: "設施管理" },
  ]

  const navItems = currentUser
    ? allNavItems.filter((item) => canAccessSection(currentUser.role as UserRole, item.id as any, false))
    : allNavItems

  const hasAccess = currentUser ? canAccessSection(currentUser.role as UserRole, currentSection, false) : false

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99] lg:hidden" onClick={toggleSidebar} />
      )}

      <nav
        className={`fixed lg:static top-0 left-0 h-screen bg-[var(--theme-bg-card)] backdrop-blur-lg border-r-2 border-[var(--theme-border-accent)] overflow-y-auto overflow-x-hidden transition-all duration-300 z-[100] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-0 lg:hidden" : "lg:w-[280px]"}`}
      >
        <div className={`p-8 pb-6 border-b border-[var(--theme-border)] ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <div className="text-[var(--theme-accent)] font-bold text-xl">社區管理系統</div>
          {currentUser && (
            <ProfileDropdown
              currentUser={currentUser}
              onUpdate={setCurrentUser}
              getRoleLabel={(role) => getRoleLabel(role as UserRole)}
            />
          )}
        </div>

        <ul className="py-4">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => {
                  setCurrentSection(item.id as Section)
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(false)
                    document.body.style.overflow = ""
                  }
                }}
                className={`w-full flex items-center gap-3 px-6 py-3 text-[var(--theme-text-primary)] border-l-4 transition-all ${
                  currentSection === item.id
                    ? "bg-[var(--theme-accent-light)] border-[var(--theme-border-accent)] text-[var(--theme-accent)]"
                    : "border-transparent hover:bg-[var(--theme-accent-light)] hover:border-[var(--theme-border-accent)] hover:text-[var(--theme-accent)]"
                }`}
              >
                <span className="material-icons text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center px-4 py-3 bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border)] flex-shrink-0">
          <div className="flex items-center gap-2 text-[var(--theme-accent)] font-bold">
            <button
              onClick={toggleSidebar}
              className="material-icons p-1 rounded hover:bg-[var(--theme-accent-light)] transition-all lg:hidden"
            >
              menu
            </button>
            <span className="text-sm sm:text-base">
              {navItems.find((item) => item.id === currentSection)?.label || "首頁"}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            {currentUser?.role === "committee" && (
              <button
                onClick={switchToResident}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border-2 border-[var(--theme-border-accent)] rounded-lg text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)] transition-all font-semibold text-xs sm:text-sm"
              >
                <span className="material-icons text-base sm:text-lg">home</span>
                <span className="hidden sm:inline">住戶功能</span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg hover:opacity-90 transition-all font-semibold text-xs sm:text-sm"
            >
              <span className="material-icons text-base sm:text-lg">logout</span>
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          {!hasAccess && currentSection !== "dashboard" && currentSection !== "announcement-details" ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-[var(--theme-bg-card)] border-2 border-[var(--theme-danger)] rounded-2xl p-8 text-center max-w-md">
                <span className="material-icons text-6xl text-[var(--theme-danger)] mb-4">block</span>
                <h2 className="text-2xl font-bold text-[var(--theme-danger)] mb-2">沒有權限</h2>
                <p className="text-[var(--theme-text-primary)] mb-4">您的身份無法訪問此功能</p>
                <p className="text-[var(--theme-text-secondary)] text-sm">
                  您的身份：{getRoleLabel(currentUser?.role as UserRole)}
                </p>
              </div>
            </div>
          ) : currentSection === "dashboard" ? (
            <div className="space-y-4">
              {announcements.length > 0 && (
                <AnnouncementCarousel announcements={announcements} loading={announcementsLoading} />
              )}

              <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-[var(--theme-danger)] mb-4">
                  <span className="material-icons">emergency</span>
                  緊急事件
                </h2>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { icon: "local_hospital", title: "救護車 119", type: "救護車119", note: "醫療緊急狀況" },
                    { icon: "report_problem", title: "報警 110", type: "報警110", note: "治安緊急狀況" },
                    { icon: "favorite", title: "AED", type: "AED", note: "需要AED急救設備" },
                    { icon: "warning", title: "陌生人員闘入", type: "可疑人員", note: "陌生人員闘入警告" },
                  ].map((emergency) => (
                    <button
                      key={emergency.type}
                      className="bg-[var(--theme-bg-card)] border-2 border-[var(--theme-danger)] rounded-xl p-2 text-center cursor-pointer font-bold text-xs sm:text-sm text-[var(--theme-danger)] hover:bg-[rgba(244,67,54,0.2)] transition-all"
                    >
                      <div className="material-icons text-2xl mb-1">{emergency.icon}</div>
                      <h3 className="font-bold text-xs">{emergency.title}</h3>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : currentSection === "visitors" ? (
            <VisitorManagementAdmin currentUser={currentUser} />
          ) : currentSection === "packages" ? (
            <PackageManagementAdmin currentUser={currentUser} />
          ) : currentSection === "finance" ? (
            <FinanceManagementAdmin />
          ) : currentSection === "maintenance" ? (
            <MaintenanceManagementAdmin />
          ) : currentSection === "votes" ? (
            <VoteManagementAdmin />
          ) : currentSection === "announcement-details" ? (
            <AnnouncementDetailsAdmin onClose={() => setCurrentSection("dashboard")} currentUser={currentUser} />
          ) : currentSection === "meetings" ? (
            <MeetingManagementAdmin />
          ) : currentSection === "emergencies" ? (
            <EmergencyManagementAdmin currentUserName={currentUser?.name} />
          ) : currentSection === "facilities" ? (
            <FacilityManagementAdmin />
          ) : currentSection === "residents" ? (
            <ResidentManagementAdmin />
          ) : currentSection === "announcements" ? (
            <AnnouncementManagementAdmin />
          ) : null}
        </div>
      </main>
    </div>
  )
}