"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Liff } from "@line/liff";
// Ensure this path matches where your auth actions are located
import { authenticateUser, registerUser, type UserRole } from "@/lib/auth-actions";

// 🛠️ CONFIG: Replace with your actual LIFF ID from LINE Developers Console
const LIFF_ID = "2008678437-qt2KwvhO";

export default function BindLinePage() {
  /**********************
   * State 區域
   **********************/
  const router = useRouter();
  const [liffObject, setLiffObject] = useState<Liff | null>(null);
  const [status, setStatus] = useState("載入中...");
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  // -- Register / Login Form State --
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Extra fields required by your system
  const [unit, setUnit] = useState(""); 
  const [tenant, setTenant] = useState("tenant_a"); 
  const [role, setRole] = useState<UserRole>("resident");
  const [relationship, setRelationship] = useState("owner");

  const [isBinding, setIsBinding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // Toggle Login/Register

  // Prevent double-firing in React 18
  const bindingAttempted = useRef(false);

  /**********************
   * 1. Initialize User State
   **********************/
  useEffect(() => {
    // Note: Your project uses "currentUser", not "user"
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  /**********************
   * 2. Initialize LIFF
   **********************/
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;
        await liff.init({ liffId: LIFF_ID });
        setLiffObject(liff);
        
        // If user is already logged in to LINE, update profile state
        if (liff.isLoggedIn()) {
           const p = await liff.getProfile();
           setProfile(p);
        }
        
        // Update status text based on login state
        setStatus(user ? "請點擊按鈕進行綁定" : "請先登入或註冊帳號");
        console.log("✅ LIFF 初始化成功");
      } catch (err) {
        console.error("❌ LIFF 初始化失敗", err);
        setStatus("LIFF 初始化失敗，請確認 LIFF ID 設定 (是否已在 LINE Console 啟用)");
      }
    };

    initLiff();
  }, [user]);

  /**********************
   * 3. Binding Logic (Core)
   **********************/
  const performBinding = async () => {
    // Basic checks
    if (!liffObject || !user || isBinding) return;

    if (!user.id) {
      setStatus("使用者資料異常，請重新登入");
      setUser(null);
      return;
    }

    // Force LINE Login if not logged in
    if (!liffObject.isLoggedIn()) {
        liffObject.login();
        return;
    }

    setIsBinding(true);
    setStatus("正在綁定 LINE...");

    try {
      const lineProfile = await liffObject.getProfile();

      // Call our Backend API
      const res = await fetch("/api/line/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: user.id,
          line_user_id: lineProfile.userId,
          display_name: lineProfile.displayName,
          avatar_url: lineProfile.pictureUrl, // Mapped to 'avatar_url' for DB
          status_message: lineProfile.statusMessage,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setProfile(lineProfile);
        setStatus("✓ LINE 綁定成功！");
        bindingAttempted.current = true;
        
        // Update local user storage to reflect binding status
        const updatedUser = { ...user, line_bound: true };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));
        setUser(updatedUser);
      } else {
        setStatus(`綁定失敗：${data.error || "未知錯誤"}`);
      }
    } catch (err: any) {
      setStatus(`綁定失敗：${err.message}`);
      console.error(err);
    } finally {
      setIsBinding(false);
    }
  };

  /**********************
   * 4. Registration Logic
   **********************/
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !unit) {
      setStatus("⚠️ 請填寫完整資訊 (Email, 密碼, 單位)");
      return;
    }

    setIsLoading(true);
    setStatus("註冊中...");

    try {
      // Use your actual register function from auth-actions
      const result = await registerUser(
          tenant as any, 
          email, 
          password, 
          name, 
          phone, 
          unit, 
          role, 
          relationship
      );

      if (result.success && result.user) {
        // Auto Login after register
        const userData = { ...result.user, tenantId: tenant };
        setUser(userData);
        localStorage.setItem("currentUser", JSON.stringify(userData));
        setStatus("✓ 註冊成功！請點擊綁定 LINE");
        
        // Reset Form
        setEmail(""); setPassword("");
      } else {
        setStatus(`註冊失敗：${result.error}`);
      }
    } catch (err: any) {
      setStatus(`註冊失敗：${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**********************
   * 5. Login Logic
   **********************/
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setStatus("⚠️ 請輸入 Email 和密碼");
      return;
    }

    setIsLoading(true);
    setStatus("登入中...");

    try {
      const result = await authenticateUser(email, password);

      if (result.success && result.user) {
        const userData = { ...result.user, tenantId: result.tenantId };
        setUser(userData);
        localStorage.setItem("currentUser", JSON.stringify(userData));
        setStatus("✓ 登入成功！請點擊下方按鈕綁定");
        
        // Reset Form
        setEmail(""); setPassword("");
      } else {
        setStatus(`登入失敗：${result.error || "帳號或密碼錯誤"}`);
      }
    } catch (err: any) {
      setStatus(`登入失敗：${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem("currentUser");
    bindingAttempted.current = false;
    setStatus("已登出，請重新登入");
  };

  /**********************
   * UI Render
   **********************/
  return (
    <main className="flex flex-col items-center p-6 gap-6 min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">LINE 帳號綁定</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          連結您的社區帳號以接收通知
        </p>

        {/* 狀態訊息 */}
        <div
          className={`p-4 rounded-xl mb-6 text-center text-sm font-medium transition-all ${
            status.includes("成功") || status.includes("✓")
              ? "bg-green-50 text-green-700 border border-green-200"
              : status.includes("失敗") || status.includes("⚠️")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {status}
        </div>

        {/* 1. 尚未登入：顯示 登入/註冊 表單 */}
        {!user && (
          <>
            {isLoginMode ? (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                 <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="theme-input px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 ring-blue-500/20" />
                 <input type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="theme-input px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 ring-blue-500/20" />
                 <button type="submit" disabled={isLoading} className="bg-[var(--theme-accent)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-500/20">
                    {isLoading ? "處理中..." : "登入系統"}
                 </button>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                 <div className="grid grid-cols-2 gap-3">
                    <select value={tenant} onChange={(e) => setTenant(e.target.value)} className="theme-select px-3 py-3 rounded-xl border border-gray-200 bg-white">
                        <option value="tenant_a">社區 A</option>
                        <option value="tenant_b">社區 B</option>
                    </select>
                    <select value={role} onChange={(e) => setRole(e.target.value as any)} className="theme-select px-3 py-3 rounded-xl border border-gray-200 bg-white">
                        <option value="resident">住戶</option>
                        <option value="guard">警衛</option>
                        <option value="committee">管委會</option>
                    </select>
                 </div>
                 <input type="text" placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="tel" placeholder="電話" value={phone} onChange={(e) => setPhone(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="text" placeholder="住戶單位 (例: A-10-1)" value={unit} onChange={(e) => setUnit(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 
                 <button type="submit" disabled={isLoading} className="bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-700 transition-all mt-2">
                    {isLoading ? "註冊中..." : "註冊新帳號"}
                 </button>
              </form>
            )}

            <div className="text-center mt-6 pt-4 border-t border-gray-100">
              <span className="text-gray-400 text-sm">{isLoginMode ? "還沒有帳號？" : "已有帳號？"}</span>
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="ml-2 text-[var(--theme-accent)] font-bold hover:underline">
                {isLoginMode ? "立即註冊" : "返回登入"}
              </button>
            </div>
          </>
        )}

        {/* 2. 已登入：顯示 綁定按鈕 */}
        {user && !bindingAttempted.current && (
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            <div className="bg-blue-50 p-5 rounded-2xl w-full border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                    {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="text-left">
                    <p className="text-xs text-blue-500 font-bold uppercase tracking-wider">Current User</p>
                    <p className="font-bold text-gray-800">{user.email}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 text-left pl-1">您已登入系統，現在請點擊下方按鈕連結您的 LINE。</p>
            </div>

            <button
              onClick={performBinding}
              disabled={isBinding || isLoading}
              className="w-full py-4 bg-[#06C755] text-white rounded-xl hover:bg-[#05b34c] disabled:opacity-50 font-bold text-lg shadow-lg shadow-green-500/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isBinding ? (
                  <span>處理中...</span>
              ) : (
                  <>
                    <span className="material-icons">link</span>
                    <span>一鍵綁定 LINE 帳號</span>
                  </>
              )}
            </button>

            <button onClick={handleLogout} className="text-gray-400 text-sm hover:text-gray-600 underline">
              切換帳號 / 登出
            </button>
          </div>
        )}

        {/* 3. 綁定成功：顯示結果 */}
        {bindingAttempted.current && profile && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="relative mb-4">
              <img
                src={profile.pictureUrl}
                alt="LINE Profile"
                className="w-28 h-28 rounded-full border-4 border-[#06C755] shadow-xl"
              />
              <div className="absolute bottom-0 right-0 bg-[#06C755] text-white rounded-full p-1.5 border-4 border-white">
                <span className="material-icons text-sm font-bold">check</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800">{profile.displayName}</h2>
            <p className="text-green-600 font-bold mt-1 mb-6">✓ 綁定成功</p>

            <div className="w-full bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-500">
                未來社區的公告、包裹與繳費通知都將自動發送到此 LINE 帳號。
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => liffObject?.closeWindow()}
                className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-bold"
              >
                關閉視窗
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold"
              >
                登出
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}