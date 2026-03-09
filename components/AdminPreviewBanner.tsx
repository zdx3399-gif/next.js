"use client"

import { AlertTriangle, Eye } from "lucide-react"

interface AdminPreviewBannerProps {
  show: boolean
}

export function AdminPreviewBanner({ show }: AdminPreviewBannerProps) {
  if (!show) return null

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Eye className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h4 className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            系統管理員預覽模式
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            您正在以系統管理員身份預覽此頁面。此頁面目前顯示測試資料，不會讀取真實住戶資料。
          </p>
          <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-2">
            預覽操作僅供介面確認與流程檢視。
          </p>
        </div>
      </div>
    </div>
  )
}

// 遮蔽資料的佔位顯示組件
export function MaskedContent({ type = "text" }: { type?: "text" | "title" | "name" | "email" | "phone" }) {
  const placeholders: Record<string, string> = {
    text: "[內容已遮蔽]",
    title: "[標題已遮蔽]",
    name: "***",
    email: "***@***.com",
    phone: "****-***-***",
  }

  return (
    <span className="bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded text-sm italic">
      {placeholders[type] || placeholders.text}
    </span>
  )
}
