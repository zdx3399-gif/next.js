"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { setCurrentTenant, setTenantConfig, type TenantId } from "@/lib/supabase"
import { authenticateUser, registerUser, type UserRole } from "@/lib/auth-actions"
import { shouldUseBackend } from "@/lib/permissions"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const mode = searchParams.get("mode")
    if (mode === "register") {
      setIsLoginMode(false)
    }

    // Check if already logged in
    const currentUser = localStorage.getItem("currentUser")
    if (currentUser) {
      const user = JSON.parse(currentUser)
      const useBackend = shouldUseBackend(user.role)
      router.push(useBackend ? "/admin" : "/dashboard")
    }
  }, [searchParams, router])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const result = await authenticateUser(email, password)

      if (!result.success || !result.tenantId || !result.user) {
        throw new Error(result.error || "登入失敗，請檢查您的帳號密碼")
      }

      // Set the detected tenant and config
      setCurrentTenant(result.tenantId)
      setTenantConfig(result.tenantConfig)

      // Store user in localStorage
      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          ...result.user,
          tenantId: result.tenantId,
        }),
      )

      setSuccessMessage("登入成功！正在跳轉...")

      const useBackend = shouldUseBackend(result.user.role as UserRole)
      setTimeout(() => {
        router.push(useBackend ? "/admin" : "/dashboard")
      }, 1500)
    } catch (error: any) {
      setErrorMessage(error.message || "登入失敗，請檢查您的帳號密碼")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const name = formData.get("name") as string
    const phone = formData.get("phone") as string
    const unit = formData.get("unit") as string
    const role = formData.get("role") as UserRole
    const relationship = formData.get("relationship") as string
    const tenantId = formData.get("tenant") as TenantId

    if (!tenantId) {
      setErrorMessage("請選擇要註冊的社區")
      setLoading(false)
      return
    }

    try {
      const result = await registerUser(tenantId, email, password, name, phone, unit, role, relationship)

      if (!result.success) {
        throw new Error(result.error)
      }

      setSuccessMessage("註冊成功！請使用新帳號登入。")

      setTimeout(() => {
        setIsLoginMode(true)
        setSuccessMessage("")
        // Pre-fill email in login form
        const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement
        if (emailInput) {
          emailInput.value = email
        }
      }, 2000)
    } catch (error: any) {
      setErrorMessage(error.message || "註冊失敗，請稀後再試")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: "var(--theme-bg-gradient)" }}
    >
      <Link
        href="/"
        className="absolute top-5 left-5 flex items-center gap-2 border-2 rounded-full px-5 py-2.5 transition-all"
        style={{
          background: "var(--theme-bg-card)",
          color: "var(--theme-text-primary)",
          borderColor: "var(--theme-accent)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--theme-accent)"
          e.currentTarget.style.color = "var(--theme-bg-primary)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--theme-bg-card)"
          e.currentTarget.style.color = "var(--theme-text-primary)"
        }}
      >
        <span className="material-icons">arrow_back</span>
        返回首頁
      </Link>

      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div
        className="backdrop-blur-md rounded-3xl p-12 w-full max-w-md border-2 shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
        style={{
          background: "var(--theme-bg-card)",
          borderColor: "var(--theme-accent)",
        }}
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--theme-accent)" }}>
            {isLoginMode ? "登入系統" : "註冊帳號"}
          </h1>
          <p style={{ color: "var(--theme-text-muted)" }}>
            {isLoginMode ? "請輸入您的帳號密碼" : "請填寫以下資訊建立帳號"}
          </p>
        </div>

        {errorMessage && (
          <div className="bg-[rgba(244,67,54,0.1)] border border-[#f44336] text-[#f44336] p-3 rounded-lg mb-4">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-[rgba(76,175,80,0.1)] border border-[#4caf50] text-[#4caf50] p-3 rounded-lg mb-4">
            {successMessage}
          </div>
        )}

        {isLoginMode ? (
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                電子郵件
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="請輸入電子郵件"
                className="theme-input w-full px-4 py-3 border-2 rounded-lg outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                密碼
              </label>
              <input
                type="password"
                name="password"
                required
                placeholder="請輸入密碼"
                className="theme-input w-full px-4 py-3 border-2 rounded-lg outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-semibold hover:-translate-y-0.5 transition-all mb-4 disabled:opacity-70"
              style={{
                background: "var(--theme-accent)",
                color: "var(--theme-bg-primary)",
              }}
            >
              <span className="material-icons">login</span>
              {loading ? "登入中..." : "登入"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                選擇社區
              </label>
              <select
                name="tenant"
                required
                className="theme-select w-full px-4 py-3 border-2 rounded-lg outline-none cursor-pointer"
              >
                <option value="">請選擇要註冊的社區</option>
                <option value="tenant_a">社區 A</option>
                <option value="tenant_b">社區 B</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                電子郵件
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="請輸入電子郵件"
                className="theme-input w-full px-4 py-3 border-2 rounded-lg outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                密碼
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                placeholder="請輸入密碼"
                className="theme-input w-full px-4 py-3 border-2 rounded-lg outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                姓名
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="請輸入姓名"
                className="theme-input w-full px-4 py-3 border-2 rounded-lg outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                電話
              </label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="請輸入電話號碼"
                className="theme-input w-full px-4 py-3 border-2 rounded-lg outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                住戶單位
              </label>
              <input
                type="text"
                name="unit"
                required
                placeholder="例：A棟12樓3號"
                className="theme-input w-full px-4 py-3 border-2 rounded-lg outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                身份
              </label>
              <select
                name="role"
                required
                className="theme-select w-full px-4 py-3 border-2 rounded-lg outline-none cursor-pointer"
              >
                <option value="">請選擇身份</option>
                <option value="resident">住戶</option>
                <option value="guard">警衛</option>
                <option value="committee">管委會</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium" style={{ color: "var(--theme-text-primary)" }}>
                與戶主的關係
              </label>
              <select
                name="relationship"
                required
                className="theme-select w-full px-4 py-3 border-2 rounded-lg outline-none cursor-pointer"
              >
                <option value="">請選擇關係</option>
                <option value="owner">戶主</option>
                <option value="household_member">住戶成員</option>
                <option value="tenant">租客</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-semibold hover:-translate-y-0.5 transition-all mb-4 disabled:opacity-70"
              style={{
                background: "var(--theme-accent)",
                color: "var(--theme-bg-primary)",
              }}
            >
              <span className="material-icons">person_add</span>
              {loading ? "註冊中..." : "註冊"}
            </button>
          </form>
        )}

        <div className="text-center pt-6 border-t" style={{ borderColor: "var(--theme-border)" }}>
          <span style={{ color: "var(--theme-text-muted)" }}>{isLoginMode ? "還沒有帳號？" : "已有帳號？"}</span>
          <button
            onClick={() => {
              setIsLoginMode(!isLoginMode)
              setErrorMessage("")
              setSuccessMessage("")
            }}
            className="ml-2 font-medium hover:underline"
            style={{ color: "var(--theme-accent)" }}
          >
            {isLoginMode ? "立即註冊" : "立即登入"}
          </button>
        </div>
      </div>
    </div>
  )
}
