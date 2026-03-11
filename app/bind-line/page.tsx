"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

type LineProfile = {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

type AppUser = {
  id: string
  email: string
  name?: string | null
  phone?: string | null
  line_bound?: boolean
  line_user_id?: string | null
  line_display_name?: string | null
  line_avatar_url?: string | null
  line_status_message?: string | null
}

type LiffLike = {
  init: (args: { liffId: string }) => Promise<void>
  isLoggedIn: () => boolean
  login: () => void
  getProfile: () => Promise<LineProfile>
}

// ✅ 最乾淨的 unknown → message 轉換（解掉 ts(18046)）
function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export default function BindLinePage() {
  const router = useRouter()

  /**********************
   * State 區域
   **********************/
  const [liffObject, setLiffObject] = useState<LiffLike | null>(null)
  const [status, setStatus] = useState("載入中...")
  const [profile, setProfile] = useState<LineProfile | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)

  // 表單欄位
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  const [isBinding, setIsBinding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const bindingAttempted = useRef(false)
  const LIFF_ID = "2008678437-qt2KwvhO"

  /**********************
   * 初始化 LIFF
   **********************/
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import("@line/liff")).default as unknown as LiffLike
        await liff.init({ liffId: LIFF_ID })
        setLiffObject(liff)
        setStatus("請先登入或註冊帳號，再綁定 LINE")
        console.log("✅ LIFF 初始化成功")
      } catch (err) {
        console.error("❌ LIFF 初始化失敗", err)
        setStatus(`LIFF 初始化失敗：${getErrorMessage(err)}`)
      }
    }

    initLiff()
  }, [])

  /**********************
   * 綁定邏輯（統一處理）
   **********************/
  const performBinding = async () => {
    if (!liffObject || !user || isBinding || profile) return

    if (!user.id) {
      setStatus("使用者資料異常，請重新登入")
      setUser(null)
      return
    }

    if (!liffObject.isLoggedIn()) return

    setIsBinding(true)
    setStatus("正在綁定 LINE...")

    try {
      const lineProfile = await liffObject.getProfile()

      const res = await fetch("/api/bind-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: user.id,
          line_user_id: lineProfile.userId,
          line_display_name: lineProfile.displayName,
          line_avatar_url: lineProfile.pictureUrl,
          line_status_message: lineProfile.statusMessage,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setProfile(lineProfile)
        setStatus("✓ LINE 綁定成功！正在跳轉...")
        bindingAttempted.current = true

        // Redirect to dashboard after 1.5 seconds
        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)
      } else {
        setStatus(`綁定失敗：${data.message || "未知錯誤"}`)
      }
    } catch (err) {
      setStatus(`綁定失敗：${getErrorMessage(err)}`)
      console.error(err)
    } finally {
      setIsBinding(false)
    }
  }

  /**********************
   * 自動綁定（登入後 + LIFF 已登入）
   **********************/
  useEffect(() => {
    if (liffObject && user && liffObject.isLoggedIn() && !bindingAttempted.current && !profile) {
      console.log("🤖 自動執行綁定")
      performBinding()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liffObject, user])

  /**********************
   * 註冊
   **********************/
  const handleRegister = async () => {
    if (!email || !password) {
      setStatus("⚠️ 請輸入 Email 和密碼")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setStatus("⚠️ Email 格式不正確")
      return
    }

    if (password.length < 6) {
      setStatus("⚠️ 密碼至少 6 碼")
      return
    }

    setIsLoading(true)
    setStatus("註冊中...")

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name || null,
          phone: phone || null,
        }),
      })

      const data = await res.json()

      if (data.success && data.user) {
        setUser(data.user as AppUser)
        setStatus("✓ 註冊成功！請點擊綁定 LINE")

        setEmail("")
        setPassword("")
        setName("")
        setPhone("")
      } else {
        setStatus(`註冊失敗：${data.message}`)
      }
    } catch (err) {
      setStatus(`註冊失敗：${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  /**********************
   * 登入
   **********************/
  const handleLogin = async () => {
    if (!email || !password) {
      setStatus("⚠️ 請輸入 Email 和密碼")
      return
    }

    setIsLoading(true)
    setStatus("登入中...")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (data.success && data.user) {
        const u = data.user as AppUser
        setUser(u)

        if (u.line_bound) {
          setProfile({
            userId: u.line_user_id || "",
            displayName: u.line_display_name || "",
            pictureUrl: u.line_avatar_url || undefined,
            statusMessage: u.line_status_message || undefined,
          })
          setStatus("✓ 已綁定 LINE，正在跳轉...")
          bindingAttempted.current = true

          // Redirect to dashboard after 1.5 seconds
          setTimeout(() => {
            router.push("/dashboard")
          }, 1500)
        } else {
          setStatus("✓ 登入成功！請綁定 LINE")
        }

        setEmail("")
        setPassword("")
      } else {
        setStatus(`登入失敗：${data.message}`)
      }
    } catch (err) {
      setStatus(`登入失敗：${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  /**********************
   * 手動綁定
   **********************/
  const handleBindClick = () => {
    if (!user) {
      setStatus("⚠️ 請先登入或註冊")
      return
    }

    if (!liffObject) {
      setStatus("LIFF 尚未初始化完成，請稍後再試")
      return
    }

    if (!liffObject.isLoggedIn()) {
      setStatus("導向 LINE 登入中...")
      liffObject.login()
      return
    }

    performBinding()
  }

  /**********************
   * 登出
   **********************/
  const handleLogout = () => {
    setUser(null)
    setProfile(null)
    bindingAttempted.current = false
    setStatus("已登出，請重新登入")
  }

  /**********************
   * 解除綁定
   **********************/
  const handleUnbind = async () => {
    if (!user) return

    const ok = confirm("確定要解除綁定嗎?")
    if (!ok) return

    setIsLoading(true)
    setStatus("解除中...")

    try {
      const res = await fetch("/api/bind-line", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: user.id }),
      })

      const data = await res.json()

      if (data.success) {
        setProfile(null)
        setStatus("✓ 已解除 LINE 綁定")
        bindingAttempted.current = false
      } else {
        setStatus(`解除失敗：${data.message}`)
      }
    } catch (err) {
      setStatus(`解除失敗：${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  /**********************
   * UI
   **********************/
  return (
    <main className="flex flex-col items-center p-10 gap-6 min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-2">LINE 帳號綁定</h1>
        <p className="text-center text-gray-600 mb-6">註冊或登入後綁定您的 LINE 帳號</p>

        {/* 狀態訊息 */}
        <div
          className={`p-4 rounded-lg mb-6 text-center ${
            status.includes("成功") || status.includes("✓")
              ? "bg-green-50 text-green-700 border border-green-200"
              : status.includes("失敗") || status.includes("❌") || status.includes("⚠️")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {status}
        </div>

        {/* 註冊 / 登入表單 */}
        {!user && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="姓名（選填）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className="border border-gray-300 px-4 py-3 rounded-lg"
            />

            <input
              type="tel"
              placeholder="電話（選填）"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              className="border border-gray-300 px-4 py-3 rounded-lg"
            />

            <input
              type="email"
              placeholder="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="border border-gray-300 px-4 py-3 rounded-lg"
            />

            <input
              type="password"
              placeholder="密碼（至少 6 個字元）*"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="border border-gray-300 px-4 py-3 rounded-lg"
            />

            <div className="flex gap-4">
              <button
                onClick={handleRegister}
                disabled={isLoading}
                className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 font-semibold"
              >
                {isLoading ? "處理中..." : "註冊"}
              </button>

              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-semibold"
              >
                {isLoading ? "處理中..." : "登入"}
              </button>
            </div>
          </div>
        )}

        {/* 綁定按鈕 */}
        {user && !profile && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-gray-50 p-4 rounded-lg w-full">
              <p className="text-sm text-gray-600">已登入帳號</p>
              <p className="font-semibold text-lg">{user.email}</p>
              {user.name && <p className="text-gray-600">{user.name}</p>}
            </div>

            <button
              onClick={handleBindClick}
              disabled={isBinding || isLoading}
              className="w-full py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-semibold text-lg shadow-md"
            >
              {isBinding ? "綁定中..." : "🔗 使用 LINE 綁定帳號"}
            </button>

            <button onClick={handleLogout} className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
              登出
            </button>
          </div>
        )}

        {/* LINE Profile */}
        {profile && (
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={profile.pictureUrl || ""}
                alt="LINE 大頭貼"
                className="w-32 h-32 rounded-full border-4 border-green-500 shadow-lg"
              />
              <div className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full p-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            <p className="mt-4 font-bold text-xl">{profile.displayName}</p>

            {profile.statusMessage && (
              <p className="text-sm text-gray-500 italic mt-1">"{profile.statusMessage}"</p>
            )}

            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 w-full">
              <p className="text-green-700 font-semibold text-center">✓ LINE 綁定成功！</p>

              {user && <p className="text-sm text-gray-600 text-center mt-2">已綁定至 {user.email}</p>}
            </div>

            <div className="flex gap-3 mt-6 w-full">
              <button
                onClick={handleUnbind}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400"
              >
                解除綁定
              </button>

              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                登出
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
