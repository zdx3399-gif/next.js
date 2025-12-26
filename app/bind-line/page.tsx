"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Liff } from "@line/liff";
// Ensure this path matches your project structure
import { authenticateUser, registerUser, type UserRole } from "@/lib/auth-actions";

// 🛠️ CONFIG: Your LIFF ID
const LIFF_ID = "2008678437-qt2KwvhO";

export default function BindLinePage() {
  const router = useRouter();
  
  // -- State --
  const [liffObject, setLiffObject] = useState<Liff | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  // -- Register / Login Form State --
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  // ✅ Extra Fields you wanted
  const [unit, setUnit] = useState(""); 
  const [tenant, setTenant] = useState("tenant_a"); 
  const [role, setRole] = useState<UserRole>("resident");
  const [relationship, setRelationship] = useState("owner");

  const [isBinding, setIsBinding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);

  const bindingAttempted = useRef(false);

  // 1. Load User from LocalStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // 2. Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;
        await liff.init({ liffId: LIFF_ID });
        setLiffObject(liff);
        
        if (liff.isLoggedIn()) {
           const p = await liff.getProfile();
           setProfile(p);
        }
        
        setStatus(user ? "Please click the button to bind" : "Please Login or Register first");
        console.log("✅ LIFF Init Success");
      } catch (err) {
        console.error("❌ LIFF Init Failed", err);
        setStatus("LIFF Initialization Failed");
      }
    };
    initLiff();
  }, [user]);

  // 3. Perform Binding (Updated to match Backend)
  const performBinding = async () => {
    if (!liffObject || !user || isBinding) return;

    if (!user.id) {
      setStatus("User data error, please login again");
      setUser(null);
      return;
    }

    if (!liffObject.isLoggedIn()) {
        liffObject.login();
        return;
    }

    setIsBinding(true);
    setStatus("Binding LINE Account...");

    try {
      const lineProfile = await liffObject.getProfile();

      // Call Backend API
      const res = await fetch("/api/bind-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: user.id,
          line_user_id: lineProfile.userId,
          line_display_name: lineProfile.displayName, // Changed to match your DB column
          line_avatar_url: lineProfile.pictureUrl,    // Changed to match your DB column
          line_status_message: lineProfile.statusMessage,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setProfile(lineProfile);
        setStatus("✓ LINE Binding Successful!");
        bindingAttempted.current = true;
        
        // Update LocalStorage
        const updatedUser = { ...user, line_bound: true };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));
        setUser(updatedUser);
      } else {
        setStatus(`Binding Failed: ${data.message || "Unknown Error"}`);
      }
    } catch (err: any) {
      setStatus(`Binding Failed: ${err.message}`);
      console.error(err);
    } finally {
      setIsBinding(false);
    }
  };

  // 4. Register Logic (With your fields)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !unit) {
      setStatus("⚠️ Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setStatus("Registering...");

    try {
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
        const userData = { ...result.user, tenantId: tenant };
        setUser(userData);
        localStorage.setItem("currentUser", JSON.stringify(userData));
        setStatus("✓ Registered! Please click Bind LINE");
        setEmail(""); setPassword("");
      } else {
        setStatus(`Registration Failed: ${result.error}`);
      }
    } catch (err: any) {
      setStatus(`Registration Failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Login Logic
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setStatus("⚠️ Please enter Email and Password");
      return;
    }

    setIsLoading(true);
    setStatus("Logging in...");

    try {
      const result = await authenticateUser(email, password);

      if (result.success && result.user) {
        const userData = { ...result.user, tenantId: result.tenantId };
        setUser(userData);
        localStorage.setItem("currentUser", JSON.stringify(userData));
        setStatus("✓ Login Successful! Please Bind LINE");
        setEmail(""); setPassword("");
      } else {
        setStatus(`Login Failed: ${result.error}`);
      }
    } catch (err: any) {
      setStatus(`Login Failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem("currentUser");
    bindingAttempted.current = false;
    setStatus("Logged out");
  };

  return (
    <main className="flex flex-col items-center p-6 gap-6 min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">LINE Binding</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">Connect your community account to receive notifications</p>

        {/* Status Message */}
        <div className={`p-4 rounded-xl mb-6 text-center text-sm font-medium ${
            status.includes("Success") || status.includes("✓") ? "bg-green-50 text-green-700 border border-green-200" :
            status.includes("Fail") || status.includes("⚠️") ? "bg-red-50 text-red-700 border border-red-200" :
            "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
          {status}
        </div>

        {/* Not Logged In: Show Forms */}
        {!user && (
          <>
            {isLoginMode ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                 <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="theme-input px-4 py-3 rounded-xl border border-gray-200 outline-none" />
                 <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="theme-input px-4 py-3 rounded-xl border border-gray-200 outline-none" />
                 <button type="submit" disabled={isLoading} className="bg-[var(--theme-accent)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all">
                    {isLoading ? "Logging in..." : "Login"}
                 </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                 <div className="grid grid-cols-2 gap-3">
                    <select value={tenant} onChange={(e) => setTenant(e.target.value)} className="theme-select px-3 py-3 rounded-xl border border-gray-200 bg-white">
                        <option value="tenant_a">Community A</option>
                        <option value="tenant_b">Community B</option>
                    </select>
                    <select value={role} onChange={(e) => setRole(e.target.value as any)} className="theme-select px-3 py-3 rounded-xl border border-gray-200 bg-white">
                        <option value="resident">Resident</option>
                        <option value="committee">Committee</option>
                    </select>
                 </div>
                 <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="text" placeholder="Unit (e.g. A-10-1)" value={unit} onChange={(e) => setUnit(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="theme-input px-4 py-3 rounded-xl border border-gray-200" />
                 
                 <button type="submit" disabled={isLoading} className="bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-700 transition-all mt-2">
                    {isLoading ? "Registering..." : "Register"}
                 </button>
              </form>
            )}

            <div className="text-center mt-6 pt-4 border-t border-gray-100">
              <span className="text-gray-400 text-sm">{isLoginMode ? "No account?" : "Have account?"}</span>
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="ml-2 text-[var(--theme-accent)] font-bold hover:underline">
                {isLoginMode ? "Register" : "Login"}
              </button>
            </div>
          </>
        )}

        {/* Logged In: Show Bind Button */}
        {user && !bindingAttempted.current && (
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            <div className="bg-blue-50 p-5 rounded-2xl w-full border border-blue-100">
              <p className="font-bold text-gray-800 text-lg">{user.name || user.email}</p>
              <p className="text-sm text-gray-600">Logged In</p>
            </div>

            <button
              onClick={performBinding}
              disabled={isBinding || isLoading}
              className="w-full py-4 bg-[#06C755] text-white rounded-xl hover:bg-[#05b34c] font-bold text-lg shadow-lg flex items-center justify-center gap-2"
            >
              {isBinding ? "Binding..." : "One-Click Bind LINE"}
            </button>

            <button onClick={handleLogout} className="text-gray-400 text-sm hover:text-gray-600 underline">
              Logout
            </button>
          </div>
        )}

        {/* Success State */}
        {bindingAttempted.current && profile && (
          <div className="flex flex-col items-center animate-fade-in">
            <img src={profile.pictureUrl} alt="Profile" className="w-24 h-24 rounded-full border-4 border-[#06C755] mb-4" />
            <h2 className="text-xl font-bold text-gray-800">{profile.displayName}</h2>
            <p className="text-green-600 font-bold mb-6">✓ Binding Successful</p>
            <button onClick={() => liffObject?.closeWindow()} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold">
              Close Window
            </button>
          </div>
        )}
      </div>
    </main>
  );
}