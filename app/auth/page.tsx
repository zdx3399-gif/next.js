"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { setCurrentTenant, setTenantConfig, type TenantId } from "@/lib/supabase"
import { authenticateUser, registerUser } from "@/lib/auth-actions"

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
      router.push("/dashboard")
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

      setTimeout(() => {
        router.push("/dashboard")
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
    const role = formData.get("role") as string
    const tenantId = formData.get("tenant") as TenantId

    if (!tenantId) {
      setErrorMessage("請選擇要註冊的社區")
      setLoading(false)
      return
    }

    try {
      const result = await registerUser(
        tenantId,
        email,
        password,
        name,
        phone,
        unit,
        role as "resident" | "committee" | "vendor",
      )

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
      setErrorMessage(error.message || "註冊失敗，請稍後再試")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] p-5">
      <Link
        href="/"
        className="absolute top-5 left-5 flex items-center gap-2 bg-[rgba(45,45,45,0.9)] text-white border-2 border-[#ffd700] rounded-full px-5 py-2.5 hover:bg-[#ffd700] hover:text-[#1a1a1a] transition-all"
      >
        <span className="material-icons">arrow_back</span>
        返回首頁
      </Link>

      <div className="bg-[rgba(45,45,45,0.9)] backdrop-blur-md rounded-3xl p-12 w-full max-w-md border-2 border-[#ffd700] shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#ffd700] mb-2">{isLoginMode ? "登入系統" : "註冊帳號"}</h1>
          <p className="text-[#b0b0b0]">{isLoginMode ? "請輸入您的帳號密碼" : "請填寫以下資訊建立帳號"}</p>
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
              <label className="block mb-2 font-medium text-white">電子郵件</label>
              <input
                type="email"
                name="email"
                required
                placeholder="請輸入電子郵件"
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(255,255,255,0.1)] text-white focus:border-[#ffd700] focus:bg-[rgba(255,255,255,0.15)] outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">密碼</label>
              <input
                type="password"
                name="password"
                required
                placeholder="請輸入密碼"
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(255,255,255,0.1)] text-white focus:border-[#ffd700] focus:bg-[rgba(255,255,255,0.15)] outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#ffd700] text-[#1a1a1a] rounded-lg font-semibold hover:bg-[#ffed4e] hover:-translate-y-0.5 transition-all mb-4 disabled:opacity-70"
            >
              <span className="material-icons">login</span>
              {loading ? "登入中..." : "登入"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">選擇社區</label>
              <select
                name="tenant"
                required
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(45,45,45,0.95)] text-white focus:border-[#ffd700] outline-none cursor-pointer [&>option]:bg-[#2d2d2d] [&>option]:text-white [&>option]:py-2"
              >
                <option value="" className="bg-[#2d2d2d] text-[#888]">
                  請選擇要註冊的社區
                </option>
                <option value="tenant_a" className="bg-[#2d2d2d] text-white">
                  社區 A
                </option>
                <option value="tenant_b" className="bg-[#2d2d2d] text-white">
                  社區 B
                </option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">電子郵件</label>
              <input
                type="email"
                name="email"
                required
                placeholder="請輸入電子郵件"
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(255,255,255,0.1)] text-white focus:border-[#ffd700] focus:bg-[rgba(255,255,255,0.15)] outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">密碼</label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                placeholder="請輸入密碼"
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(255,255,255,0.1)] text-white focus:border-[#ffd700] focus:bg-[rgba(255,255,255,0.15)] outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">姓名</label>
              <input
                type="text"
                name="name"
                required
                placeholder="請輸入姓名"
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(255,255,255,0.1)] text-white focus:border-[#ffd700] focus:bg-[rgba(255,255,255,0.15)] outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">電話</label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="請輸入電話號碼"
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(255,255,255,0.1)] text-white focus:border-[#ffd700] focus:bg-[rgba(255,255,255,0.15)] outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">住戶單位</label>
              <input
                type="text"
                name="unit"
                required
                placeholder="例：A棟12樓3號"
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(255,255,255,0.1)] text-white focus:border-[#ffd700] focus:bg-[rgba(255,255,255,0.15)] outline-none transition-all"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium text-white">身份</label>
              <select
                name="role"
                required
                className="w-full px-4 py-3 border-2 border-[rgba(255,215,0,0.3)] rounded-lg bg-[rgba(45,45,45,0.95)] text-white focus:border-[#ffd700] focus:bg-[rgba(45,45,45,1)] outline-none cursor-pointer [&>option]:bg-[#2d2d2d] [&>option]:text-white [&>option]:py-2"
              >
                <option value="" className="bg-[#2d2d2d] text-[#888]">
                  請選擇身份
                </option>
                <option value="resident" className="bg-[#2d2d2d] text-white">
                  住戶
                </option>
                <option value="committee" className="bg-[#2d2d2d] text-white">
                  委員會成員
                </option>
                <option value="vendor" className="bg-[#2d2d2d] text-white">
                  廠商
                </option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#ffd700] text-[#1a1a1a] rounded-lg font-semibold hover:bg-[#ffed4e] hover:-translate-y-0.5 transition-all mb-4 disabled:opacity-70"
            >
              <span className="material-icons">person_add</span>
              {loading ? "註冊中..." : "註冊"}
            </button>
          </form>
        )}

        <div className="text-center pt-6 border-t border-[rgba(255,215,0,0.3)]">
          <span className="text-[#b0b0b0]">{isLoginMode ? "還沒有帳號？" : "已有帳號？"}</span>
          <button
            onClick={() => {
              setIsLoginMode(!isLoginMode)
              setErrorMessage("")
              setSuccessMessage("")
            }}
            className="ml-2 text-[#ffd700] font-medium hover:underline"
          >
            {isLoginMode ? "立即註冊" : "立即登入"}
          </button>
        </div>
      </div>
    </div>
  )
}
