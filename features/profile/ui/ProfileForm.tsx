"use client"

import type React from "react"

import { useProfile } from "../hooks/useProfile"
import type { User } from "../api/profile"

interface ProfileFormProps {
  currentUser: User | null
  onUpdate?: (user: User | null) => void
  onClose?: () => void
}

export function ProfileForm({ currentUser, onUpdate, onClose }: ProfileFormProps) {
  const { profileForm, setProfileForm, handleProfileUpdate, isUpdating } = useProfile(currentUser)

  const onSubmit = async (e: React.FormEvent) => {
    const updatedUser = await handleProfileUpdate(e)
    if (updatedUser && onUpdate) {
      onUpdate(updatedUser)
    }
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border-accent)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-5">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
          <span className="material-icons">person</span>
          個人資料
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
      <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">姓名</label>
          <input
            type="text"
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">房號</label>
          <input
            type="text"
            value={profileForm.room}
            onChange={(e) => setProfileForm({ ...profileForm, room: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">電話</label>
          <input
            type="tel"
            value={profileForm.phone}
            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">Email</label>
          <input
            type="email"
            value={profileForm.email}
            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
            className="w-full p-3 rounded-lg theme-input outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--theme-text-primary)] mb-2">新密碼（留空則不修改）</label>
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
