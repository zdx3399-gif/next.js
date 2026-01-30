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
      setStatus("請先登入或註冊帳號，再綁定 LINE");
    } else if (isLineBound && profile) {
      setStatus("✓ 已綁定 LINE");
      setLineProfile({
        userId: profile.line_user_id,
        displayName: profile.line_display_name,
        pictureUrl: profile.line_avatar_url,
        statusMessage: profile.line_status_message,
      });
      bindingAttempted.current = true;
    } else if (user) {
      setStatus("✓ 登入成功！請綁定 LINE");
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
        setStatus("✓ LINE 綁定成功！正在跳轉...");
        bindingAttempted.current = true;
        
        // Refresh profile to get updated LINE info
        await refreshProfile();
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
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
   * 註冊
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
        setStatus("✓ 註冊成功！請點擊綁定 LINE");
        setEmail("");
        setPassword("");
        setName("");
        setPhone("");
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
   * 登入
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
        // Status will be updated by useEffect when auth state changes
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
   * 手動綁定
   **********************/
  const handleBindClick = () => {
    if (!user) {
      setStatus("⚠️ 請先登入或註冊");
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
        <h1 className="text-3xl font-bold text-center mb-2">LINE 帳號綁定</h1>
        <p className="text-center text-gray-600 mb-6">
          註冊或登入後綁定您的 LINE 帳號
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

        {/* 註冊 / 登入表單 */}
        {!user && (
          <div className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isFormLoading}
              className="border border-gray-300 px-4 py-3 rounded-lg"
            />

            <input
              type="password"
              placeholder="密碼（至少 6 個字元）*"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isFormLoading}
              className="border border-gray-300 px-4 py-3 rounded-lg"
            />

            <div className="flex gap-4">
              <button
                onClick={handleRegister}
                disabled={isFormLoading}
                className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 font-semibold"
              >
                {isFormLoading ? "處理中..." : "註冊"}
              </button>

              <button
                onClick={handleLogin}
                disabled={isFormLoading}
                className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-semibold"
              >
                {isFormLoading ? "處理中..." : "登入"}
              </button>
            </div>
          </div>
        )}

        {/* 綁定按鈕 */}
        {user && !lineProfile && !isLineBound && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-gray-50 p-4 rounded-lg w-full">
              <p className="text-sm text-gray-600">已登入帳號</p>
              <p className="font-semibold text-lg">{profile?.email || user.email}</p>
              {profile?.name && <p className="text-gray-600">{profile.name}</p>}
            </div>

            <button
              onClick={handleBindClick}
              disabled={isBinding || isFormLoading}
              className="w-full py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-semibold text-lg shadow-md"
            >
              {isBinding ? "綁定中..." : "🔗 使用 LINE 綁定帳號"}
            </button>

            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              登出
            </button>
          </div>
        )}

        {/* LINE Profile */}
        {(lineProfile || isLineBound) && (
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={lineProfile?.pictureUrl || profile?.line_avatar_url}
                alt="LINE 大頭貼"
                className="w-32 h-32 rounded-full border-4 border-green-500 shadow-lg"
              />
              <div className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full p-2">
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            <p className="mt-4 font-bold text-xl">
              {lineProfile?.displayName || profile?.line_display_name}
            </p>

            {(lineProfile?.statusMessage || profile?.line_status_message) && (
              <p className="text-sm text-gray-500 italic mt-1">
                "{lineProfile?.statusMessage || profile?.line_status_message}"
              </p>
            )}

            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 w-full">
              <p className="text-green-700 font-semibold text-center">
                ✓ LINE 綁定成功！
              </p>

              {(user || profile) && (
                <p className="text-sm text-gray-600 text-center mt-2">
                  已綁定至 {profile?.email || user?.email}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6 w-full">
              <button
                onClick={handleUnbind}
                disabled={isFormLoading}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400"
              >
                解除綁定
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                前往首頁
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="mt-3 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              登出
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
