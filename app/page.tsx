"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getSupabaseClient } from "@/lib/supabase"

export default function HomePage() {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState<any | null>(null)

  useEffect(() => {
    checkAuth()
    loadAnnouncements()
  }, [])

  useEffect(() => {
    if (announcements.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % announcements.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [announcements.length])

  const checkAuth = () => {
    const storedCurrentUser = localStorage.getItem("currentUser")
    if (storedCurrentUser) {
      const user = JSON.parse(storedCurrentUser)
      setCurrentUser(user)
      setIsAdmin(user.role === "admin" || user.role === "committee")
      router.push("/dashboard")
    }
  }

  const loadAnnouncements = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) {
        console.error("Error loading announcements:", error)
        return
      }

      if (data && data.length > 0) {
        setAnnouncements(data)
      }
    } catch (error) {
      console.error("Error loading announcements:", error)
    }
  }

  const modules = [
    { icon: "campaign", title: "公告/投票", description: "查看最新社區公告和參與投票活動", id: "announcements" },
    { icon: "build", title: "設備/維護", description: "報修設備問題和查看維護進度", id: "maintenance" },
    { icon: "account_balance", title: "管理費/收支", description: "查看管理費繳費狀況和收支明細", id: "finance" },
    { icon: "people", title: "住戶/人員", description: "住戶資料管理和人員聯絡資訊", id: "residents" },
    { icon: "how_to_reg", title: "訪客/包裹", description: "訪客登記和包裹收發管理", id: "visitors" },
    { icon: "event", title: "會議/活動", description: "社區會議記錄和活動安排", id: "meetings" },
  ]

  const navigateToModule = (moduleId: string) => {
    alert("請先登入系統")
    router.push("/auth")
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]">
      {/* Header */}
      <header className="bg-[rgba(45,45,45,0.9)] backdrop-blur-md border-b-2 border-[#ffd700] flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xl sm:text-2xl font-bold text-[#ffd700]">社區管理系統</div>
          <div className="flex gap-2 sm:gap-4">
            <Link
              href="/auth?mode=login"
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 border-2 border-[#ffd700] rounded-lg text-white hover:bg-[#ffd700] hover:text-[#1a1a1a] transition-all text-sm sm:text-base"
            >
              <span className="material-icons text-lg sm:text-xl">login</span>
              登入
            </Link>
            <Link
              href="/auth?mode=register"
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-[#ffd700] text-[#1a1a1a] rounded-lg hover:bg-[#ffed4e] hover:-translate-y-0.5 transition-all font-semibold text-sm sm:text-base"
            >
              <span className="material-icons text-lg sm:text-xl">person_add</span>
              註冊
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Hero Section */}
          <section className="text-center py-16 sm:py-24 md:py-32 bg-gradient-to-r from-black/80 to-black/60 rounded-2xl mb-6 sm:mb-8 bg-[url('/modern-community-building.jpg')] bg-cover bg-center shadow-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 text-[#ffd700] drop-shadow-lg px-4">
              歡迎來到社區管理系統
            </h1>
            <p className="text-base sm:text-lg md:text-2xl text-white mb-6 sm:mb-10 drop-shadow-md px-4 max-w-3xl mx-auto">
              現代化的社區管理解決方案，讓居民生活更便利
            </p>
            {!currentUser && (
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 px-6 sm:px-10 py-3 sm:py-5 bg-[#ffd700] text-[#1a1a1a] rounded-xl hover:bg-[#ffed4e] hover:-translate-y-1 hover:shadow-2xl transition-all font-bold text-base sm:text-xl"
              >
                <span className="material-icons text-xl sm:text-2xl">dashboard</span>
                進入系統
              </Link>
            )}
          </section>

          {/* Announcement Carousel */}
          {announcements.length > 0 && (
            <section className="mb-6 sm:mb-8">
              <div className="relative w-full h-[350px] sm:h-[450px] overflow-hidden rounded-2xl shadow-2xl">
                {announcements.map((announcement, idx) => (
                  <div
                    key={announcement.id}
                    className={`absolute w-full h-full transition-opacity duration-700 bg-cover bg-center flex items-end ${
                      idx === currentSlide ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ backgroundImage: `url('${announcement.image_url}')` }}
                  >
                    <div className="bg-black/40 backdrop-blur-md p-4 sm:p-6 md:p-8 rounded-xl w-full">
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#ffd700] mb-2 sm:mb-4">
                        {announcement.title}
                      </div>
                      <div className="text-white text-sm sm:text-base md:text-lg mb-2 sm:mb-4 leading-relaxed line-clamp-2 sm:line-clamp-3">
                        {announcement.content.slice(0, 200)}
                        {announcement.content.length > 200 ? "..." : ""}
                      </div>
                      <div className="text-[#b0b0b0] text-xs sm:text-sm">
                        發布者: {announcement.author} | {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {announcements.map((_, idx) => (
                    <div
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 sm:h-3 rounded-full cursor-pointer transition-all ${
                        idx === currentSlide ? "w-6 sm:w-8 bg-[#ffd700]" : "w-2 sm:w-3 bg-white/50 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Service Modules */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {modules.map((module) => (
              <div
                key={module.id}
                onClick={() => navigateToModule(module.id)}
                className="bg-[rgba(45,45,45,0.9)] rounded-2xl p-5 sm:p-6 text-center border-2 border-[rgba(255,215,0,0.2)] hover:border-[#ffd700] hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(255,215,0,0.3)] transition-all cursor-pointer group"
              >
                <div className="material-icons text-4xl sm:text-5xl text-[#ffd700] mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  {module.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">{module.title}</h3>
                <p className="text-sm sm:text-base text-[#b0b0b0]">{module.description}</p>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  )
}
