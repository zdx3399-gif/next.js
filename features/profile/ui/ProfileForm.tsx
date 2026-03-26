"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { getBoundLineAvatarUrl, getProfile, updateProfile, uploadProfileAvatar, type ProfileData, type User } from "../api/profile"
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [lineDefaultAvatarUrl, setLineDefaultAvatarUrl] = useState("")
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || "",
        unit_id: currentUser.unit_id || "",
        room: currentUser.room || "",
        phone: currentUser.phone || "",
        email: currentUser.email || "",
        line_avatar_url: currentUser.line_avatar_url || "",
        password: "",
      })
      setAvatarFile(null)
    }
  }, [currentUser])

  useEffect(() => {
    const loadLineDefaultAvatar = async () => {
      if (!currentUser?.id) return
      const url = await getBoundLineAvatarUrl(currentUser.id)
      setLineDefaultAvatarUrl(url)

      // 只有在目前用戶沒有任何頭像時，才套用 LINE 預設頭貼
      if (!currentUser?.line_avatar_url && url) {
        setProfileForm((prev) => ({ ...prev, line_avatar_url: url }))
      }
    }

    loadLineDefaultAvatar()
  }, [currentUser?.id, currentUser?.line_avatar_url])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser?.id) {
      alert("錯誤：用戶資訊不完整，請重新登入")
      return
    }

    setIsUpdating(true)

    try {
      const submitData: ProfileData = { ...profileForm }

      if (avatarFile) {
        const avatarUrl = await uploadProfileAvatar(avatarFile)
        submitData.line_avatar_url = avatarUrl
      }

      const updatedUser = await updateProfile(currentUser.id, submitData)
      const latestProfile = await getProfile(currentUser.id)

      const syncedUser: User = {
        ...currentUser,
        ...updatedUser,
        ...(latestProfile || {}),
        line_avatar_url:
          latestProfile?.line_avatar_url ||
          updatedUser.line_avatar_url ||
          submitData.line_avatar_url ||
          currentUser.line_avatar_url,
      }

      localStorage.setItem("currentUser", JSON.stringify(syncedUser))
      alert("個人資料已更新！")
      if (onUpdate) onUpdate(syncedUser)
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
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl pb-2">
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">頭像</label>
          <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)]/50 p-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[var(--theme-accent)]/50 bg-[var(--theme-bg-secondary)] flex items-center justify-center shadow-sm">
              {avatarFile ? (
                <img src={URL.createObjectURL(avatarFile)} alt="新頭像預覽" className="w-full h-full object-cover" />
              ) : profileForm.line_avatar_url ? (
                <img src={profileForm.line_avatar_url} alt="目前頭像" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[var(--theme-text-secondary)] text-xs">無</span>
              )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setAvatarFile(file)
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] text-sm font-semibold hover:brightness-95 transition-all"
                  >
                    更換頭像
                  </button>
                  {lineDefaultAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarFile(null)
                        setProfileForm((prev) => ({ ...prev, line_avatar_url: lineDefaultAvatarUrl }))
                      }}
                      className="px-3 py-2 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text-primary)] text-sm font-medium bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-primary)] transition-colors"
                    >
                      還原 LINE 頭貼
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--theme-text-secondary)] mt-2 truncate">
                  {avatarFile ? `已選擇：${avatarFile.name}` : "尚未選擇新檔案"}
                </p>
              </div>
            </div>
          </div>
        </div>
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
