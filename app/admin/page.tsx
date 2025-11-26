"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
import { canAccessSection, getRoleLabel, shouldUseBackend, type UserRole } from "@/lib/permissions"
import { ProfileDropdown } from "@/features/profile/ui/ProfileDropdown"
import { useAnnouncements } from "@/features/announcements/hooks/useAnnouncements"
import { AnnouncementCarousel } from "@/features/announcements/ui/AnnouncementCarousel"

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

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [imageFiles, setImageFiles] = useState<{ [key: number]: File | null }>({})

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

  useEffect(() => {
    if (
      currentSection !== "dashboard" &&
      currentSection !== "votes" &&
      currentSection !== "finance" &&
      currentSection !== "maintenance" &&
      currentSection !== "visitors" &&
      currentSection !== "packages" &&
      currentSection !== "meetings" &&
      currentSection !== "emergencies" &&
      currentSection !== "facilities"
    ) {
      loadData()
    }
  }, [currentSection])

  const loadData = async () => {
    setLoading(true)
    try {
      const tableMap: Record<string, string> = {
        announcements: "announcements",
      }

      const table = tableMap[currentSection]
      if (!table) return

      const supabase = createClient()
      const { data: fetchedData, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setData(fetchedData || [])
    } catch (e) {
      console.error(e)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (row: any, index: number) => {
    try {
      const tableMap: Record<string, string> = {
        announcements: "announcements",
      }

      const table = tableMap[currentSection]
      if (!table) return

      if (currentSection === "announcements" && imageFiles[index]) {
        const file = imageFiles[index]
        const reader = new FileReader()

        await new Promise((resolve, reject) => {
          reader.onload = () => {
            row.image_url = reader.result as string
            resolve(null)
          }
          reader.onerror = reject
          reader.readAsDataURL(file!)
        })
      }

      const supabase = createClient()

      if (row.id) {
        const { error } = await supabase.from(table).update(row).eq("id", row.id)
        if (error) throw error
        alert("儲存成功！")
      } else {
        const { id, ...rowWithoutId } = row
        const { error } = await supabase.from(table).insert([rowWithoutId])
        if (error) throw error
        alert("新增成功！")
      }

      if (imageFiles[index]) {
        const newImageFiles = { ...imageFiles }
        delete newImageFiles[index]
        setImageFiles(newImageFiles)
      }

      await loadData()
      if (currentSection === "announcements") await reload()
    } catch (e: any) {
      console.error(e)
      alert("操作失敗：" + e.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此筆資料？")) return

    try {
      const tableMap: Record<string, string> = {
        announcements: "announcements",
      }

      const table = tableMap[currentSection]
      if (!table) return

      const supabase = createClient()
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error

      alert("刪除成功！")
      await loadData()
      if (currentSection === "announcements") await reload()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
    }
  }

  const defaultRowMap: Record<"announcements", () => Record<string, any>> = {
    announcements: () => ({ title: "", content: "", image_url: "", author: currentUser?.name || "", status: "draft" }),
  }

  const handleAdd = () => {
    const newRow: any = { id: null }

    if (currentSection in defaultRowMap) {
      const defaultRowGenerator = defaultRowMap[currentSection as keyof typeof defaultRowMap]
      Object.assign(newRow, defaultRowGenerator())
    }

    setData([newRow, ...data])
  }

  const updateRow = (index: number, field: string, value: any) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    setData(newData)
  }

  const handleImageFileChange = (index: number, file: File | null) => {
    setImageFiles({ ...imageFiles, [index]: file })
  }

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
    { id: "announcements", icon: "campaign", label: "公告管理" },
    { id: "votes", icon: "how_to_vote", label: "投票管理" },
    { id: "maintenance", icon: "build", label: "設備/維護" },
    { id: "finance", icon: "account_balance", label: "管理費/收支" },
    { id: "residents", icon: "people", label: "住戶/人員" },
    { id: "packages", icon: "inventory_2", label: "包裹管理" },
    { id: "visitors", icon: "how_to_reg", label: "訪客管理" },
    { id: "meetings", icon: "event", label: "會議/活動" }, // Keep meetings here for navigation
    { id: "emergencies", icon: "emergency", label: "緊急事件" },
    { id: "facilities", icon: "meeting_room", label: "設施管理" },
  ]

  const navItems = currentUser
    ? allNavItems.filter((item) => canAccessSection(currentUser.role as UserRole, item.id as any, false))
    : allNavItems

  const hasAccess = currentUser ? canAccessSection(currentUser.role as UserRole, currentSection, false) : false

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99] lg:hidden" onClick={toggleSidebar} />
      )}

      <nav
        className={`fixed lg:static top-0 left-0 h-screen bg-[rgba(45,45,45,0.95)] backdrop-blur-lg border-r-2 border-[#ffd700] overflow-y-auto overflow-x-hidden transition-all duration-300 z-[100] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-0 lg:hidden" : "lg:w-[280px]"}`}
      >
        <div className={`p-8 pb-6 border-b border-[rgba(255,215,0,0.3)] ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <div className="text-[#ffd700] font-bold text-xl">社區管理系統</div>
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
                className={`w-full flex items-center gap-3 px-6 py-3 text-white border-l-4 transition-all ${
                  currentSection === item.id
                    ? "bg-[rgba(255,215,0,0.1)] border-[#ffd700] text-[#ffd700]"
                    : "border-transparent hover:bg-[rgba(255,215,0,0.1)] hover:border-[#ffd700] hover:text-[#ffd700]"
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
        <header className="flex justify-between items-center px-4 py-3 bg-[#1a1a1a] border-b border-[rgba(255,215,0,0.2)] flex-shrink-0">
          <div className="flex items-center gap-2 text-[#ffd700] font-bold">
            <button
              onClick={toggleSidebar}
              className="material-icons p-1 rounded hover:bg-[rgba(255,215,0,0.2)] transition-all lg:hidden"
            >
              menu
            </button>
            <span className="text-sm sm:text-base">
              {navItems.find((item) => item.id === currentSection)?.label || "首頁"}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            {currentUser?.role === "committee" && (
              <button
                onClick={switchToResident}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border-2 border-[#ffd700] rounded-lg text-[#ffd700] hover:bg-[#ffd700] hover:text-[#1a1a1a] transition-all font-semibold text-xs sm:text-sm"
              >
                <span className="material-icons text-base sm:text-lg">home</span>
                <span className="hidden sm:inline">住戶功能</span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-[#ffd700] text-[#1a1a1a] rounded-lg hover:bg-[#ffed4e] transition-all font-semibold text-xs sm:text-sm"
            >
              <span className="material-icons text-base sm:text-lg">logout</span>
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          {!hasAccess && currentSection !== "dashboard" && currentSection !== "announcement-details" ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-[rgba(45,45,45,0.85)] border-2 border-[#f44336] rounded-2xl p-8 text-center max-w-md">
                <span className="material-icons text-6xl text-[#f44336] mb-4">block</span>
                <h2 className="text-2xl font-bold text-[#f44336] mb-2">沒有權限</h2>
                <p className="text-white mb-4">您的身份無法訪問此功能</p>
                <p className="text-[#b0b0b0] text-sm">您的身份：{getRoleLabel(currentUser?.role as UserRole)}</p>
              </div>
            </div>
          ) : currentSection === "dashboard" ? (
            <div className="space-y-4">
              {announcements.length > 0 && (
                <AnnouncementCarousel announcements={announcements} loading={announcementsLoading} />
              )}

              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-[#f44336] mb-4">
                  <span className="material-icons">emergency</span>
                  緊急事件
                </h2>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { icon: "local_hospital", title: "救護車 119", type: "救護車119", note: "醫療緊急狀況" },
                    { icon: "report_problem", title: "報警 110", type: "報警110", note: "治安緊急狀況" },
                    { icon: "favorite", title: "AED", type: "AED", note: "需要AED急救設備" },
                    { icon: "warning", title: "陌生人員闘入", type: "可疑人員", note: "陌生人員闖入警告" },
                  ].map((emergency) => (
                    <button
                      key={emergency.type}
                      className="bg-[rgba(45,45,45,0.85)] border-2 border-[#f44336] rounded-xl p-2 text-center cursor-pointer font-bold text-[#f44336] hover:bg-[rgba(244,67,54,0.2)] transition-all"
                    >
                      <div className="material-icons text-2xl mb-1">{emergency.icon}</div>
                      <h3 className="font-bold text-xs">{emergency.title}</h3>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : currentSection === "visitors" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">how_to_reg</span>
                訪客管理 (警衛)
              </h2>
              <VisitorManagementAdmin currentUser={currentUser} />
            </div>
          ) : currentSection === "packages" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">inventory_2</span>
                包裹管理 (警衛)
              </h2>
              <PackageManagementAdmin currentUser={currentUser} />
            </div>
          ) : currentSection === "finance" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">account_balance</span>
                管理費/收支
              </h2>
              <FinanceManagementAdmin />
            </div>
          ) : currentSection === "maintenance" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">build</span>
                設備/維護管理
              </h2>
              <MaintenanceManagementAdmin />
            </div>
          ) : currentSection === "votes" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">how_to_vote</span>
                投票管理
              </h2>
              <VoteManagementAdmin currentUserName={currentUser?.name} />
            </div>
          ) : currentSection === "announcement-details" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <AnnouncementDetailsAdmin onClose={() => setCurrentSection("dashboard")} currentUser={currentUser} />
            </div>
          ) : currentSection === "meetings" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">event</span>
                會議/活動管理
              </h2>
              <MeetingManagementAdmin />
            </div>
          ) : currentSection === "emergencies" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">emergency</span>
                緊急事件管理
              </h2>
              <EmergencyManagementAdmin currentUserName={currentUser?.name} />
            </div>
          ) : currentSection === "facilities" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">meeting_room</span>
                設施管理
              </h2>
              <FacilityManagementAdmin />
            </div>
          ) : currentSection === "residents" ? (
            <ResidentManagementAdmin />
          ) : (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-[#ffd700] text-[#1a1a1a] rounded-lg hover:bg-[#ffed4e] transition-all text-xs sm:text-sm font-semibold"
                >
                  <span className="material-icons text-base sm:text-xl">add</span>
                  <span className="hidden sm:inline">新增一筆</span>
                  <span className="sm:hidden">新增</span>
                </button>
                <button
                  onClick={loadData}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border-2 border-[#ffd700] text-[#ffd700] rounded-lg hover:bg-[#ffd700] hover:text-[#1a1a1a] transition-all text-xs sm:text-sm font-semibold"
                >
                  <span className="material-icons text-base sm:text-xl">sync</span>
                  <span className="hidden sm:inline">重新整理</span>
                  <span className="sm:hidden">重整</span>
                </button>
              </div>

              {loading ? (
                <div className="text-center text-[#b0b0b0] py-12">載入中...</div>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-white/5">
                          {currentSection === "announcements" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">標題</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">內容</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">圖片URL</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">作者</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {data.length > 0 ? (
                          data.map((row, index) => (
                            <tr key={row.id || index} className="hover:bg-white/5 transition-colors">
                              {currentSection === "announcements" && (
                                <>
                                  <td className="p-3 border-b border-white/5">
                                    <input
                                      type="text"
                                      value={row.title || ""}
                                      onChange={(e) => updateRow(index, "title", e.target.value)}
                                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                                    />
                                  </td>
                                  <td className="p-3 border-b border-white/5">
                                    <textarea
                                      value={row.content || ""}
                                      onChange={(e) => updateRow(index, "content", e.target.value)}
                                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700] min-h-[80px]"
                                    />
                                  </td>
                                  <td className="p-3 border-b border-white/5">
                                    <div className="space-y-2">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageFileChange(index, e.target.files?.[0] || null)}
                                        className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white text-sm outline-none focus:border-[#ffd700]"
                                      />
                                      {imageFiles[index] && (
                                        <div className="text-green-400 text-xs">已選擇: {imageFiles[index]!.name}</div>
                                      )}
                                      {row.image_url && !imageFiles[index] && (
                                        <div className="text-[#b0b0b0] text-xs truncate">
                                          目前: {row.image_url.substring(0, 30)}...
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 border-b border-white/5">
                                    <input
                                      type="text"
                                      value={row.author || ""}
                                      onChange={(e) => updateRow(index, "author", e.target.value)}
                                      className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                                    />
                                  </td>
                                  <td className="p-3 border-b border-white/5">
                                    <select
                                      value={row.status || "draft"}
                                      onChange={(e) => updateRow(index, "status", e.target.value)}
                                      className="w-full p-2 bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                                    >
                                      <option value="draft">草稿</option>
                                      <option value="published">已發布</option>
                                    </select>
                                  </td>
                                  <td className="p-3 border-b border-white/5">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSave(row, index)}
                                        className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-yellow-400 text-yellow-300 bg-transparent hover:bg-yellow-400/15 transition-all"
                                      >
                                        儲存
                                      </button>
                                      {row.id && (
                                        <button
                                          onClick={() => handleDelete(row.id)}
                                          className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border border-rose-400 text-rose-300 bg-transparent hover:bg-rose-400/15 transition-all"
                                        >
                                          刪除
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10} className="p-8 text-center text-[#b0b0b0]">
                              目前沒有資料
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
