"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { updateProfile, type ProfileData, type User } from "../api/profile"
import { HelpHint } from "@/components/ui/help-hint"

interface ProfileFormProps {
  currentUser: User | null
  onUpdate?: (user: User | null) => void
  onClose?: () => void
}

export function ProfileForm({ currentUser, onUpdate, onClose }: ProfileFormProps) {
  const [profileForm, setProfileForm] = useState<ProfileData & { room: string }>({
    name: "",
    unit_id: "",
    room: "",
    phone: "",
    email: "",
    password: "",
  })
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || "",
        unit_id: currentUser.unit_id || "",
        room: currentUser.room || "",
        phone: currentUser.phone || "",
        email: currentUser.email || "",
        password: "",
      })
    }
  }, [currentUser])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser?.id) {
      alert("錯誤：用戶資訊不完整，請重新登入")
      return
    }

    setIsUpdating(true)

    try {
      const updatedUser = await updateProfile(currentUser.id, profileForm)
      localStorage.setItem("currentUser", JSON.stringify(updatedUser))
      alert("個人資料已更新！")
      if (onUpdate) onUpdate(updatedUser)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "未知錯誤"
      console.error(e)
      alert("更新失敗：" + errorMessage)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border-accent)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-5">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
          <span className="material-icons">person</span>
          個人資料
          <HelpHint title="住戶端個人資料" description="可更新姓名、電話、Email 與密碼，房號由系統管理。" workflow={["先檢查目前姓名、電話與 Email 是否正確。","需要改密碼時再填新密碼欄位，否則留空。","按更新資料後確認提示訊息是否成功。"]} logic={["房號為系統綁定欄位，避免住戶自行改動造成戶別錯置。","密碼欄留空即不更新，降低誤改風險。"]} />
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">姓名<HelpHint title="住戶端姓名" description="請填寫可聯絡與辨識的姓名。" workflow={["輸入日常使用且可辨識的姓名。","確認姓名與聯絡資料對應正確後再儲存。"]} logic={["姓名影響通知與客服核身識別。"]} align="center" /></label>
          <input
            type="text"
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">房號<HelpHint title="住戶端房號" description="房號為系統綁定欄位，需由管理端調整。" workflow={["在此欄確認目前綁定房號是否正確。","若有錯誤請聯繫管理端協助調整。"]} logic={["房號關聯費用、包裹與公告權限，不開放住戶端直接修改。"]} align="center" /></label>
          <input
            type="text"
            value={profileForm.room || "未設定"}
            disabled
            className="w-full p-3 rounded-lg theme-input outline-none bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">電話<HelpHint title="住戶端電話" description="用於緊急聯繫與通知，請保持最新。" workflow={["輸入可即時聯絡的電話。","電話異動後立即更新並儲存。"]} logic={["電話是緊急事件通知與管理聯絡主要管道。"]} align="center" /></label>
          <input
            type="tel"
            value={profileForm.phone}
            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">Email<HelpHint title="住戶端 Email" description="用於接收重要通知與帳號相關訊息。" workflow={["輸入可正常收信的 Email。","更新後可留意是否收到系統通知測試。"]} logic={["Email 影響帳號通知、密碼流程與公告送達率。"]} align="center" /></label>
          <input
            type="email"
            value={profileForm.email}
            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2 flex items-center gap-2">新密碼（留空則不修改）<HelpHint title="住戶端密碼更新" description="僅在需要更改時填寫，留空代表維持原密碼。" workflow={["需要改密碼時輸入新密碼。","不改密碼就保持留空直接儲存其他欄位。","更新後請用新密碼重新登入驗證。"]} logic={["系統僅在有輸入新密碼時才送出密碼更新。","可避免每次改個資都強制改密碼。"]} align="center" /></label>
          <input
            type="password"
            value={profileForm.password}
            onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            placeholder="如需修改密碼請輸入"
          />
        </div>
        <button
          type="submit"
          disabled={isUpdating}
          className="px-6 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:brightness-90 transition-all disabled:opacity-50"
        >
          {isUpdating ? "更新中..." : "更新資料"}
        </button>
      </form>
    </div>
  )
}
