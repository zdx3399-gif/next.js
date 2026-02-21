"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface HelpHintProps {
  title: string
  description: string
  align?: "start" | "center" | "end"
  className?: string
}

const toLogicItems = (description: string): string[] => {
  const normalized = description.replace(/\r\n/g, "\n").trim()
  if (!normalized) return ["此功能依頁面狀態與權限條件執行。"]

  const bulletByLine = normalized
    .split("\n")
    .map((line) => line.trim().replace(/^[-•\d.)\s]+/, "").trim())
    .filter(Boolean)

  if (bulletByLine.length >= 2) return bulletByLine

  const byPunctuation = normalized
    .split(/[。；;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)

  return byPunctuation.length > 0 ? byPunctuation : [normalized]
}

const toWorkflowSteps = (title: string, description: string): string[] => {
  const text = `${title} ${description}`
  const steps: string[] = []

  if (/搜尋|查詢|篩選|定位/.test(text)) {
    steps.push("先輸入關鍵字或設定篩選條件，縮小處理範圍。")
  }
  if (/新增|建立|發起|送出|提交|預約|填寫/.test(text)) {
    steps.push("依欄位提示填寫必要資料，確認格式與必填資訊。")
  }
  if (/審核|處理|指派|核准|發布|下架|刪除|遮蔽|封禁|更新/.test(text)) {
    steps.push("執行對應操作並填寫原因或備註，保留可追溯記錄。")
  }
  if (/狀態|列表|結果|紀錄|通知|統計|顯示/.test(text)) {
    steps.push("回到列表確認狀態與結果是否更新，必要時再次調整。")
  }

  const fallback = [
    "先確認此功能目前頁面狀態與你的操作權限。",
    "依畫面提示完成輸入、選擇或篩選條件設定。",
    "送出操作後，檢查狀態、結果與後續可追蹤紀錄。",
  ]

  const merged = [...steps, ...fallback]
  const unique: string[] = []
  for (const item of merged) {
    if (!unique.includes(item)) unique.push(item)
    if (unique.length >= 4) break
  }
  return unique
}

export function HelpHint({ title, description, align = "start", className = "" }: HelpHintProps) {
  const workflowSteps = toWorkflowSteps(title, description)
  const logicItems = toLogicItems(description)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-accent-light)] text-[var(--theme-accent)] text-xs font-semibold leading-none hover:border-[var(--theme-border-accent)] hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-accent)]"
          aria-label={`${title}說明`}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className={`z-[220] w-96 max-w-[90vw] text-sm ${className}`}>
        <div className="text-[var(--theme-text-primary)] font-semibold mb-2">操作流程</div>
        <ol className="list-decimal pl-5 space-y-1 text-[var(--theme-text-secondary)] leading-relaxed">
          {workflowSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="text-[var(--theme-text-primary)] font-semibold mt-3 mb-2">邏輯說明</div>
        <ul className="list-disc pl-5 space-y-1 text-[var(--theme-text-secondary)] leading-relaxed whitespace-pre-line">
          {logicItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="mt-3 text-xs text-[var(--theme-text-secondary)]/80">功能：{title}</div>
      </PopoverContent>
    </Popover>
  )
}
