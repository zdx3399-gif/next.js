"use client"
import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { ProfileForm } from "./ProfileForm"
import type { User } from "../api/profile"

interface ProfileDropdownProps {
  currentUser: User | null
  onUpdate?: (user: User | null) => void
  getRoleLabel?: (role: string) => string
}

export function ProfileDropdown({ currentUser, onUpdate, getRoleLabel }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const roleLabel = getRoleLabel
    ? getRoleLabel(currentUser?.role || "")
    : currentUser?.role === "resident"
      ? "住戶"
      : currentUser?.role === "committee"
        ? "委員會"
        : currentUser?.role === "vendor"
          ? "廠商"
          : currentUser?.role === "admin"
            ? "管理員"
            : currentUser?.role === "guest"
              ? "訪客"
              : "住戶"

  const dropdownContent =
    isOpen && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            className="w-[90vw] sm:w-[400px] max-w-[400px] shadow-2xl bg-[var(--theme-bg-card)] border border-[var(--theme-border)]"
            style={{
              position: "fixed",
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              zIndex: 99999,
            }}
          >
            <ProfileForm
              currentUser={currentUser}
              onUpdate={(user) => {
                onUpdate?.(user)
                setIsOpen(false)
              }}
              onClose={() => setIsOpen(false)}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative mt-4">
      <div
        ref={buttonRef}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleToggle()
          }
        }}
        role="button"
        tabIndex={0}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer w-full select-none"
      >
        <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] flex items-center justify-center font-bold text-base flex-shrink-0">
          {currentUser?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="text-left flex-1 min-w-0">
          <div className="text-[var(--theme-text-primary)] font-medium text-sm truncate">
            {currentUser?.name || "載入中..."}
          </div>
          <div className="text-[var(--theme-text-secondary)] text-xs">{roleLabel}</div>
        </div>
        <span className="material-icons text-[var(--theme-text-secondary)] text-sm flex-shrink-0">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </div>

      {dropdownContent}
    </div>
  )
}
