"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"
import { canAccessSection, getRoleLabel, shouldUseBackend, type UserRole } from "@/lib/permissions"

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
  | "votes"
  | "maintenance"
  | "finance"
  | "residents"
  | "packages"
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
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [imageFiles, setImageFiles] = useState<{ [key: number]: File | null }>({})


  // --- ADD THESE FOUR LINES ---
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [selectedVote, setSelectedVote] = useState<any>(null)
  const [voteResults, setVoteResults] = useState<{ [key: string]: number } | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  // --- END ADDITION ---
const [financeFilter, setFinanceFilter] = useState("unpaid") // 'unpaid', 'paid', or 'all'
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

    loadAnnouncements()
  }, [router])

  useEffect(() => {
    if (currentSection === "dashboard" && announcements.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % announcements.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [currentSection, announcements.length])

  useEffect(() => {
    if (currentSection !== "dashboard") {
      loadData()
    }
  }, [currentSection])

  const loadAnnouncements = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) throw error
      if (data) setAnnouncements(data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const tableMap: Record<Section, string> = {
        dashboard: "",
        announcements: "announcements",
        votes: "votes",
        maintenance: "maintenance",
        finance: "fees",
        residents: "residents",
        packages: "packages",
        visitors: "visitors",
        meetings: "meetings",
        emergencies: "emergencies",
        facilities: "facilities",
      }

      const table = tableMap[currentSection]
      if (!table) return

      const supabase = getSupabaseClient()
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
      const tableMap: Record<Section, string> = {
        dashboard: "",
        announcements: "announcements",
        votes: "votes",
        maintenance: "maintenance",
        finance: "fees",
        residents: "residents",
        packages: "packages",
        visitors: "visitors",
        meetings: "meetings",
        emergencies: "emergencies",
        facilities: "facilities",
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

      if (currentSection === "facilities" && imageFiles[index]) {
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

      const supabase = getSupabaseClient()

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
      if (currentSection === "announcements") await loadAnnouncements()
    } catch (e: any) {
      console.error(e)
      alert("操作失敗：" + e.message)
    }
  }

  const handleViewResults = async (vote: any) => {
    if (!vote) return
    setSelectedVote(vote)
    setShowResultsModal(true)
    setResultsLoading(true)
    setVoteResults(null) // Clear old results

    try {
      const supabase = getSupabaseClient()
      // 1. Fetch from the correct table and column
      const { data: responses, error } = await supabase
        .from("vote_records") // Correct: Uses your 'vote_records' table
        .select("option_selected") // Correct: Uses your 'option_selected' column
        .eq("vote_id", vote.id)

      if (error) throw error

      // 2. Parse the options from the vote row
      let options: string[] = []
      try {
        options = typeof vote.options === 'string' 
          ? JSON.parse(vote.options) 
          : vote.options; 
        if (!Array.isArray(options)) throw new Error("Options are not an array");
      } catch (parseError) {
        console.error("Failed to parse vote options:", parseError);
        throw new Error("投票選項格式不正確。");
      }
      
      // 3. Initialize counts for all possible options to 0
      const counts: { [key: string]: number } = {}
      options.forEach((option: string) => {
        counts[option] = 0
      })

      // 4. Count the actual responses using the correct column name
      responses.forEach((response: any) => {
        if (counts.hasOwnProperty(response.option_selected)) { // Correct: 'option_selected'
          counts[response.option_selected]++
        }
      })

      setVoteResults(counts)
    } catch (e: any) {
      console.error("Error fetching vote results:", e)
      alert("抓取結果失敗：" + e.message)
    } finally {
      setResultsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此筆資料？")) return

    try {
      const tableMap: Record<Section, string> = {
        dashboard: "",
        announcements: "announcements",
        votes: "votes",
        maintenance: "maintenance",
        finance: "fees",
        residents: "residents",
        packages: "packages",
        visitors: "visitors",
        meetings: "meetings",
        emergencies: "emergencies",
        facilities: "facilities",
      }

      const table = tableMap[currentSection]
      if (!table) return

      const supabase = getSupabaseClient()
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error

      alert("刪除成功！")
      await loadData()
      if (currentSection === "announcements") await loadAnnouncements()
    } catch (e: any) {
      console.error(e)
      alert("刪除失敗：" + e.message)
    }
  }

  const handleAdd = () => {
    const newRow: any = { id: null }

    switch (currentSection) {
      case "announcements":
        newRow.title = ""
        newRow.content = ""
        newRow.image_url = ""
        newRow.author = currentUser?.name || ""
        newRow.status = "draft"
        break
      case "votes":
        newRow.title = ""
        newRow.description = ""
        newRow.options = '["同意","反對","棄權"]'
        newRow.author = currentUser?.name || ""
        newRow.status = "active"
        newRow.ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        break
      case "maintenance":
        newRow.equipment = ""
        newRow.item = ""
        newRow.description = ""
        newRow.photo_url = ""
        newRow.reported_by = ""
        newRow.status = "open"
        newRow.handler = ""
        newRow.assignee = ""
        newRow.cost = 0
        break
      case "finance":
        newRow.room = ""
        newRow.amount = 0
        newRow.due = ""
        newRow.invoice = ""
        newRow.paid = false
        break
      case "residents":
        newRow.name = ""
        newRow.room = ""
        newRow.phone = ""
        newRow.email = ""
        newRow.role = "resident"
        break
      case "packages":
        newRow.recipient_name = ""
        newRow.recipient_room = ""
        newRow.courier = ""
        newRow.tracking_number = ""
        newRow.arrived_at = new Date().toISOString()
        newRow.status = "pending"
        newRow.notes = ""
        break
      case "visitors":
        newRow.name = ""
        newRow.room = ""
        newRow.in = new Date().toISOString()
        newRow.out = null
        break
      case "meetings":
        newRow.topic = ""
        newRow.time = ""
        newRow.location = ""
        newRow.notes = ""
        break
      case "facilities":
        newRow.name = ""
        newRow.description = ""
        newRow.location = ""
        newRow.capacity = 1
        newRow.available = true
        newRow.image_url = ""
        break
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
          time: new Date().toISOString(),
          by: currentUser.name || "未知",
        },
      ])

      if (error) throw error
      alert(`已送出緊急事件：${type}`)
    } catch (e: any) {
      console.error(e)
      alert("送出失敗：" + e.message)
    }
  }

  const logout = () => {
    localStorage.removeItem("currentUser")
    router.push("/")
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
    { id: "meetings", icon: "event", label: "會議/活動" },
    { id: "emergencies", icon: "emergency", label: "緊急事件" },
    { id: "facilities", icon: "meeting_room", label: "設施管理" },
  ]

  const navItems = currentUser
    ? allNavItems.filter((item) => canAccessSection(currentUser.role as UserRole, item.id as any))
    : allNavItems

  const hasAccess = currentUser ? canAccessSection(currentUser.role as UserRole, currentSection) : false

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
          <div className="text-[#ffd700] font-bold text-xl mb-4">社區管理系統</div>
          {currentUser && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#ffd700] text-[#222] flex items-center justify-center font-bold text-lg">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-white font-medium">{currentUser.name}</div>
                <div className="text-[#b0b0b0] text-sm">{getRoleLabel(currentUser.role as UserRole)}</div>
              </div>
            </div>
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
          <div className="flex gap-2">
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
          {!hasAccess && currentSection !== "dashboard" ? (
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
                <div className="relative h-[calc(100vh-280px)] min-h-[400px] rounded-2xl overflow-hidden">
                  {announcements.map((announcement, index) => (
                    <div
                      key={announcement.id}
                      className={`absolute inset-0 transition-opacity duration-700 ${
                        index === currentSlide ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        backgroundImage: `url('${announcement.image_url || "/placeholder.svg?height=400&width=1200"}')`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 flex items-end p-4 sm:p-8">
                        <div className="bg-black/75 backdrop-blur-lg p-3 sm:p-5 rounded-xl w-full">
                          <h2 className="text-xl sm:text-3xl font-bold text-[#ffd700] mb-2">{announcement.title}</h2>
                          <p className="text-white text-sm sm:text-base mb-2 leading-relaxed">
                            {announcement.content.substring(0, 200)}
                            {announcement.content.length > 200 ? "..." : ""}
                          </p>
                          <div className="text-[#b0b0b0] text-xs sm:text-sm">
                            發布者: {announcement.author} |{" "}
                            {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {announcements.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`h-2 sm:h-3 rounded-full transition-all ${
                          index === currentSlide
                            ? "w-6 sm:w-8 bg-[#ffd700]"
                            : "w-2 sm:w-3 bg-white/50 hover:bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                </div>
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
                    { icon: "warning", title: "陌生人員闖入", type: "可疑人員", note: "陌生人員闖入警告" },
                  ].map((emergency) => (
                    <button
                      key={emergency.type}
                      onClick={() => confirmEmergency(emergency.type, emergency.note)}
                      className="bg-[rgba(45,45,45,0.85)] border-2 border-[#f44336] rounded-xl p-2 text-center cursor-pointer font-bold text-[#f44336] hover:bg-[rgba(244,67,54,0.2)] transition-all"
                    >
                      <div className="material-icons text-2xl mb-1">{emergency.icon}</div>
                      <h3 className="font-bold text-xs">{emergency.title}</h3>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <div className="flex gap-2 mb-4 flex-wrap">
  {currentSection !== "emergencies" && (
    <button
      onClick={handleAdd}
      className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-[#4caf50] text-white rounded-lg hover:brightness-90 transition-all text-xs sm:text-sm"
    >
      <span className="material-icons text-base sm:text-xl">add</span>
      <span className="hidden sm:inline">新增一筆</span>
      <span className="sm:hidden">新增</span>
    </button>
  )}
  <button
    onClick={loadData}
    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border border-[#ffd700] text-white rounded-lg hover:bg-[#ffd700] hover:text-[#222] transition-all text-xs sm:text-sm"
  >
    <span className="material-icons text-base sm:text-xl">sync</span>
    <span className="hidden sm:inline">重新整理</span>
    <span className="sm:hidden">重整</span>
  </button>

  {/* --- ADD THIS NEW BLOCK OF BUTTONS --- */}
  {currentSection === "finance" && (
    <div className="flex gap-2 border-l-2 border-white/20 pl-2 ml-2">
      <button
        onClick={() => setFinanceFilter("unpaid")}
        className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
          financeFilter === "unpaid"
            ? "bg-[#f44336] text-white"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        未繳 (Unpaid)
      </button>
      <button
        onClick={() => setFinanceFilter("paid")}
        className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
          financeFilter === "paid"
            ? "bg-[#4caf50] text-white"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        已繳 (Paid)
      </button>
      <button
        onClick={() => setFinanceFilter("all")}
        className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
          financeFilter === "all"
            ? "bg-white/30 text-white"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        全部 (All)
      </button>
    </div>
  )}
  {/* --- END OF ADDITION --- */}

</div>

              {loading ? (
                <div className="text-center text-[#b0b0b0] py-12">載入中...</div>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-white/5">
                          {currentSection === "facilities" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10"> 設施名稱</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">說明</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">位置</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">容納人數</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">圖片</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
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
                          {currentSection === "votes" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">標題</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">說明</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">選項(JSON)</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">發起人</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">截止時間</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                          {currentSection === "maintenance" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">設備</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">項目</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">描述</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">報修人</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">照片</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">處理人</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">費用</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                          {currentSection === "finance" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">金額</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">到期日</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">發票</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">已繳</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                          {currentSection === "residents" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">姓名</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">電話</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">Email</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">身分</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                          {currentSection === "packages" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">收件人</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">快遞公司</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">追蹤號碼</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">到達時間</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                          {currentSection === "visitors" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">姓名</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">進場時間</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">離場時間</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                          {currentSection === "meetings" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">主題</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">時間</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">地點</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">備註</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th>
                            </>
                          )}
                          {currentSection === "emergencies" && (
                            <>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">類型</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">時間</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">使用者</th>
                              <th className="p-3 text-left text-[#ffd700] border-b border-white/10">紀錄</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      
                        <tbody>
  {data.length > 0 ? (
    data
      // FIX #2: ADDED THIS .filter() TO MAKE THE FINANCE BUTTONS WORK
      .filter((row) => {
        if (currentSection !== "finance") return true // Show all if not in finance section
        if (financeFilter === "all") return true // Show all if filter is 'all'
        if (financeFilter === "paid") return row.paid === true
        if (financeFilter === "unpaid") return row.paid === false
        return true
      })
      .map((row, index) => (
        <tr key={row.id || index} className="hover:bg-white/5 transition-colors">
          {currentSection === "facilities" && (
            <>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.name || ""}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <textarea
                  value={row.description || ""}
                  onChange={(e) => updateRow(index, "description", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.location || ""}
                  onChange={(e) => updateRow(index, "location", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="number"
                  value={row.capacity || 1}
                  onChange={(e) => updateRow(index, "capacity", Number(e.target.value))}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
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
                <select
                  value={String(row.available)}
                  onChange={(e) => updateRow(index, "available", e.target.value === "true")}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                >
                  <option value="true">可用</option>
                  <option value="false">不可用</option>
                </select>
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
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
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                >
                  <option value="draft">草稿</option>
                  <option value="published">已發布</option>
                </select>
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "votes" && (
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
                  value={row.description || ""}
                  onChange={(e) => updateRow(index, "description", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <textarea
                  value={
                    typeof row.options === "string" ? row.options : JSON.stringify(row.options)
                  }
                  onChange={(e) => updateRow(index, "options", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
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
                <input
                  type="date"
                  value={row.ends_at ? row.ends_at.split("T")[0] : ""}
                  onChange={(e) => updateRow(index, "ends_at", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <select
                  value={row.status || "active"}
                  onChange={(e) => updateRow(index, "status", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                >
                  <option value="active">進行中</option>
                  <option value="closed">已結束</option>
                </select>
              </td>
              <td className="p-3 border-b border-white/5">
                {/* FIX #1: MOVED THE 'View Results' BUTTON *INSIDE* THIS DIV */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                  {row.id && (
                    <button
                      onClick={() => handleViewResults(row)}
                      className="px-3 py-1 bg-[#2196f3] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      查看結果
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "maintenance" && (
            <>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.equipment || ""}
                  onChange={(e) => updateRow(index, "equipment", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.item || ""}
                  onChange={(e) => updateRow(index, "item", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <textarea
                  value={row.description || ""}
                  onChange={(e) => updateRow(index, "description", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.reported_by || ""}
                  onChange={(e) => updateRow(index, "reported_by", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                {row.photo_url ? (
                  <img
                    src={row.photo_url || "/placeholder.svg"}
                    alt="維修照片"
                    className="max-w-[100px] h-auto rounded cursor-pointer hover:scale-150 transition-transform"
                    onClick={() => window.open(row.photo_url, "_blank")}
                  />
                ) : (
                  <span className="text-[#b0b0b0] text-sm">無照片</span>
                )}
              </td>
              <td className="p-3 border-b border-white/5">
                <select
                  value={row.status || "open"}
                  onChange={(e) => updateRow(index, "status", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                >
                  <option value="open">待處理</option>
                  <option value="progress">處理中</option>
                  <option value="closed">已完成</option>
                </select>
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.handler || ""}
                  onChange={(e) => updateRow(index, "handler", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="number"
                  value={row.cost || 0}
                  onChange={(e) => updateRow(index, "cost", Number(e.target.value))}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "finance" && (
            <>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.room || ""}
                  onChange={(e) => updateRow(index, "room", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="number"
                  value={row.amount || 0}
                  onChange={(e) => updateRow(index, "amount", Number(e.target.value))}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="date"
                  value={row.due ? row.due.split("T")[0] : ""}
                  onChange={(e) => updateRow(index, "due", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.invoice || ""}
                  onChange={(e) => updateRow(index, "invoice", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <select
                  value={String(row.paid)}
                  onChange={(e) => updateRow(index, "paid", e.target.value === "true")}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                >
                  <option value="false">未繳</option>
                  <option value="true">已繳</option>
                </select>
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "residents" && (
            <>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.name || ""}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.room || ""}
                  onChange={(e) => updateRow(index, "room", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="tel"
                  value={row.phone || ""}
                  onChange={(e) => updateRow(index, "phone", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="email"
                  value={row.email || ""}
                  onChange={(e) => updateRow(index, "email", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <select
                  value={row.role || "resident"}
                  onChange={(e) => updateRow(index, "role", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                >
                  <option value="resident">住戶</option>
                  <option value="committee">委員會</option>
                  <option value="vendor">廠商</option>
                  <option value="admin">管理員</option>
                </select>
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "packages" && (
            <>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.recipient_name || ""}
                  onChange={(e) => updateRow(index, "recipient_name", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.recipient_room || ""}
                  onChange={(e) => updateRow(index, "recipient_room", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.courier || ""}
                  onChange={(e) => updateRow(index, "courier", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.tracking_number || ""}
                  onChange={(e) => updateRow(index, "tracking_number", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="datetime-local"
                  value={row.arrived_at ? row.arrived_at.slice(0, 16) : ""}
                  onChange={(e) => updateRow(index, "arrived_at", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <select
                  value={row.status || "pending"}
                  onChange={(e) => updateRow(index, "status", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                >
                  <option value="pending">待領取</option>
                  <option value="picked-up">已領取</option>
                </select>
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "visitors" && (
            <>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.name || ""}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.room || ""}
                  onChange={(e) => updateRow(index, "room", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="text-[#b0b0b0] text-sm">
                  {row.in ? new Date(row.in).toLocaleString("zh-TW") : "-"}
                </div>
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="text-[#b0b0b0] text-sm">
                  {row.out ? new Date(row.out).toLocaleString("zh-TW") : "-"}
                </div>
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && !row.out && (
                    <button
                      onClick={async () => {
                        updateRow(index, "out", new Date().toISOString())
                        await handleSave({ ...row, out: new Date().toISOString() }, index)
                      }}
                      className="px-3 py-1 bg-[#ff9800] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      簽出
                    </button>
                  )}
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "meetings" && (
            <>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.topic || ""}
                  onChange={(e) => updateRow(index, "topic", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="datetime-local"
                  value={row.time ? row.time.slice(0, 16) : ""}
                  onChange={(e) => updateRow(index, "time", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <input
                  type="text"
                  value={row.location || ""}
                  onChange={(e) => updateRow(index, "location", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <textarea
                  value={row.notes || ""}
                  onChange={(e) => updateRow(index, "notes", e.target.value)}
                  className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white outline-none focus:border-[#ffd700]"
                />
              </td>
              <td className="p-3 border-b border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(row, index)}
                    className="px-3 py-1 bg-[#4caf50] text-white rounded hover:brightness-90 transition-all text-sm"
                  >
                    儲存
                  </button>
                  {row.id && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="px-3 py-1 bg-[#f44336] text-white rounded hover:brightness-90 transition-all text-sm"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
          {currentSection === "emergencies" && (
            <>
              <td className="p-3 border-b border-white/5 text-[#f44336]">{row.type}</td>
              <td className="p-3 border-b border-white/5 text-[#b0b0b0]">
                {new Date(row.time).toLocaleString("zh-TW")}
              </td>
              <td className="p-3 border-b border-white/5 text-white">{row.by}</td>
              <td className="p-3 border-b border-white/5 text-[#b0b0b0]">{row.note}</td>
            </>
          )}
        </tr>
      ))
  ) : (
    <tr>
      <td colSpan={20} className="p-8 text-center text-[#b0b0b0]">
        目前無資料
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
        {/* // ... (This is the end of the main content area) */}
        </div>
      </main>

      {showResultsModal && selectedVote && (
  <div
    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[199] flex items-center justify-center p-4"
    onClick={() => setShowResultsModal(false)} // Click background to close
  >
    <div
      className="bg-[#2d2d2d] border-2 border-[#ffd700] rounded-2xl p-6 max-w-lg w-full text-white"
      onClick={(e) => e.stopPropagation()} // Stop click from bubbling to background
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-[#ffd700]">投票結果</h2>
        <button
          onClick={() => setShowResultsModal(false)}
          className="material-icons text-white hover:text-[#ffd700]"
        >
          close
        </button>
      </div>

      <h3 className="text-xl font-semibold text-white mb-6">{selectedVote.title}</h3>

      {resultsLoading ? (
        <div className="text-center text-[#b0b0b0] py-8">載入結果中...</div>
      ) : voteResults ? (
        (() => {
          // Calculate total votes first for percentage
          const totalVotes = Object.values(voteResults).reduce((a: number, b: number) => a + b, 0)
          
          return (
            <div className="space-y-4">
              {Object.entries(voteResults).map(([option, count]) => (
                <div key={option}>
                  <div className="flex justify-between text-white mb-1 font-medium">
                    <span>{option}</span>
                    <span>{count} 票</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-[#ffd700] h-4 rounded-full transition-all duration-500"
                      style={{
                        width: totalVotes === 0 ? "0%" : `${(count / totalVotes) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
              <div className="text-right text-[#b0b0b0] mt-6 pt-4 border-t border-white/10">
                <strong>總票數: {totalVotes}</strong>
              </div>
            </div>
          )
        })()
      ) : (
        <div className="text-center text-red-400 py-8">無法載入結果或尚無人投票。</div>
      )}
    </div>
  </div>
)}
{/* --- END OF MODAL BLOCK --- */}
    </div>
  )
}     
    
 