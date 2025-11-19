"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function HomePage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = () => {
    const storedCurrentUser = localStorage.getItem("currentUser")
    if (storedCurrentUser) {
      const user = JSON.parse(storedCurrentUser)
      setCurrentUser(user)
      if (user.role === "resident" || user.role === "committee") {
        router.push("/dashboard")
      } else {
        router.push("/admin")
      }
    }
  }

  const modules = [
    {
      icon: "campaign",
      title: "公告/投票",
      description: "查看最新社區公告和參與投票活動",
      features: ["即時公告更新", "社區投票", "公開討論"],
    },
    {
      icon: "build",
      title: "設備/維護",
      description: "報修設備問題和查看維護進度",
      features: ["快速報修", "狀態追蹤", "照片上傳"],
    },
    {
      icon: "account_balance",
      title: "管理費/收支",
      description: "查看管理費繳費狀況和收支明細",
      features: ["費用查詢", "繳費記錄", "收支明細"],
    },
    {
      icon: "people",
      title: "住戶/人員",
      description: "住戶資料管理和人員聯絡資訊",
      features: ["住戶目錄", "聯絡資訊", "資料驗證"],
    },
    {
      icon: "how_to_reg",
      title: "訪客/包裹",
      description: "訪客登記和包裹收發管理",
      features: ["訪客登記", "包裹追蹤", "收發通知"],
    },
    {
      icon: "event",
      title: "會議/活動",
      description: "社區會議記錄和活動安排",
      features: ["會議通知", "活動報名", "會議記錄"],
    },
  ]

  const navigateToModule = (moduleTitle: string) => {
    router.push("/auth?mode=login")
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
            <Link
              href="/auth?mode=login"
              className="inline-flex items-center gap-2 px-6 sm:px-10 py-3 sm:py-5 bg-[#ffd700] text-[#1a1a1a] rounded-xl hover:bg-[#ffed4e] hover:-translate-y-1 hover:shadow-2xl transition-all font-bold text-base sm:text-xl"
            >
              <span className="material-icons text-xl sm:text-2xl">dashboard</span>
              進入系統
            </Link>
          </section>

          {/* Service Modules */}
          <section className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#ffd700] mb-2">完整功能介紹</h2>
              <p className="text-[#b0b0b0] text-sm sm:text-base">社區管理系統提供以下功能，幫助社區更有效地運作</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {modules.map((module) => (
                <div
                  key={module.title}
                  onClick={() => navigateToModule(module.title)}
                  className="bg-[rgba(45,45,45,0.9)] rounded-2xl p-5 sm:p-6 text-left border-2 border-[rgba(255,215,0,0.2)] hover:border-[#ffd700] hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(255,215,0,0.3)] transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="material-icons text-3xl sm:text-4xl text-[#ffd700] group-hover:scale-110 transition-transform flex-shrink-0">
                      {module.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-semibold mb-1 text-white">{module.title}</h3>
                      <p className="text-xs sm:text-sm text-[#b0b0b0]">{module.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {module.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 rounded-full bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/30"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Benefits Section */}
          <section className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-6 sm:p-8 mb-12">
            <h2 className="text-2xl font-bold text-[#ffd700] mb-6 text-center">為什麼選擇我們？</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="material-icons text-5xl text-[#ffd700] mx-auto mb-3">lock</div>
                <h3 className="text-lg font-semibold text-white mb-2">安全可靠</h3>
                <p className="text-[#b0b0b0] text-sm">採用最新的加密技術，確保您的資料安全無虞</p>
              </div>
              <div className="text-center">
                <div className="material-icons text-5xl text-[#ffd700] mx-auto mb-3">speed</div>
                <h3 className="text-lg font-semibold text-white mb-2">快速高效</h3>
                <p className="text-[#b0b0b0] text-sm">簡潔的界面設計，讓您快速找到所需功能</p>
              </div>
              <div className="text-center">
                <div className="material-icons text-5xl text-[#ffd700] mx-auto mb-3">support_agent</div>
                <h3 className="text-lg font-semibold text-white mb-2">24/7 支持</h3>
                <p className="text-[#b0b0b0] text-sm">隨時可用的 AI 助手，幫助您解答問題</p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="text-center py-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">準備好開始了嗎？</h2>
            <p className="text-[#b0b0b0] mb-6 max-w-2xl mx-auto">加入社區管理系統，享受更便利的社區生活</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth?mode=register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#ffd700] text-[#1a1a1a] rounded-lg font-semibold hover:bg-[#ffed4e] transition-all"
              >
                <span className="material-icons">person_add</span>
                立即註冊
              </Link>
              <Link
                href="/auth?mode=login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border-2 border-[#ffd700] text-white rounded-lg font-semibold hover:bg-[#ffd700] hover:text-[#1a1a1a] transition-all"
              >
                <span className="material-icons">login</span>
                登入帳號
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
