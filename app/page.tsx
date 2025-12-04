"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--theme-bg-gradient)" }}>
      {/* Header */}
      <header
        className="backdrop-blur-md border-b-2 flex-shrink-0"
        style={{
          background: "var(--theme-header-bg)",
          borderColor: "var(--theme-accent)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xl sm:text-2xl font-bold" style={{ color: "var(--theme-accent)" }}>
            社區管理系統
          </div>
          <div className="flex gap-2 sm:gap-4 items-center">
            <ThemeToggle />
            <Link
              href="/auth?mode=login"
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 border-2 rounded-lg transition-all text-sm sm:text-base"
              style={{
                borderColor: "var(--theme-accent)",
                color: "var(--theme-text-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--theme-accent)"
                e.currentTarget.style.color = "var(--theme-bg-primary)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = "var(--theme-text-primary)"
              }}
            >
              <span className="material-icons text-lg sm:text-xl">login</span>
              登入
            </Link>
            <Link
              href="/auth?mode=register"
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:-translate-y-0.5 transition-all font-semibold text-sm sm:text-base"
              style={{
                background: "var(--theme-accent)",
                color: "var(--theme-bg-primary)",
              }}
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
          <section
            className="text-center py-16 sm:py-24 md:py-32 rounded-2xl mb-6 sm:mb-8 bg-cover bg-center shadow-2xl"
            style={{
              background: "linear-gradient(to right, var(--theme-hero-overlay-start), var(--theme-hero-overlay-end))",
            }}
          >
            <h1
              className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 drop-shadow-lg px-4"
              style={{ color: "var(--theme-accent)" }}
            >
              歡迎來到社區管理系統
            </h1>
            <p
              className="text-base sm:text-lg md:text-2xl mb-6 sm:mb-10 drop-shadow-md px-4 max-w-3xl mx-auto"
              style={{ color: "var(--theme-text-primary)" }}
            >
              現代化的社區管理解決方案，讓居民生活更便利
            </p>
            <Link
              href="/auth?mode=login"
              className="inline-flex items-center gap-2 px-6 sm:px-10 py-3 sm:py-5 rounded-xl hover:-translate-y-1 hover:shadow-2xl transition-all font-bold text-base sm:text-xl"
              style={{
                background: "var(--theme-accent)",
                color: "var(--theme-bg-primary)",
              }}
            >
              <span className="material-icons text-xl sm:text-2xl">dashboard</span>
              進入系統
            </Link>
          </section>

          {/* Service Modules */}
          <section className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--theme-accent)" }}>
                完整功能介紹
              </h2>
              <p style={{ color: "var(--theme-text-muted)" }} className="text-sm sm:text-base">
                社區管理系統提供以下功能，幫助社區更有效地運作
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {modules.map((module) => (
                <div
                  key={module.title}
                  onClick={() => navigateToModule(module.title)}
                  className="rounded-2xl p-5 sm:p-6 text-left border-2 hover:-translate-y-2 transition-all cursor-pointer group"
                  style={{
                    background: "var(--theme-bg-card)",
                    borderColor: "var(--theme-border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--theme-accent)"
                    e.currentTarget.style.boxShadow = "var(--theme-accent-glow)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--theme-border)"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="material-icons text-3xl sm:text-4xl group-hover:scale-110 transition-transform flex-shrink-0"
                      style={{ color: "var(--theme-accent)" }}
                    >
                      {module.icon}
                    </div>
                    <div className="flex-1">
                      <h3
                        className="text-lg sm:text-xl font-semibold mb-1"
                        style={{ color: "var(--theme-text-primary)" }}
                      >
                        {module.title}
                      </h3>
                      <p className="text-xs sm:text-sm" style={{ color: "var(--theme-text-muted)" }}>
                        {module.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {module.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 rounded-full border"
                        style={{
                          background: "var(--theme-accent-light)",
                          color: "var(--theme-accent)",
                          borderColor: "var(--theme-border)",
                        }}
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
          <section
            className="border rounded-2xl p-6 sm:p-8 mb-12"
            style={{
              background: "var(--theme-bg-card)",
              borderColor: "var(--theme-border)",
            }}
          >
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--theme-accent)" }}>
              為什麼選擇我們？
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="material-icons text-5xl mx-auto mb-3" style={{ color: "var(--theme-accent)" }}>
                  lock
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--theme-text-primary)" }}>
                  安全可靠
                </h3>
                <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
                  採用最新的加密技術，確保您的資料安全無虞
                </p>
              </div>
              <div className="text-center">
                <div className="material-icons text-5xl mx-auto mb-3" style={{ color: "var(--theme-accent)" }}>
                  speed
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--theme-text-primary)" }}>
                  快速高效
                </h3>
                <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
                  簡潔的界面設計，讓您快速找到所需功能
                </p>
              </div>
              <div className="text-center">
                <div className="material-icons text-5xl mx-auto mb-3" style={{ color: "var(--theme-accent)" }}>
                  support_agent
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--theme-text-primary)" }}>
                  24/7 支持
                </h3>
                <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
                  隨時可用的 AI 助手，幫助您解答問題
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="text-center py-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: "var(--theme-text-primary)" }}>
              準備好開始了嗎？
            </h2>
            <p className="mb-6 max-w-2xl mx-auto" style={{ color: "var(--theme-text-muted)" }}>
              加入社區管理系統，享受更便利的社區生活
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth?mode=register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all"
                style={{
                  background: "var(--theme-accent)",
                  color: "var(--theme-bg-primary)",
                }}
              >
                <span className="material-icons">person_add</span>
                立即註冊
              </Link>
              <Link
                href="/auth?mode=login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border-2 rounded-lg font-semibold transition-all"
                style={{
                  borderColor: "var(--theme-accent)",
                  color: "var(--theme-text-primary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--theme-accent)"
                  e.currentTarget.style.color = "var(--theme-bg-primary)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                  e.currentTarget.style.color = "var(--theme-text-primary)"
                }}
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
