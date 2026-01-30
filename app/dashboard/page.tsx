"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"
import { canAccessSection, type UserRole } from "@/lib/permissions"
import { useAnnouncements } from "@/features/announcements/hooks/useAnnouncements"
import { AnnouncementCarousel } from "@/features/announcements/ui/AnnouncementCarousel"
import { AnnouncementDetails } from "@/features/announcements/ui/AnnouncementDetails"
import { PackageList } from "@/features/packages/ui/PackageList"
import { ProfileDropdown } from "@/features/profile/ui/ProfileDropdown"
import type { User } from "@/features/profile/api/profile"
import { VoteList } from "@/features/votes/ui/VoteList"
import { VisitorList } from "@/features/visitors/ui/VisitorList"
import { MaintenanceList } from "@/features/maintenance/ui/MaintenanceList"
import { FinanceList } from "@/features/finance/ui/FinanceList"
import { MeetingList } from "@/features/meetings/ui/MeetingList"
import { EmergencyButtons } from "@/features/emergencies/ui/EmergencyButtons"
import { FacilityList } from "@/features/facilities/ui/FacilityList"
import { AiChat } from "@/features/support/ui/AiChat"
import { ThemeToggle } from "@/components/theme-toggle"
import { CommunityBoard } from "@/features/community/ui/CommunityBoard"
import { KnowledgeBase } from "@/features/kms/ui/KnowledgeBase"

type Section =
  | "dashboard"
  | "announcements"
  | "packages"
  | "votes"
  | "maintenance"
  | "finance"
  | "visitors"
  | "meetings"
  | "emergencies"
  | "facilities"
  | "community"
  | "knowledge-base"

function getNameString(name: unknown): string {
  if (typeof name === "string") return name
  if (name && typeof name === "object" && "name" in name) {
    return String((name as { name: unknown }).name)
  }
  return ""
}

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentSection, setCurrentSection] = useState<Section>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleProfileUpdate = (user: User | null) => {
    setCurrentUser(user)
  }

  const {
    announcements,
    loading: announcementsLoading,
    likes: announcementLikes,
    toggleLike: toggleAnnouncementLike,
  } = useAnnouncements(true, currentUser?.id)

  useEffect(() => {
    initAuth()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadSectionData(currentSection)
    }
  }, [currentSection, currentUser])

  const initAuth = async () => {
    const storedUser = localStorage.getItem("currentUser")
    if (!storedUser) {
      router.push("/auth")
      return
    }
    try {
      const user = JSON.parse(storedUser)
      console.log("[v0] User role:", user.role)

      if (user.role !== "resident" && user.role !== "committee") {
        console.log("[v0] Non-resident user detected, redirecting to admin")
        router.push("/admin")
        return
      }

      const supabase = getSupabaseClient()
      const { data: userDataArray, error } = await supabase
        .from("profiles")
        .select(`
          *,
          units ( id, unit_code, unit_number )
        `)
        .eq("id", user.id)

      if (error) {
        console.error("[v0] Error fetching user profile:", error)
      }

      const userData = userDataArray && userDataArray.length > 0 ? userDataArray[0] : null

      if (!userData) {
        const updatedUser: User = {
          id: user.id,
          name: getNameString(user.name),
          email: user.email || "",
          phone: user.phone || "",
          role: user.role || "resident",
          status: user.status || "active",
          unit_id: user.unit_id || "",
          room: user.room || "",
        }
        setCurrentUser(updatedUser)
      } else {
        const updatedUser: User = {
          id: userData.id,
          name: getNameString(userData.name),
          email: userData.email || "",
          phone: userData.phone || "",
          role: userData.role || "resident",
          status: userData.status || "active",
          unit_id: userData.unit_id || "",
          room: userData.units?.unit_code || "",
        }
        setCurrentUser(updatedUser)
      }
    } catch (e: any) {
      console.error("[v0] Auth initialization failed:", e)
      alert(`初始化失敗：${e.message}`)
    }
  }

  const loadSectionData = async (section: Section) => {
    if (!currentUser?.id) return
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      switch (section) {
        default:
          break
      }
    } catch (error) {
      console.error("載入資料失敗:", error)
    } finally {
      setLoading(false)
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

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const switchSection = (section: Section) => {
    setCurrentSection(section)
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
      document.body.style.overflow = ""
    }
  }

  const logout = () => {
    localStorage.removeItem("currentUser")
    localStorage.removeItem("tenantConfig")
    router.push("/")
  }

  const switchToAdmin = () => {
    if (currentUser?.role === "committee") {
      localStorage.setItem("currentUser", JSON.stringify({ ...currentUser, role: "committee" }))
      router.push("/admin")
    }
  }

  const sectionTitles: Record<Section, string> = {
    dashboard: "首頁",
    announcements: "公告",
    packages: "包裹",
    votes: "投票",
    maintenance: "維修",
    finance: "管理費",
    visitors: "訪客",
    meetings: "會議記錄",
    emergencies: "緊急事件",
    facilities: "設施預約",
    community: "社區討論",
    "knowledge-base": "知識庫",
  }

  const allNavItems = [
    { id: "dashboard", icon: "dashboard", label: "首頁" },
    { id: "announcements", icon: "campaign", label: "公告詳情" },
    { id: "packages", icon: "inventory_2", label: "我的包裹" },
    { id: "votes", icon: "how_to_vote", label: "社區投票" },
    { id: "maintenance", icon: "build", label: "設備/維護" },
    { id: "finance", icon: "account_balance", label: "管理費/收支" },
    { id: "visitors", icon: "how_to_reg", label: "訪客紀錄" },
    { id: "meetings", icon: "event", label: "會議記錄" },
    { id: "emergencies", icon: "emergency", label: "緊急事件" },
    { id: "facilities", icon: "meeting_room", label: "設施預約" },
    { id: "community", icon: "forum", label: "社區討論" },
    { id: "knowledge-base", icon: "school", label: "知識庫" },
  ]

  const navItems = currentUser
    ? allNavItems.filter((item) => canAccessSection(currentUser.role as UserRole, item.id as any, true))
    : []

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)]">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99] lg:hidden" onClick={toggleSidebar} />
      )}
      {/* Sidebar */}
      <nav
        className={`fixed lg:static top-0 left-0 h-screen bg-[var(--theme-bg-card)] border-r-2 border-[var(--theme-border-accent)] overflow-y-auto overflow-x-hidden transition-all duration-300 z-[100] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-0 lg:hidden" : "lg:w-[280px]"}`}
      >
        <div className={`p-8 pb-6 border-b border-[var(--theme-border)] ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <div className="text-[var(--theme-accent)] font-bold text-xl">社區管理系統</div>
          {currentUser && <ProfileDropdown currentUser={currentUser} onUpdate={handleProfileUpdate} />}
        </div>

        <ul className="py-4">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => switchSection(item.id as Section)}
                className={`w-full flex gap-3 items-center px-6 py-3 text-[var(--theme-text-primary)] border-l-4 transition-all ${
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
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center px-4 py-3 border-b border-[var(--theme-border)] flex-shrink-0">
          <div className="flex gap-2 items-center text-[var(--theme-accent)] font-bold">
            <button onClick={toggleSidebar} className="material-icons cursor-pointer">
              menu
            </button>
            <span>{sectionTitles[currentSection]}</span>
          </div>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            {currentUser?.role === "committee" && (
              <button
                onClick={switchToAdmin}
                className="flex gap-2 items-center border-2 border-[var(--theme-border-accent)] rounded-lg px-3 py-2 bg-transparent text-[var(--theme-accent)] cursor-pointer font-semibold hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)] transition-all"
              >
                <span className="material-icons text-lg">admin_panel_settings</span>
                <span className="hidden sm:inline">管委會功能</span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex gap-2 items-center border-none rounded-lg px-3 py-2 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] cursor-pointer font-semibold hover:opacity-90"
            >
              <span className="material-icons text-lg">logout</span>
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </header>
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {currentSection === "dashboard" && (
            <section>
              {announcements.length > 0 && (
                <section className="mb-6 sm:mb-8">
                  <AnnouncementCarousel
                    announcements={announcements}
                    loading={announcementsLoading}
                    onLike={toggleAnnouncementLike}
                    onSelect={() => setCurrentSection("announcements")}
                    likes={announcementLikes}
                    currentUserId={currentUser?.id}
                  />
                </section>
              )}

              {/* Emergency Actions */}
              <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-xl p-3">
                <h3 className="flex items-center gap-1 text-[var(--theme-text-primary)]/90 text-sm font-bold mb-2">
                  <span className="material-icons">emergency</span>
                  <span className="text-[var(--theme-danger)] font-bold">緊急事件</span>
                </h3>
                <EmergencyButtons userName={currentUser?.name} onTrigger={() => {}} variant="sidebar" />
              </div>
            </section>
          )}
          {currentSection === "packages" && (
            <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
                <span className="material-icons">inventory_2</span>
                我的包裹
              </h2>
              <PackageList userRoom={currentUser?.room} currentUser={currentUser} />
            </div>
          )}
          {currentSection === "votes" && (
            <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
                <span className="material-icons">how_to_vote</span>
                社區投票
              </h2>
              <VoteList userId={currentUser?.id} userName={getNameString(currentUser?.name)} />
            </div>
          )}
          {currentSection === "maintenance" && (
            <MaintenanceList userId={currentUser?.id} userName={getNameString(currentUser?.name)} />
          )}
          {currentSection === "finance" && <FinanceList userRoom={currentUser?.room} />}
          {currentSection === "visitors" && <VisitorList userRoom={currentUser?.room} currentUser={currentUser} />}
          {currentSection === "meetings" && <MeetingList />}
          {currentSection === "emergencies" && (
            <EmergencyButtons userName={getNameString(currentUser?.name)} variant="full" />
          )}
          {currentSection === "facilities" && (
            <FacilityList
              userId={currentUser?.id}
              userName={getNameString(currentUser?.name)}
              userRoom={currentUser?.room}
            />
          )}
          {currentSection === "announcements" && (
            <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
                <span className="material-icons">campaign</span>
                公告詳情
              </h2>
              <AnnouncementDetails onClose={() => setCurrentSection("dashboard")} currentUser={currentUser} />
            </div>
          )}
          {currentSection === "community" && (
            <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
                <span className="material-icons">forum</span>
                社區討論
              </h2>
              <CommunityBoard currentUser={currentUser} />
            </div>
          )}
          {currentSection === "knowledge-base" && (
            <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
                <span className="material-icons">school</span>
                知識庫
              </h2>
              <KnowledgeBase currentUser={currentUser} />
            </div>
          )}
        </main>
      </div>
      {/* AI Chat */}
      <AiChat currentUser={currentUser} />
    </div>
  )
}
