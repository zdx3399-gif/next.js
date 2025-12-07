"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { updateProfile, type ProfileData, type User } from "../api/profile"

export function useProfile(currentUser: User | null) {
  const [profileForm, setProfileForm] = useState<ProfileData>({
    name: "",
    unit_id: "", // 改用 unit_id
    phone: "",
    email: "",
    password: "",
  })

  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || "",
        unit_id: currentUser.unit_id || "", // 改用 unit_id
        phone: currentUser.phone || "",
        email: currentUser.email || "",
        password: "",
      })
    }
  }, [currentUser])

  const handleProfileUpdate = async (e: React.FormEvent): Promise<User | null> => {
    e.preventDefault()

    if (!currentUser?.id) {
      alert("錯誤：用戶資訊不完整，請重新登入")
      return null
    }

    setIsUpdating(true)

    try {
      const updatedUser = await updateProfile(currentUser.id, profileForm)

      localStorage.setItem("currentUser", JSON.stringify(updatedUser))
      alert("個人資料已更新！")
      return updatedUser
    } catch (e: any) {
      console.error(e)
      alert("更新失敗：" + e.message)
      return null
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    profileForm,
    setProfileForm,
    handleProfileUpdate,
    isUpdating,
  }
}
