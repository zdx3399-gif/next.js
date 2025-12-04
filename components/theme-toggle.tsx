"use client"

import { useEffect, useState } from "react"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check localStorage or default to dark
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = savedTheme === "dark" || (!savedTheme && true) // Default to dark
    setIsDark(prefersDark)

    if (prefersDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    localStorage.setItem("theme", newIsDark ? "dark" : "light")

    if (newIsDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border-2 border-[var(--theme-border-accent)] rounded-lg text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)] transition-all font-semibold text-xs sm:text-sm"
        aria-label="切換主題"
      >
        <span className="material-icons text-base sm:text-lg">dark_mode</span>
        <span className="hidden sm:inline">深色</span>
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border-2 border-[var(--theme-border-accent)] rounded-lg text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)] transition-all font-semibold text-xs sm:text-sm"
      aria-label={isDark ? "切換至淺色模式" : "切換至深色模式"}
    >
      <span className="material-icons text-base sm:text-lg">{isDark ? "light_mode" : "dark_mode"}</span>
      <span className="hidden sm:inline">{isDark ? "淺色" : "深色"}</span>
    </button>
  )
}
