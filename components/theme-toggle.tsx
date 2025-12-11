"use client"

import { useEffect, useState, useRef } from "react"
import { createPortal } from "react-dom"

const accentColorCategories = [
  {
    name: "暖色系",
    colors: [
      { name: "金黃", value: "#ffd700" },
      { name: "琥珀", value: "#f59e0b" },
      { name: "橙色", value: "#f97316" },
      { name: "珊瑚", value: "#fb7185" },
      { name: "玫瑰紅", value: "#f43f5e" },
      { name: "緋紅", value: "#ef4444" },
      { name: "酒紅", value: "#be123c" },
      { name: "粉紅", value: "#ec4899" },
    ],
  },
  {
    name: "冷色系",
    colors: [
      { name: "天藍", value: "#3b82f6" },
      { name: "寶藍", value: "#2563eb" },
      { name: "靛藍", value: "#4f46e5" },
      { name: "青色", value: "#06b6d4" },
      { name: "湖水藍", value: "#0ea5e9" },
      { name: "薄荷", value: "#14b8a6" },
      { name: "翠綠", value: "#22c55e" },
      { name: "萊姆", value: "#84cc16" },
    ],
  },
  {
    name: "紫色系",
    colors: [
      { name: "紫羅蘭", value: "#8b5cf6" },
      { name: "薰衣草", value: "#a78bfa" },
      { name: "紫水晶", value: "#c084fc" },
      { name: "洋紅", value: "#d946ef" },
      { name: "桃紅", value: "#f0abfc" },
      { name: "深紫", value: "#7c3aed" },
      { name: "皇家紫", value: "#6d28d9" },
      { name: "葡萄紫", value: "#5b21b6" },
    ],
  },
  {
    name: "中性色",
    colors: [
      { name: "石墨", value: "#6b7280" },
      { name: "銀灰", value: "#9ca3af" },
      { name: "暖灰", value: "#78716c" },
      { name: "藍灰", value: "#64748b" },
      { name: "青灰", value: "#5eead4" },
      { name: "象牙白", value: "#fef3c7" },
      { name: "米色", value: "#d6d3d1" },
      { name: "炭黑", value: "#374151" },
    ],
  },
]

const bgColorCategories = [
  {
    name: "深色背景",
    colors: [
      { name: "純黑", value: "#000000" },
      { name: "深黑", value: "#0a0a0a" },
      { name: "炭黑", value: "#171717" },
      { name: "墨黑", value: "#1a1a1a" },
      { name: "深灰", value: "#262626" },
      { name: "石墨黑", value: "#1f2937" },
      { name: "深藍黑", value: "#0f172a" },
      { name: "午夜藍", value: "#1e1b4b" },
    ],
  },
  {
    name: "深色調",
    colors: [
      { name: "深海藍", value: "#0c4a6e" },
      { name: "深森綠", value: "#052e16" },
      { name: "深酒紅", value: "#4c0519" },
      { name: "深紫羅蘭", value: "#2e1065" },
      { name: "深咖啡", value: "#292524" },
      { name: "深青", value: "#134e4a" },
      { name: "深橄欖", value: "#365314" },
      { name: "深琥珀", value: "#451a03" },
    ],
  },
  {
    name: "淺色背景",
    colors: [
      { name: "純白", value: "#ffffff" },
      { name: "雪白", value: "#fafafa" },
      { name: "淺灰白", value: "#f8fafc" },
      { name: "象牙白", value: "#fffbeb" },
      { name: "米白", value: "#fef3c7" },
      { name: "珍珠白", value: "#f5f5f4" },
      { name: "奶油白", value: "#fefce8" },
      { name: "玫瑰白", value: "#fff1f2" },
    ],
  },
  {
    name: "淺色調",
    colors: [
      { name: "淺藍", value: "#e0f2fe" },
      { name: "淺綠", value: "#dcfce7" },
      { name: "淺紫", value: "#f3e8ff" },
      { name: "淺粉", value: "#fce7f3" },
      { name: "淺青", value: "#ccfbf1" },
      { name: "淺黃", value: "#fef9c3" },
      { name: "淺橙", value: "#ffedd5" },
      { name: "淺灰", value: "#f1f5f9" },
    ],
  },
]

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [customAccent, setCustomAccent] = useState("#ffd700")
  const [customBg, setCustomBg] = useState("#1a1a1a")
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [expandedAccentCategory, setExpandedAccentCategory] = useState<string | null>("暖色系")
  const [expandedBgCategory, setExpandedBgCategory] = useState<string | null>("深色背景")

  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = savedTheme === "dark" || (!savedTheme && true)
    setIsDark(prefersDark)

    const savedAccent = localStorage.getItem("customAccent")
    const savedBg = localStorage.getItem("customBg")
    if (savedAccent) setCustomAccent(savedAccent)
    if (savedBg) setCustomBg(savedBg)

    if (prefersDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }

    if (savedAccent || savedBg) {
      applyCustomColors(savedAccent || "#ffd700", savedBg || "#1a1a1a")
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsColorPickerOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isColorPickerOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 360),
      })
    }
  }, [isColorPickerOpen])

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

  const isLightColor = (hex: string) => {
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  const adjustBrightness = (hex: string, percent: number) => {
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)

    const adjust = (c: number) => Math.min(255, Math.max(0, Math.round(c + (255 * percent) / 100)))

    return `#${adjust(r).toString(16).padStart(2, "0")}${adjust(g).toString(16).padStart(2, "0")}${adjust(b).toString(16).padStart(2, "0")}`
  }

  const applyCustomColors = (accent: string, bg: string) => {
    const root = document.documentElement
    const bgIsLight = isLightColor(bg)

    root.style.setProperty("--theme-accent", accent)
    root.style.setProperty("--theme-accent-hover", adjustBrightness(accent, 15))
    root.style.setProperty("--theme-accent-light", `${accent}1a`)
    root.style.setProperty("--theme-border-accent", accent)
    root.style.setProperty("--theme-accent-glow", `0 15px 40px ${accent}4d`)

    root.style.setProperty("--theme-bg-primary", bg)
    root.style.setProperty("--theme-bg-secondary", `${accent}0d`)
    root.style.setProperty("--theme-bg-card", adjustBrightness(bg, bgIsLight ? -5 : 10) + "d9")
    root.style.setProperty("--theme-gradient-from", bg)
    root.style.setProperty("--theme-gradient-to", adjustBrightness(bg, bgIsLight ? -10 : 15))

    if (bgIsLight) {
      root.style.setProperty("--theme-text-primary", "#1e293b")
      root.style.setProperty("--theme-text-secondary", "#64748b")
      root.style.setProperty("--theme-text-muted", "#94a3b8")
    } else {
      root.style.setProperty("--theme-text-primary", "#ffffff")
      root.style.setProperty("--theme-text-secondary", "#b0b0b0")
      root.style.setProperty("--theme-text-muted", "#888888")
    }

    root.style.setProperty("--theme-border", `${accent}40`)
    root.style.setProperty("--theme-input-bg", `${accent}14`)
    root.style.setProperty("--theme-input-border", `${accent}4d`)
    root.style.setProperty("--theme-input-focus", accent)
    root.style.setProperty("--theme-select-bg", adjustBrightness(bg, bgIsLight ? 5 : 10))
    root.style.setProperty("--theme-select-option-bg", adjustBrightness(bg, bgIsLight ? 5 : 10))
    root.style.setProperty("--theme-btn-save-border", accent)
    root.style.setProperty("--theme-btn-save-text", accent)
    root.style.setProperty("--theme-btn-save-hover", `${accent}26`)
  }

  const handleAccentChange = (color: string) => {
    setCustomAccent(color)
    localStorage.setItem("customAccent", color)
    applyCustomColors(color, customBg)
  }

  const handleBgChange = (color: string) => {
    setCustomBg(color)
    localStorage.setItem("customBg", color)
    applyCustomColors(customAccent, color)
  }

  const resetToDefault = () => {
    localStorage.removeItem("customAccent")
    localStorage.removeItem("customBg")
    setCustomAccent(isDark ? "#ffd700" : "#3b82f6")
    setCustomBg(isDark ? "#1a1a1a" : "#f8fafc")
    const root = document.documentElement
    const properties = [
      "--theme-accent",
      "--theme-accent-hover",
      "--theme-accent-light",
      "--theme-border-accent",
      "--theme-accent-glow",
      "--theme-bg-primary",
      "--theme-bg-secondary",
      "--theme-bg-card",
      "--theme-gradient-from",
      "--theme-gradient-to",
      "--theme-text-primary",
      "--theme-text-secondary",
      "--theme-text-muted",
      "--theme-border",
      "--theme-input-bg",
      "--theme-input-border",
      "--theme-input-focus",
      "--theme-select-bg",
      "--theme-select-option-bg",
      "--theme-btn-save-border",
      "--theme-btn-save-text",
      "--theme-btn-save-hover",
    ]
    properties.forEach((prop) => root.style.removeProperty(prop))
    setIsColorPickerOpen(false)
  }

  if (!mounted) {
    return (
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-[var(--theme-border-accent)] text-[var(--theme-accent)] font-semibold text-sm"
        aria-label="切換主題"
      >
        <span className="material-icons text-lg">dark_mode</span>
        <span className="hidden sm:inline">深色</span>
        <span className="material-icons text-sm">palette</span>
      </button>
    )
  }

  const dropdownContent = isColorPickerOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          className="w-[340px] shadow-2xl rounded-2xl border-2 border-[var(--theme-border-accent)] overflow-hidden"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 99999,
            backgroundColor: "var(--theme-bg-primary)",
          }}
        >
          {/* 標題區 */}
          <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-accent-light)]">
            <div className="flex items-center gap-2 text-[var(--theme-accent)] font-bold">
              <span className="material-icons">palette</span>
              自訂主題顏色
            </div>
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {/* 強調色選擇 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[var(--theme-text-primary)] text-sm font-semibold flex items-center gap-1">
                  <span className="material-icons text-base text-[var(--theme-accent)]">brush</span>
                  強調色
                </label>
                <div
                  className="w-6 h-6 rounded-full border-2 border-[var(--theme-border)]"
                  style={{ backgroundColor: customAccent }}
                />
              </div>

              {/* 分類選擇 */}
              {accentColorCategories.map((category) => (
                <div key={category.name} className="mb-2">
                  <button
                    onClick={() =>
                      setExpandedAccentCategory(expandedAccentCategory === category.name ? null : category.name)
                    }
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all"
                  >
                    {category.name}
                    <span className="material-icons text-sm">
                      {expandedAccentCategory === category.name ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  {expandedAccentCategory === category.name && (
                    <div className="grid grid-cols-8 gap-1.5 p-2 bg-[var(--theme-bg-secondary)] rounded-lg mt-1">
                      {category.colors.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handleAccentChange(preset.value)}
                          className="w-7 h-7 rounded-lg transition-all hover:scale-110 hover:shadow-lg relative group"
                          style={{
                            backgroundColor: preset.value,
                            boxShadow:
                              customAccent === preset.value
                                ? `0 0 0 2px var(--theme-bg-primary), 0 0 0 4px ${preset.value}`
                                : "none",
                          }}
                          title={preset.name}
                        >
                          {customAccent === preset.value && (
                            <span className="material-icons text-white text-sm absolute inset-0 flex items-center justify-center drop-shadow-md">
                              check
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 自訂輸入 */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={customAccent}
                  onChange={(e) => handleAccentChange(e.target.value)}
                  className="w-9 h-9 cursor-pointer rounded-lg border-2 border-[var(--theme-border)] bg-transparent"
                />
                <input
                  type="text"
                  value={customAccent}
                  onChange={(e) => {
                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                      handleAccentChange(e.target.value)
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border-2 border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] outline-none transition-all"
                  placeholder="#ffd700"
                />
              </div>
            </div>

            {/* 分隔線 */}
            <div className="border-t border-[var(--theme-border)] my-4" />

            {/* 背景色選擇 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[var(--theme-text-primary)] text-sm font-semibold flex items-center gap-1">
                  <span className="material-icons text-base text-[var(--theme-accent)]">format_paint</span>
                  背景色
                </label>
                <div
                  className="w-6 h-6 rounded-full border-2 border-[var(--theme-border)]"
                  style={{ backgroundColor: customBg }}
                />
              </div>

              {/* 分類選擇 */}
              {bgColorCategories.map((category) => (
                <div key={category.name} className="mb-2">
                  <button
                    onClick={() => setExpandedBgCategory(expandedBgCategory === category.name ? null : category.name)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all"
                  >
                    {category.name}
                    <span className="material-icons text-sm">
                      {expandedBgCategory === category.name ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  {expandedBgCategory === category.name && (
                    <div className="grid grid-cols-8 gap-1.5 p-2 bg-[var(--theme-bg-secondary)] rounded-lg mt-1">
                      {category.colors.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handleBgChange(preset.value)}
                          className="w-7 h-7 rounded-lg transition-all hover:scale-110 hover:shadow-lg relative group border border-[var(--theme-border)]"
                          style={{
                            backgroundColor: preset.value,
                            boxShadow:
                              customBg === preset.value
                                ? `0 0 0 2px var(--theme-bg-primary), 0 0 0 4px var(--theme-accent)`
                                : "none",
                          }}
                          title={preset.name}
                        >
                          {customBg === preset.value && (
                            <span
                              className="material-icons text-sm absolute inset-0 flex items-center justify-center drop-shadow-md"
                              style={{ color: isLightColor(preset.value) ? "#000" : "#fff" }}
                            >
                              check
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 自訂輸入 */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => handleBgChange(e.target.value)}
                  className="w-9 h-9 cursor-pointer rounded-lg border-2 border-[var(--theme-border)] bg-transparent"
                />
                <input
                  type="text"
                  value={customBg}
                  onChange={(e) => {
                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                      handleBgChange(e.target.value)
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border-2 border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] outline-none transition-all"
                  placeholder="#1a1a1a"
                />
              </div>
            </div>
          </div>

          {/* 底部按鈕 */}
          <div className="px-4 py-3 border-t border-[var(--theme-border)] bg-[var(--theme-bg-secondary)]">
            <button
              onClick={resetToDefault}
              className="w-full py-2.5 text-sm font-semibold rounded-xl border-2 border-[var(--theme-border-accent)] text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-icons text-base">restart_alt</span>
              重置為預設主題
            </button>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="flex items-center">
      <button
        onClick={toggleTheme}
        className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--theme-border-accent)] rounded-l-xl text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)] transition-all font-semibold text-sm"
        aria-label={isDark ? "切換至淺色模式" : "切換至深色模式"}
      >
        <span className="material-icons text-lg">{isDark ? "light_mode" : "dark_mode"}</span>
        <span className="hidden sm:inline">{isDark ? "淺色" : "深色"}</span>
      </button>

      <button
        ref={buttonRef}
        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
        className={`flex items-center gap-1 px-2 py-2 border-2 border-l-0 border-[var(--theme-border-accent)] rounded-r-xl transition-all ${
          isColorPickerOpen
            ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
            : "text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)]"
        }`}
        aria-label="自訂顏色"
        title="自訂主題顏色"
      >
        <span className="material-icons text-lg">palette</span>
        <span className="material-icons text-sm">{isColorPickerOpen ? "expand_less" : "expand_more"}</span>
      </button>

      {dropdownContent}
    </div>
  )
}
