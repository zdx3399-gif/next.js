"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function BindLinePage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading, isLineBound, signIn, signUp, signOut, refreshProfile } = useAuth();
  
  /**********************
   * State 區域
   **********************/
  const [liffObject, setLiffObject] = useState<any>(null);
  const [status, setStatus] = useState("載入中...");
  const [lineProfile, setLineProfile] = useState<any>(null);

  // 表單欄位
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  // 切換登入/註冊模式
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [isBinding, setIsBinding] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);

  const bindingAttempted = useRef(false);
  const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2008678437-qt2KwvhO";

  /**********************
   * 初始化 LIFF
   **********************/
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: LIFF_ID });
        setLiffObject(liff);
        console.log("✅ LIFF 初始化成功");
      } catch (err) {
        console.error("❌ LIFF 初始化失敗", err);
        setStatus("LIFF 初始化失敗，請重新整理頁面");
      }
    };

    initLiff();
  }, []);

  /**********************
   * Update status when auth state changes
   **********************/
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setStatus("請使用社區帳號登入以綁定 LINE");
    } else if (isLineBound && profile) {
      // Already bound - redirect to dashboard
      setStatus("✓ 已綁定 LINE，正在跳轉...");
      setLineProfile({
        userId: profile.line_user_id,
        displayName: profile.line_display_name,
        pictureUrl: profile.line_avatar_url,
        statusMessage: profile.line_status_message,
      });
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } else if (user) {
      setStatus("登入成功！正在綁定 LINE...");
    }
  }, [user, profile, isLineBound, authLoading]);

  /**********************
   * 綁定邏輯（統一處理）
   **********************/
  const performBinding = async () => {
    if (!liffObject || !user || isBinding || lineProfile) return;

    if (!user.id) {
      setStatus("使用者資料異常，請重新登入");
      return;
    }

    if (!liffObject.isLoggedIn()) return;

    setIsBinding(true);
    setStatus("正在綁定 LINE...");

    try {
      const liffProfile = await liffObject.getProfile();

      const res = await fetch("/api/bind-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: user.id,
          line_user_id: liffProfile.userId,
          line_display_name: liffProfile.displayName,
          line_avatar_url: liffProfile.pictureUrl,
          line_status_message: liffProfile.statusMessage,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setLineProfile(liffProfile);
        setStatus("✓ LINE 綁定成功！正在跳轉首頁...");
        bindingAttempted.current = true;
        
        // Refresh profile to get updated LINE info
        await refreshProfile();
        
        // Redirect to dashboard immediately
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } else {
        setStatus(`綁定失敗：${data.message || "未知錯誤"}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知錯誤";
      setStatus(`綁定失敗：${errorMessage}`);
      console.error(err);
    } finally {
      setIsBinding(false);
    }
  };

  /**********************
   * 自動綁定（登入後 + LIFF 已登入）
   **********************/
  useEffect(() => {
    if (
      liffObject &&
      user &&
      !isLineBound &&
      liffObject.isLoggedIn() &&
      !bindingAttempted.current &&
      !lineProfile
    ) {
      console.log("🤖 自動執行綁定");
      performBinding();
    }
  }, [liffObject, user, isLineBound]);

  /**********************
   * 註冊並自動綁定 LINE
   **********************/
  const handleRegister = async () => {
    if (!email || !password) {
      setStatus("⚠️ 請輸入 Email 和密碼");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus("⚠️ Email 格式不正確");
      return;
    }

    if (password.length < 6) {
      setStatus("⚠️ 密碼至少 6 碼");
      return;
    }

    setIsFormLoading(true);
    setStatus("註冊中...");

    try {
      const result = await signUp(email, password, name || undefined, phone || undefined);

      if (result.success) {
        setEmail("");
        setPassword("");
        setName("");
        setPhone("");
        setStatus("✓ 註冊成功！正在綁定 LINE...");
        // Auto-binding will be triggered by useEffect when user state changes
      } else {
        setStatus(`註冊失敗：${result.error}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知錯誤";
      setStatus(`註冊失敗：${errorMessage}`);
    } finally {
      setIsFormLoading(false);
    }
  };

  /**********************
   * 登入並自動綁定 LINE
   **********************/
  const handleLogin = async () => {
    if (!email || !password) {
      setStatus("⚠️ 請輸入 Email 和密碼");
      return;
    }

    setIsFormLoading(true);
    setStatus("登入中...");

    try {
      const result = await signIn(email, password);

      if (result.success) {
        setEmail("");
        setPassword("");
        setStatus("✓ 登入成功！正在綁定 LINE...");
        // Auto-binding will be triggered by useEffect when user state changes
      } else {
        setStatus(`登入失敗：${result.error}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知錯誤";
      setStatus(`登入失敗：${errorMessage}`);
    } finally {
      setIsFormLoading(false);
    }
  };

  /**********************
   * 手動綁定（備用）
   **********************/
  const handleBindClick = () => {
    if (!user) {
      setStatus("⚠️ 請先登入");
      return;
    }

    if (!liffObject.isLoggedIn()) {
      setStatus("導向 LINE 登入中...");
      liffObject.login();
      return;
    }

    performBinding();
  };

  /**********************
   * 登出
   **********************/
  const handleLogout = async () => {
    await signOut();
    setLineProfile(null);
    bindingAttempted.current = false;
    setStatus("已登出，請重新登入");
  };

  /**********************
   * 解除綁定
   **********************/
  const handleUnbind = async () => {
    if (!user) return;

    const ok = confirm("確定要解除綁定嗎?");
    if (!ok) return;

    setIsFormLoading(true);
    setStatus("解除中...");

    try {
      const res = await fetch("/api/bind-line", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: user.id }),
      });

      const data = await res.json();

      if (data.success) {
        setLineProfile(null);
        setStatus("✓ 已解除 LINE 綁定");
        bindingAttempted.current = false;
        
        // Refresh profile to clear LINE info
        await refreshProfile();
      } else {
        setStatus(`解除失敗：${data.message}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知錯誤";
      setStatus(`解除失敗：${errorMessage}`);
    } finally {
      setIsFormLoading(false);
    }
  };

  /**********************
   * Loading State
   **********************/
  if (authLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        <p className="mt-4 text-gray-600">載入中...</p>
      </main>
    );
  }

  /**********************
   * UI
   **********************/
  return (
    <main className="flex flex-col items-center p-10 gap-6 min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        {/* LINE Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.93 1.95 5.51 4.87 7.05-.19.63-.48 2.28-.55 2.64-.09.45.17.45.36.33.15-.1 2.38-1.58 3.35-2.22.64.1 1.3.15 1.97.15 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
            </svg>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-center mb-2">LINE 帳號綁定</h1>
        <p className="text-center text-gray-600 mb-6">
          使用您的社區帳號登入以綁定 LINE
        </p>

        {/* 狀態訊息 */}
        <div
          className={`p-4 rounded-lg mb-6 text-center ${
            status.includes("成功") || status.includes("✓")
              ? "bg-green-50 text-green-700 border border-green-200"
              : status.includes("失敗") ||
                status.includes("❌") ||
                status.includes("⚠️")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {status}
        </div>

        {/* 登入/註冊 切換標籤 */}
        {!user && (
          <div className="flex flex-col gap-4">
            {/* 切換按鈕 */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-2">
              <button
                onClick={() => setIsRegisterMode(false)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isRegisterMode 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                登入
              </button>
              <button
                onClick={() => setIsRegisterMode(true)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  isRegisterMode 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                註冊新帳號
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="請輸入 Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isFormLoading}
                className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                密碼
              </label>
              <input
                type="password"
                placeholder={isRegisterMode ? "設定密碼（至少 6 碼）" : "請輸入密碼"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isFormLoading}
                onKeyDown={(e) => e.key === 'Enter' && (isRegisterMode ? handleRegister() : handleLogin())}
                className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* 註冊額外欄位 */}
            {isRegisterMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-gray-400">(選填)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="請輸入姓名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isFormLoading}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話 <span className="text-gray-400">(選填)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="請輸入電話號碼"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isFormLoading}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <button
              onClick={isRegisterMode ? handleRegister : handleLogin}
              disabled={isFormLoading}
              className={`w-full py-3 rounded-lg font-semibold text-lg shadow-md transition-colors text-white ${
                isRegisterMode 
                  ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400'
                  : 'bg-green-500 hover:bg-green-600 disabled:bg-gray-400'
              }`}
            >
              {isFormLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {isRegisterMode ? "註冊中..." : "登入中..."}
                </span>
              ) : (
                isRegisterMode ? "註冊並綁定 LINE" : "登入並綁定 LINE"
              )}
            </button>
            
            <p className="text-center text-sm text-gray-500 mt-2">
              {isRegisterMode 
                ? "註冊後將自動綁定您的 LINE 帳號" 
                : "登入後將自動綁定您的 LINE 帳號"
              }
            </p>
          </div>
        )}

        {/* 綁定中狀態 */}
        {user && !lineProfile && !isLineBound && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-gray-50 p-4 rounded-lg w-full text-center">
              <p className="text-sm text-gray-600">已登入帳號</p>
              <p className="font-semibold text-lg">{profile?.email || user.email}</p>
              {profile?.name && <p className="text-gray-600">{profile.name}</p>}
            </div>

            {isBinding ? (
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
                <p className="text-gray-600">正在綁定 LINE...</p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleBindClick}
                  disabled={isBinding || isFormLoading}
                  className="w-full py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-semibold text-lg shadow-md"
                >
                  🔗 點擊綁定 LINE
                </button>
                
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 text-gray-500 hover:text-gray-700"
                >
                  使用其他帳號
                </button>
              </>
            )}
          </div>
        )}

        {/* LINE 綁定成功 - 顯示並自動跳轉 */}
        {(lineProfile || isLineBound) && (
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={lineProfile?.pictureUrl || profile?.line_avatar_url}
                alt="LINE 大頭貼"
                className="w-24 h-24 rounded-full border-4 border-green-500 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>

            <p className="mt-3 font-bold text-xl">
              {lineProfile?.displayName || profile?.line_display_name}
            </p>

            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 w-full">
              <p className="text-green-700 font-semibold text-center">
                ✓ LINE 綁定成功！
              </p>
              <p className="text-sm text-gray-600 text-center mt-1">
                正在跳轉至首頁...
              </p>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"></div>
              <span className="text-gray-500 text-sm">跳轉中...</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
