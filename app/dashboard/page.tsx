"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from "@/lib/supabase"
import { canAccessSection, type UserRole } from "@/lib/permissions"
import { useAnnouncements } from "@/features/announcements/hooks/useAnnouncements"
import { AnnouncementCarousel } from "@/features/announcements/ui/AnnouncementCarousel"
import { AnnouncementDetails } from "@/components/announcement-details" // Updated import path and use named import
import { PackageManagement } from "@/components/package-management"
import { VisitorManagement } from "@/components/visitor-management"

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentSection, setCurrentSection] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  const {
    announcements,
    loading: announcementsLoading,
    likes: announcementLikes,
    toggleLike: toggleAnnouncementLike,
  } = useAnnouncements(true, currentUser?.id)
  
  const [currentSlide, setCurrentSlide] = useState(0)

  const [votes, setVotes] = useState<any[]>([])
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set())
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [visitors, setVisitors] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [finances, setFinances] = useState<any[]>([])
  const [facilities, setFacilities] = useState<any[]>([])
  const [myBookings, setMyBookings] = useState<any[]>([])

  // Form states
  const [profileForm, setProfileForm] = useState({
    name: "",
    unit: "",
    phone: "",
    email: "",
    password: "",
  })
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: "水電",
    location: "",
    description: "",
    image: null as File | null,
  })
  const [bookingForm, setBookingForm] = useState({
    facilityId: "",
    bookingDate: "",
    startTime: "",
    endTime: "",
    notes: "",
  })

  // AI Chat states
  const [aiInput, setAiInput] = useState("")
  const [aiMessages, setAiMessages] = useState<{ type: "user" | "bot"; text: string }[]>([])
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [aiTab, setAiTab] = useState("functions") // "functions", "resident", "emergency"

  useEffect(() => {
    initAuth()
  }, [])


  useEffect(() => {
    if (currentUser) {
      loadSectionData()
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
      const { data: userDataArray, error } = await supabase.from("profiles").select("*").eq("id", user.id)

      if (error) {
        console.error("[v0] Error fetching user profile:", error)
      }

      const userData = userDataArray && userDataArray.length > 0 ? userDataArray[0] : null

      if (!userData) {
        setCurrentUser(user)
        setProfileForm({
          name: user.name || "",
          unit: user.room || "",
          phone: user.phone || "",
          email: user.email || "",
          password: "",
        })
      } else {
        const updatedUser = userData
        setCurrentUser(updatedUser)
        setProfileForm({
          name: updatedUser.name || "",
          unit: updatedUser.room || "",
          phone: updatedUser.phone || "",
          email: updatedUser.email || "",
          password: "",
        })
      }

    } catch (e: any) {
      console.error("[v0] Auth initialization failed:", e)
      alert(`初始化失敗：${e.message}`)
    }
  }


  const loadSectionData = async () => {
    const supabase = getSupabaseClient()

    switch (currentSection) {
      case "votes":
        const { data: votesData } = await supabase.from("votes").select("*")
        if (votesData) setVotes(votesData)

        if (currentUser?.id) {
          const { data: userVotes } = await supabase
            .from("vote_records")
            .select("vote_id")
            .eq("user_id", currentUser.id)

          if (userVotes) {
            const votedIds = new Set(userVotes.map((v) => v.vote_id))
            setVotedPolls(votedIds)
          }
        }
        break
      case "maintenance":
        const { data: maintenanceData } = await supabase
          .from("maintenance")
          .select("*")
          .eq("created_by", currentUser?.id)
          .order("created_at", { ascending: false })
        if (maintenanceData) setMaintenance(maintenanceData)
        break
      case "packages":
        const { data: packagesData } = await supabase
          .from("packages")
          .select("*")
          .eq("recipient_room", currentUser?.room)
          .order("arrived_at", { ascending: false })
        if (packagesData) setPackages(packagesData)
        break
      case "visitors":
        const { data: visitorsData } = await supabase
          .from("visitors")
          .select("*")
          .eq("room", currentUser?.room)
          .order("in", { ascending: false })
        if (visitorsData) setVisitors(visitorsData)
        break
      case "meetings":
        const { data: meetingsData } = await supabase.from("meetings").select("*").order("time", { ascending: false })
        if (meetingsData) setMeetings(meetingsData)
        break
      case "finance":
        const { data: financesData } = await supabase
          .from("fees")
          .select("*")
          .eq("room", currentUser?.room)
          .order("due", { ascending: false })
        if (financesData) setFinances(financesData)
        break
      case "facilities":
        const { data: facilitiesData } = await supabase
          .from("facilities")
          .select("*")
          .eq("available", true)
          .order("name", { ascending: true })
        if (facilitiesData) setFacilities(facilitiesData)

        const { data: bookingsData } = await supabase
          .from("facility_bookings")
          .select("*, facilities(name)")
          .eq("user_id", currentUser?.id)
          .order("booking_date", { ascending: false })
        if (bookingsData) setMyBookings(bookingsData)
        break
    }
  }

  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      // Desktop: toggle collapse
      setSidebarCollapsed(!sidebarCollapsed)
    } else {
      // Mobile: toggle open/close
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

  const switchSection = (section: string) => {
    setCurrentSection(section)
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
      document.body.style.overflow = ""
    }
  }

  const confirmEmergency = (type: string, note: string) => {
    if (confirm(`確定要送出「${type}」事件嗎？`)) {
      triggerEmergency(type, note)
    }
  }

  const triggerEmergency = async (type: string, note: string) => {
    if (!currentUser) {
      alert("尚未登入")
      return
    }
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from("emergencies").insert([
        {
          type: type,
          note: note,
          by: currentUser.name || "未知",
        },
      ])

      if (error) throw error
      alert(`已送出緊急事件：${type}\n系統已通知管理員和相關單位。`)
    } catch (e: any) {
      console.error(e)
      alert("送出失敗：" + e.message)
    }
  }

  const logout = () => {
    localStorage.removeItem("currentUser")
    localStorage.removeItem("tenantConfig") // Clear tenant config on logout
    router.push("/")
  }

  const switchToAdmin = () => {
    if (currentUser?.role === "committee") {
      localStorage.setItem("currentUser", JSON.stringify({ ...currentUser, role: "committee" }))
      router.push("/admin")
    }
  }

  const sendAIMessage = () => {
    if (!aiInput.trim()) return

    setAiMessages([...aiMessages, { type: "user", text: aiInput }])

    setTimeout(() => {
      const response = getAIResponse(aiInput)
      setAiMessages((prev) => [...prev, { type: "bot", text: response }])
    }, 500)

    setAiInput("")
  }

  const getAIResponse = (message: string) => {
    const msg = message.toLowerCase()

    if (msg.includes("公告")) {
      return "您可以在「公告」頁面查看最新公告。公告會以輪播方式顯示在首頁。"
    }
    if (msg.includes("投票")) {
      return "您可以在「投票」頁面查看所有投票並參與投票。每個投票都會顯示即時統計結果。"
    }
    if (msg.includes("維修") || msg.includes("報修")) {
      return "您可以在「設備/維護」頁面提交維修申請，包括設備名稱、問題描述和照片。提交後可以在「我的維修申請」中查看處理狀態。"
    }
    if (msg.includes("包裹") || msg.includes("快遞")) {
      return "您可以在「我的包裹」頁面查看包裹領取狀況，包括快遞公司、追蹤號碼和到達時間。"
    }
    if (msg.includes("管理費") || msg.includes("繳費")) {
      return "您可以在「管理費/收支」頁面查看繳費狀況。如有問題請聯繫管委會。"
    }
    if (msg.includes("個人") || msg.includes("資料") || msg.includes("密碼")) {
      return "您可以在「個人資料」頁面修改姓名、房號、電話、Email 和密碼。"
    }

    return "抱歉,我還在學習中。您可以詢問關於公告、維修、繳費、包裹等問題，或使用「常用功能」快速導航。"
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from("profiles")
        .update({
          name: profileForm.name,
          room: profileForm.unit,
          phone: profileForm.phone,
          email: profileForm.email,
          ...(profileForm.password && { password: profileForm.password }),
        })
        .eq("id", currentUser.id)

      if (error) throw error

      const updatedUser = {
        ...currentUser,
        name: profileForm.name,
        room: profileForm.unit,
        phone: profileForm.phone,
        email: profileForm.email,
      }

      localStorage.setItem("currentUser", JSON.stringify(updatedUser))
      setCurrentUser(updatedUser)
      alert("個人資料已更新！")
    } catch (e: any) {
      console.error(e)
      alert("更新失敗：" + e.message)
    }
  }

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser?.id) {
      alert("錯誤：用戶資訊不完整，請重新登入")
      return
    }

    try {
      const supabase = getSupabaseClient()

      let photoUrl = ""
      if (maintenanceForm.image) {
        const reader = new FileReader()
        photoUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(maintenanceForm.image!)
        })
      }

      const { data, error } = await supabase
        .from("maintenance")
        .insert([
          {
            equipment: maintenanceForm.type,
            item: maintenanceForm.location,
            description: maintenanceForm.description,
            status: "open",
            reported_by: currentUser?.name || "未知",
            created_by: currentUser?.id,
            photo_url: photoUrl || null,
          },
        ])
        .select()

      if (error) {
        console.error("[v0] Maintenance submission error:", error)
        throw error
      }

      alert("維修申請已提交！")
      setMaintenanceForm({
        type: "水電",
        location: "",
        description: "",
        image: null,
      })
      await loadSectionData()
    } catch (e: any) {
      console.error("[v0] Maintenance submission failed:", e)
      alert(`提交失敗：${e.message}\n\n請確認：\n1. 已設定環境變數\n2. 已正確登入\n3. 資料庫連接正常`)
    }
  }

  const handleVote = async (voteId: string, optionIndex: number) => {
    if (!currentUser || !currentUser.id) {
      alert("請先登入")
      return
    }

    if (votedPolls.has(voteId)) {
      alert("您已經投過票了")
      return
    }

    try {
      const vote = votes.find((v) => v.id === voteId)
      if (!vote) return

      const options = Array.isArray(vote.options) ? vote.options : JSON.parse(vote.options || "[]")
      const selectedOption = options[optionIndex]

      const supabase = getSupabaseClient()
      const { error } = await supabase.from("vote_records").insert([
        {
          vote_id: voteId,
          user_id: currentUser.id,
          user_name: currentUser.name || "未知",
          option_selected: selectedOption,
        },
      ])

      if (error) {
        if (error.code === "23505") {
          alert("您已經投過票了")
          // Add to voted polls set
          setVotedPolls((prev) => new Set(prev).add(voteId))
          return
        }
        throw error
      }

      alert("投票成功！")
      setVotedPolls((prev) => new Set(prev).add(voteId))
      await loadSectionData()
    } catch (e: any) {
      console.error(e)
      alert("投票失敗：" + e.message)
    }
  }

  const handleFacilityBooking = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser?.id) {
      alert("請先登入")
      return
    }

    try {
      const supabase = getSupabaseClient()

      // Check for conflicts
      const { data: conflicts } = await supabase
        .from("facility_bookings")
        .select("*")
        .eq("facility_id", bookingForm.facilityId)
        .eq("booking_date", bookingForm.bookingDate)
        .eq("status", "confirmed")

      if (conflicts && conflicts.length > 0) {
        const hasConflict = conflicts.some((booking) => {
          const existingStart = booking.start_time
          const existingEnd = booking.end_time
          const newStart = bookingForm.startTime
          const newEnd = bookingForm.endTime

          return (
            (newStart >= existingStart && newStart < existingEnd) ||
            (newEnd > existingStart && newEnd <= existingEnd) ||
            (newStart <= existingStart && newEnd >= existingEnd)
          )
        })

        if (hasConflict) {
          alert("此時段已被預約，請選擇其他時段")
          return
        }
      }

      const { error } = await supabase.from("facility_bookings").insert([
        {
          facility_id: bookingForm.facilityId,
          user_id: currentUser.id,
          user_name: currentUser.name || "未知",
          user_room: currentUser.room || "",
          booking_date: bookingForm.bookingDate,
          start_time: bookingForm.startTime,
          end_time: bookingForm.endTime,
          notes: bookingForm.notes,
          status: "confirmed",
        },
      ])

      if (error) throw error

      alert("預約成功！")
      setBookingForm({
        facilityId: "",
        bookingDate: "",
        startTime: "",
        endTime: "",
        notes: "",
      })
      await loadSectionData()
    } catch (e: any) {
      console.error(e)
      alert("預約失敗：" + e.message)
    }
  }


  const handleAnnouncementSelect = (announcementId: string) => {
    console.log("Navigating to announcement details for ID:", announcementId)
    setCurrentSection("announcements")
  }

  const sectionTitles: Record<string, string> = {
    dashboard: "首頁",
    profile: "個人資料",
    packages: "我的包裹",
    votes: "社區投票",
    maintenance: "設備/維護",
    finance: "管理費/收支",
    visitors: "訪客紀錄",
    meetings: "會議/活動",
    emergencies: "緊急事件",
    facilities: "設施預約",
    announcements: "公告詳情", // Added announcement section title
  }

  const allNavItems = [
    { id: "dashboard", icon: "dashboard", label: "首頁" },
    { id: "announcements", icon: "campaign", label: "公告詳情" }, // Added announcements
    { id: "profile", icon: "person", label: "個人資料" },
    { id: "packages", icon: "inventory_2", label: "我的包裹" },
    { id: "votes", icon: "how_to_vote", label: "社區投票" },
    { id: "maintenance", icon: "build", label: "設備/維護" },
    { id: "finance", icon: "account_balance", label: "管理費/收支" },
    { id: "visitors", icon: "how_to_reg", label: "訪客紀錄" },
    { id: "meetings", icon: "event", label: "會議/活動" },
    { id: "emergencies", icon: "emergency", label: "緊急事件" },
    { id: "facilities", icon: "meeting_room", label: "設施預約" },
  ]

  const navItems = currentUser
    ? allNavItems.filter((item) => canAccessSection(currentUser.role as UserRole, item.id as any, true))
    : allNavItems

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99] lg:hidden" onClick={toggleSidebar} />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed lg:static top-0 left-0 h-screen bg-[rgba(45,45,45,0.95)] backdrop-blur-lg border-r-2 border-[#ffd700] overflow-y-auto overflow-x-hidden transition-all duration-300 z-[100] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-0 lg:hidden" : "lg:w-[280px]"}`}
      >
        <div className={`p-8 pb-6 border-b border-[rgba(255,215,0,0.3)] ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <div className="text-[#ffd700] font-bold text-xl mb-4">社區管理系統</div>
          <div className="flex gap-3 items-center">
            <div className="w-12 h-12 rounded-full bg-[#ffd700] text-[#222] flex items-center justify-center font-bold text-lg">
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <div className="text-white font-medium">{currentUser?.name || "載入中..."}</div>
              <div className="text-[#b0b0b0] text-sm">
                {currentUser?.role === "resident"
                  ? "住戶"
                  : currentUser?.role === "committee"
                    ? "委員會"
                    : currentUser?.role === "vendor"
                      ? "廠商"
                      : currentUser?.role === "admin"
                        ? "管理員"
                        : currentUser?.role === "guest"
                          ? "訪客"
                          : "住戶"}
              </div>
            </div>
          </div>
        </div>

        <ul className="py-4">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => switchSection(item.id)}
                className={`w-full flex gap-3 items-center px-6 py-3 text-white border-l-4 transition-all ${
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center px-4 py-3 bg-[#1a1a1a] border-b border-[rgba(255,215,0,0.2)] flex-shrink-0">
          <div className="flex gap-2 items-center text-[#ffd700] font-bold">
            <button onClick={toggleSidebar} className="material-icons cursor-pointer">
              menu
            </button>
            <span>{sectionTitles[currentSection]}</span>
          </div>
          <div className="flex gap-2">
            {/* Add role switching button for committee members */}
            {currentUser?.role === "committee" && (
              <button
                onClick={switchToAdmin}
                className="flex gap-2 items-center border-2 border-[#ffd700] rounded-lg px-3 py-2 bg-transparent text-[#ffd700] cursor-pointer font-semibold hover:bg-[#ffd700] hover:text-[#222] transition-all"
              >
                <span className="material-icons text-lg">admin_panel_settings</span>
                <span className="hidden sm:inline">管委會功能</span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex gap-2 items-center border-none rounded-lg px-3 py-2 bg-[#ffd700] text-[#222] cursor-pointer font-semibold hover:brightness-95"
            >
              <span className="material-icons text-lg">logout</span>
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          {currentSection === "dashboard" && (
            <section>
              {announcements.length > 0 && (
                <section className="mb-6 sm:mb-8">
                  <AnnouncementCarousel 
                    announcements={announcements}
                    loading={announcementsLoading}
                    onLike={toggleAnnouncementLike} // Use the hook's toggle function
                    onSelect={handleAnnouncementSelect}
                    likes={announcementLikes} // Use the hook's likes data
                    currentUserId={currentUser?.id}
                  />
                </section>
              )}

              {/* Emergency Actions */}
              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-4 mt-3">
                <h2 className="flex gap-2 items-center text-[#ffd700] mb-3">
                  <span className="material-icons">emergency</span>
                  <span className="text-[#f44336] font-bold">緊急事件</span>
                </h2>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { type: "救護車119", note: "醫療緊急狀況", icon: "local_hospital" },
                    { type: "報警110", note: "治安緊急狀況", icon: "report_problem" },
                    { type: "AED", note: "需要AED急救設備", icon: "favorite" },
                    { type: "可疑人員", note: "陌生人員闖入警告", icon: "warning" },
                  ].map((emergency) => (
                    <div
                      key={emergency.type}
                      onClick={() => confirmEmergency(emergency.type, emergency.note)}
                      className="bg-[rgba(45,45,45,0.85)] border-2 border-[#f44336] rounded-xl p-2 text-center cursor-pointer font-bold text-[#f44336] hover:bg-[rgba(244,67,54,0.2)] transition-all"
                    >
                      <div className="material-icons text-[#f44336] text-2xl mb-1">{emergency.icon}</div>
                      <h3 className="text-[#f44336] font-bold text-xs">{emergency.type}</h3>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {currentSection === "profile" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">person</span>
                個人資料
              </h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-white mb-2">姓名</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">房號</label>
                  <input
                    type="text"
                    value={profileForm.unit}
                    onChange={(e) => setProfileForm({ ...profileForm, unit: e.target.value })}
                    className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">電話</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">新密碼（留空則不修改）</label>
                  <input
                    type="password"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                    className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                    placeholder="如需修改密碼請輸入"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
                >
                  更新資料
                </button>
              </form>
            </div>
          )}

          {currentSection === "packages" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">inventory_2</span>
                我的包裹
              </h2>
              <PackageManagement userRoom={currentUser?.room} currentUser={currentUser} />
            </div>
          )}

          {currentSection === "votes" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">how_to_vote</span>
                社區投票
              </h2>
              <div className="space-y-4">
                {votes.length > 0 ? (
                  votes.map((vote) => {
                    const optionsArray = Array.isArray(vote.options) ? vote.options : JSON.parse(vote.options || "[]")
                    const hasVoted = votedPolls.has(vote.id)

                    return (
                      <div key={vote.id} className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-white font-bold text-lg mb-2">{vote.title}</h3>
                            <p className="text-[#b0b0b0] mb-3">{vote.description}</p>
                          </div>
                          <div className="flex gap-2">
                            {hasVoted && (
                              <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold">
                                已投票
                              </div>
                            )}
                            <div className="px-3 py-1 rounded-full bg-[#ffd700] text-[#222] text-sm font-bold">
                              {vote.status === "active" ? "進行中" : "已結束"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap mb-3">
                          {optionsArray.map((option: string, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleVote(vote.id, idx)}
                              disabled={vote.status !== "active" || hasVoted}
                              className="px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              投給 {option}
                            </button>
                          ))}
                        </div>
                        {hasVoted && <div className="text-green-400 text-sm mb-2">✓ 您已經投過票了，無法再次投票</div>}
                        <div className="text-[#b0b0b0] text-sm">
                          截止日期: {vote.ends_at ? new Date(vote.ends_at).toLocaleDateString("zh-TW") : "無期限"}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center text-[#b0b0b0] py-8">目前沒有進行中的投票</div>
                )}
              </div>
            </div>
          )}

          {currentSection === "maintenance" && (
            <div className="space-y-4">
              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
                <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                  <span className="material-icons">build</span>
                  提交維修申請
                </h2>
                <form onSubmit={handleMaintenanceSubmit} className="space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-white mb-2">維修類型</label>
                    <select
                      value={maintenanceForm.type}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })}
                      className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] [&>option]:bg-[#2a2a2a] [&>option]:text-white [&>option]:py-2"
                    >
                      <option value="水電" className="bg-[#2a2a2a] text-white">
                        水電
                      </option>
                      <option value="門窗" className="bg-[#2a2a2a] text-white">
                        門窗
                      </option>
                      <option value="公共設施" className="bg-[#2a2a2a] text-white">
                        公共設施
                      </option>
                      <option value="其他" className="bg-[#2a2a2a] text-white">
                        其他
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white mb-2">位置</label>
                    <input
                      type="text"
                      value={maintenanceForm.location}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, location: e.target.value })}
                      className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                      placeholder="例如：A棟3樓、中庭"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">問題描述</label>
                    <textarea
                      value={maintenanceForm.description}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                      className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] min-h-[100px]"
                      placeholder="請詳細描述問題"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">上傳照片（選填）</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, image: e.target.files?.[0] || null })}
                      className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                    />
                    {maintenanceForm.image && (
                      <div className="text-green-400 text-sm mt-2">已選擇: {maintenanceForm.image.name}</div>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
                  >
                    提交申請
                  </button>
                </form>
              </div>

              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
                <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                  <span className="material-icons">list</span>
                  我的維修申請
                </h2>
                <div className="space-y-3">
                  {maintenance.length > 0 ? (
                    maintenance.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-white font-bold">{item.equipment || "維修申請"}</div>
                            <div className="text-[#b0b0b0] text-sm">位置: {item.item || "未指定"}</div>
                            <div className="text-[#b0b0b0] text-sm">申請人: {item.reported_by || "未知"}</div>
                          </div>
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-bold ${
                              item.status === "open"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : item.status === "progress"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-green-500/20 text-green-400"
                            }`}
                          >
                            {item.status === "open" ? "待處理" : item.status === "progress" ? "處理中" : "已完成"}
                          </div>
                        </div>
                        {item.description && <div className="text-white mb-2">{item.description}</div>}
                        {item.photo_url && (
                          <div className="mb-2">
                            <img
                              src={item.photo_url || "/placeholder.svg"}
                              alt="維修照片"
                              className="max-w-full h-auto rounded-lg max-h-[200px]"
                            />
                          </div>
                        )}
                        <div className="text-[#b0b0b0] text-sm">
                          申請時間: {new Date(item.created_at).toLocaleString("zh-TW")}
                        </div>
                        {item.handler && <div className="text-[#b0b0b0] text-sm">處理人員: {item.handler}</div>}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-[#b0b0b0] py-8">目前沒有維修申請</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentSection === "finance" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">account_balance</span>
                管理費/收支
              </h2>
              <div className="space-y-3">
                {finances.length > 0 ? (
                  finances.map((finance) => (
                    <div
                      key={finance.id}
                      className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex gap-2 items-center mb-1">
                            <span className="text-white font-bold">房號: {finance.room}</span>
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                finance.paid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {finance.paid ? "已繳" : "未繳"}
                            </span>
                          </div>
                          {finance.invoice && <div className="text-[#b0b0b0] text-sm">發票: {finance.invoice}</div>}
                          {finance.note && <div className="text-[#b0b0b0] text-sm">{finance.note}</div>}
                          <div className="text-[#b0b0b0] text-sm mt-1">
                            到期日: {new Date(finance.due).toLocaleDateString("zh-TW")}
                          </div>
                        </div>
                        <div className={`text-xl font-bold ${finance.paid ? "text-green-400" : "text-red-400"}`}>
                          ${finance.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-[#b0b0b0] py-8">目前沒有財務記錄</div>
                )}
              </div>
            </div>
          )}

          {currentSection === "visitors" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">how_to_reg</span>
                訪客管理
              </h2>
              <VisitorManagement userRoom={currentUser?.room} currentUser={currentUser} isAdmin={false} />
            </div>
          )}

          {currentSection === "meetings" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">event</span>
                會議/活動
              </h2>
              <div className="space-y-3">
                {meetings.length > 0 ? (
                  meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-white font-bold text-lg">{meeting.topic}</div>
                          {meeting.notes && <div className="text-[#b0b0b0] mt-1">{meeting.notes}</div>}
                        </div>
                        <div className="px-3 py-1 rounded-full bg-[#ffd700] text-[#222] text-sm font-bold">
                          {new Date(meeting.time) > new Date() ? "即將舉行" : "已結束"}
                        </div>
                      </div>
                      <div className="flex gap-4 text-[#b0b0b0] text-sm mt-3">
                        <div className="flex gap-1 items-center">
                          <span className="material-icons text-sm">schedule</span>
                          {new Date(meeting.time).toLocaleString("zh-TW")}
                        </div>
                        <div className="flex gap-1 items-center">
                          <span className="material-icons text-sm">place</span>
                          {meeting.location}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-[#b0b0b0] py-8">目前沒有會議或活動</div>
                )}
              </div>
            </div>
          )}

          {currentSection === "emergencies" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#f44336] mb-5 text-xl">
                <span className="material-icons">emergency</span>
                緊急事件
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {[
                  { type: "救護車119", note: "醫療緊急狀況", emoji: "🚑" },
                  { type: "報警110", note: "治安緊急狀況", emoji: "🚨" },
                  { type: "AED", note: "需要AED急救設備", emoji: "❤️" },
                  { type: "可疑人員", note: "陌生人員闖入警告", emoji: "⚠️" },
                ].map((emergency) => (
                  <div
                    key={emergency.type}
                    onClick={() => {
                      confirmEmergency(emergency.type, emergency.note)
                      setAiChatOpen(false)
                    }}
                    className="p-4 bg-white/5 border-l-4 border-[#ffd700] rounded-lg cursor-pointer hover:bg-[rgba(255,215,0,0.1)] hover:translate-x-1 transition-all"
                  >
                    {emergency.emoji} {emergency.type}
                  </div>
                ))}
              </div>
              <div className="text-[#b0b0b0] text-sm text-center">點擊上方按鈕可立即通知管理員和相關單位</div>
            </div>
          )}

          {currentSection === "facilities" && (
            <div className="space-y-4">
              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
                <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                  <span className="material-icons">meeting_room</span>
                  預約設施
                </h2>
                <form onSubmit={handleFacilityBooking} className="space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-white mb-2">選擇設施</label>
                    <select
                      value={bookingForm.facilityId}
                      onChange={(e) => setBookingForm({ ...bookingForm, facilityId: e.target.value })}
                      className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] [&>option]:bg-[#2a2a2a] [&>option]:text-white [&>option]:py-2"
                      required
                    >
                      <option value="" className="bg-[#2a2a2a] text-[#b0b0b0]">
                        請選擇設施
                      </option>
                      {facilities.map((facility) => (
                        <option key={facility.id} value={facility.id} className="bg-[#2a2a2a] text-white py-2">
                          {facility.name} - {facility.location || "無位置資訊"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white mb-2">預約日期</label>
                    <input
                      type="date"
                      value={bookingForm.bookingDate}
                      onChange={(e) => setBookingForm({ ...bookingForm, bookingDate: e.target.value })}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white mb-2">開始時間</label>
                      <input
                        type="time"
                        value={bookingForm.startTime}
                        onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                        className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-white mb-2">結束時間</label>
                      <input
                        type="time"
                        value={bookingForm.endTime}
                        onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
                        className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-white mb-2">備註（選填）</label>
                    <textarea
                      value={bookingForm.notes}
                      onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                      className="w-full p-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] min-h-[80px]"
                      placeholder="請輸入備註事項"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
                  >
                    提交預約
                  </button>
                </form>
              </div>

              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
                <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                  <span className="material-icons">list</span>
                  我的預約記錄
                </h2>
                <div className="space-y-3">
                  {myBookings.length > 0 ? (
                    myBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-white font-bold">{booking.facilities?.name || "設施"}</div>
                            <div className="text-[#b0b0b0] text-sm">
                              日期: {new Date(booking.booking_date).toLocaleDateString("zh-TW")}
                            </div>
                            <div className="text-[#b0b0b0] text-sm">
                              時間: {booking.start_time} - {booking.end_time}
                            </div>
                            {booking.notes && <div className="text-[#b0b0b0] text-sm">備註: {booking.notes}</div>}
                          </div>
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-bold ${
                              booking.status === "confirmed"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {booking.status === "confirmed" ? "已確認" : "已取消"}
                          </div>
                        </div>
                        <div className="text-[#b0b0b0] text-sm">
                          預約時間: {new Date(booking.created_at).toLocaleString("zh-TW")}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-[#b0b0b0] py-8">目前沒有預約記錄</div>
                  )}
                </div>
              </div>

              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
                <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                  <span className="material-icons">info</span>
                  可用設施
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {facilities.map((facility) => (
                    <div
                      key={facility.id}
                      className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                    >
                      {facility.image_url && (
                        <img
                          src={facility.image_url || "/placeholder.svg"}
                          alt={facility.name}
                          className="w-full h-40 object-cover rounded-lg mb-3"
                        />
                      )}
                      <div className="text-white font-bold text-lg mb-2">{facility.name}</div>
                      {facility.description && (
                        <div className="text-[#b0b0b0] text-sm mb-2">{facility.description}</div>
                      )}
                      {facility.location && (
                        <div className="text-[#b0b0b0] text-sm flex items-center gap-1">
                          <span className="material-icons text-sm">place</span>
                          {facility.location}
                        </div>
                      )}
                      {facility.capacity && (
                        <div className="text-[#b0b0b0] text-sm flex items-center gap-1">
                          <span className="material-icons text-sm">people</span>
                          容納人數: {facility.capacity}
                        </div>
                      )}
                    </div>
                  ))}
                  {facilities.length === 0 && (
                    <div className="col-span-2 text-center text-[#b0b0b0] py-8">目前沒有可用設施</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add announcements section to main content */}
          {currentSection === "announcements" && (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl">
                <span className="material-icons">campaign</span>
                公告詳情
              </h2>
              <AnnouncementDetails onClose={() => setCurrentSection("dashboard")} currentUser={currentUser} />
            </div>
          )}

          {currentSection !== "dashboard" &&
            currentSection !== "profile" &&
            currentSection !== "packages" &&
            currentSection !== "votes" &&
            currentSection !== "maintenance" &&
            currentSection !== "finance" &&
            currentSection !== "visitors" &&
            currentSection !== "meetings" &&
            currentSection !== "emergencies" &&
            currentSection !== "facilities" &&
            currentSection !== "announcements" && ( // Added announcement to the condition
              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
                <h2 className="flex gap-2 items-center text-[#ffd700] mb-3 text-xl">
                  <span className="material-icons">{navItems.find((item) => item.id === currentSection)?.icon}</span>
                  {sectionTitles[currentSection]}
                </h2>
                <div className="text-[#b0b0b0]">此功能尚未實作</div>
              </div>
            )}
        </div>
      </main>

      {/* AI Chat Button */}
      <div
        onClick={() => setAiChatOpen(true)}
        className="fixed bottom-8 right-8 w-[70px] h-[70px] rounded-2xl bg-[#FFD93D] border-[3px] border-[#222] cursor-pointer flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:scale-110 hover:shadow-[0_6px_30px_rgba(255,217,61,0.6)] transition-all z-[1000]"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
          <rect x="7" y="5" width="10" height="12" rx="2" fill="#222" />
          <circle cx="10" cy="8" r="1" fill="#FFD93D" />
          <circle cx="14" cy="8" r="1" fill="#FFD93D" />
          <path
            d="M12 17C13.1046 17 14 17.8954 14 19C14 20.1046 13.1046 21 12 21C10.8954 21 10 20.1046 10 19C10 17.8954 10.8954 17 12 17Z"
            fill="#FFD93D"
          />
        </svg>
      </div>

      {/* AI Chat Window */}
      {aiChatOpen && (
        <div className="fixed inset-y-0 right-0 w-96 bg-[#2d2d2d] border-l-2 border-[#ffd700] shadow-2xl flex flex-col z-[999] transition-all duration-500">
          <div className="flex items-center justify-between p-4 bg-[#1a1a1a] border-b border-[rgba(255,215,0,0.2)]">
            <div className="flex gap-2 items-center text-[#ffd700] font-bold">
              <span className="material-icons">smart_toy</span>
              AI 助理
            </div>
            <button onClick={() => setAiChatOpen(false)} className="material-icons text-white cursor-pointer">
              close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.map((msg, index) => (
              <div key={index} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs p-3 rounded-lg ${
                    msg.type === "user" ? "bg-[#ffd700] text-[#222]" : "bg-[#4a4a4a] text-white"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-[#1a1a1a] border-t border-[rgba(255,215,0,0.2)]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") sendAIMessage()
                }}
                placeholder="輸入訊息..."
                className="flex-1 p-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
              />
              <button
                onClick={sendAIMessage}
                className="p-2 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all disabled:opacity-500 disabled:cursor-not-allowed"
              >
                <span className="material-icons">send</span>
              </button>
            </div>
            <div className="flex justify-center gap-4 mt-3">
              <button
                onClick={() => setAiTab("functions")}
                className={`text-sm font-medium transition-colors ${
                  aiTab === "functions" ? "text-[#ffd700]" : "text-white/70 hover:text-white"
                }`}
              >
                常用功能
              </button>
              <button
                onClick={() => setAiTab("resident")}
                className={`text-sm font-medium transition-colors ${
                  aiTab === "resident" ? "text-[#ffd700]" : "text-white/70 hover:text-white"
                }`}
              >
                住戶資訊
              </button>
              <button
                onClick={() => setAiTab("emergency")}
                className={`text-sm font-medium transition-colors ${
                  aiTab === "emergency" ? "text-[#ffd700]" : "text-white/70 hover:text-white"
                }`}
              >
                緊急協助
              </button>
            </div>
            {aiTab === "functions" && (
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <button
                  onClick={() => setAiInput("查詢公告")}
                  className="p-2 rounded-md bg-white/100 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  查詢公告
                </button>
                <button
                  onClick={() => setAiInput("我要報修")}
                  className="p-2 rounded-md bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  我要報修
                </button>
                <button
                  onClick={() => setAiInput("我的包裹在哪裡？")}
                  className="p-2 rounded-md bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  我的包裹在哪裡？
                </button>
                <button
                  onClick={() => setAiInput("查詢管理費")}
                  className="p-2 rounded-md bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  查詢管理費
                </button>
                <button
                  onClick={() => setAiInput("預約設施")}
                  className="p-2 rounded-md bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  預約設施
                </button>
                <button
                  onClick={() => setAiInput("修改個人資料")}
                  className="p-2 rounded-md bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  修改個人資料
                </button>
              </div>
            )}
            {aiTab === "resident" && (
              <div className="mt-3 text-xs text-white/70">
                <p>您的姓名：{currentUser?.name}</p>
                <p>您的房號：{currentUser?.room}</p>
                <p>您的電話：{currentUser?.phone}</p>
                <p>您的Email：{currentUser?.email}</p>
              </div>
            )}
            {aiTab === "emergency" && (
              <div className="grid grid-cols-1 gap-2 mt-3 text-xs">
                <button
                  onClick={() => confirmEmergency("救護車119", "醫療緊急狀況")}
                  className="p-2 rounded-md bg-[#f44336]/10 text-[#f44336] hover:bg-[#f44336]/20"
                >
                  緊急救護 (119)
                </button>
                <button
                  onClick={() => confirmEmergency("報警110", "治安緊急狀況")}
                  className="p-2 rounded-md bg-[#f44336]/10 text-[#f44336] hover:bg-[#f44336]/20"
                >
                  緊急報警 (110)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
