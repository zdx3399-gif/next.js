"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface HelpHintProps {
  title: string
  description: string
  workflow?: string[]
  logic?: string[]
  align?: "start" | "center" | "end"
  className?: string
}

const toLogicItems = (description: string): string[] => {
  const normalized = description.replace(/\r\n/g, "\n").trim()
  if (!normalized) {
    return [
      "此功能依頁面狀態與角色權限顯示可用操作。",
      "送出後建議回到列表確認結果是否正確更新。",
    ]
  }

  const bulletByLine = normalized
    .split("\n")
    .map((line) => line.trim().replace(/^[-•\d.)\s]+/, "").trim())
    .filter(Boolean)

  if (bulletByLine.length >= 2) return bulletByLine

  const byPunctuation = normalized
    .split(/[。；;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)

  const baseItems = (byPunctuation.length > 0 ? byPunctuation : [normalized]).slice(0, 4)
  const text = normalized
  const extras: string[] = []

  if (/狀態|進度|待處理|處理中|已完成|審核/.test(text)) {
    extras.push("狀態會影響可執行操作；請依流程順序處理可避免誤操作。")
  }
  if (/刪除|下架|封存|拒絕/.test(text)) {
    extras.push("涉及刪除或下架時建議先確認影響範圍，必要時保留原因備註。")
  }
  if (/搜尋|篩選|查詢/.test(text)) {
    extras.push("搜尋與篩選通常只影響目前列表顯示，不會改動原始資料。")
  }
  if (/通知|LINE|寄送|公告/.test(text)) {
    extras.push("若包含通知流程，送出後可回到紀錄頁確認是否成功發送。")
  }

  const unique: string[] = []
  for (const item of [...baseItems, ...extras]) {
    if (!unique.includes(item)) unique.push(item)
    if (unique.length >= 4) break
  }

  return unique
}

const toWorkflowSteps = (title: string, description: string): string[] => {
  const normalizedDescription = description.replace(/\r\n/g, "\n").trim()
  const text = `${title} ${normalizedDescription}`
  const steps: string[] = []

  const explicitSteps = normalizedDescription
    .split("\n")
    .map((line) => line.trim().replace(/^[-•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 0)

  if (explicitSteps.length >= 3) {
    return explicitSteps.slice(0, 4)
  }

  const clauseSteps = normalizedDescription
    .split(/[。；;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => /點|按|輸入|填寫|選擇|送出|確認|查看|檢查|更新|建立|新增|編輯|刪除|派工|結案|審核/.test(part))

  if (clauseSteps.length >= 2) {
    const seeded = [
      /搜尋|篩選|查詢/.test(text) ? "先用搜尋或篩選縮小範圍，再選定目標資料。" : "先確認當前資料與狀態，再開始操作。",
      ...clauseSteps,
      "完成後回到列表檢查狀態、欄位與結果是否正確。",
    ]
    const unique: string[] = []
    for (const item of seeded) {
      if (!unique.includes(item)) unique.push(item)
      if (unique.length >= 4) break
    }
    return unique
  }

  if (/搜尋|查詢|篩選|定位/.test(text)) {
    steps.push("先輸入關鍵字或設定篩選條件，縮小處理範圍。")
  }
  if (/新增|建立|發起|送出|提交|預約|填寫/.test(text)) {
    steps.push("按新增或送出後依欄位提示填寫必要資料，確認格式與必填資訊。")
  }
  if (/派工|指派|分派/.test(text)) {
    steps.push("在操作欄執行派工/指派，填入負責人、時間與必要備註。")
  }
  if (/結案|完成|完工/.test(text)) {
    steps.push("完成處理後執行結案，補齊最終費用、結果與完工資訊。")
  }
  if (/審核|核准|發布|下架|刪除|遮蔽|封禁|更新/.test(text)) {
    steps.push("執行對應操作並填寫原因或備註，保留可追溯記錄。")
  }
  if (/狀態|流程|列表|結果|紀錄|通知|統計|顯示/.test(text)) {
    steps.push("回到列表確認狀態與結果是否更新，必要時再次調整。")
  }

  const fallback = [
    "先確認目前頁面狀態與你的操作權限。",
    "依畫面提示完成輸入、選擇或篩選條件設定。",
    "執行按鈕操作後，確認系統回饋訊息是否成功。",
    "回到列表檢查狀態、結果與後續可追蹤紀錄。",
  ]

  const merged = [...steps, ...fallback]
  const unique: string[] = []
  for (const item of merged) {
    if (!unique.includes(item)) unique.push(item)
    if (unique.length >= 4) break
  }
  return unique
}

export function HelpHint({ title, description, workflow, logic, align = "start", className = "" }: HelpHintProps) {
  const workflowSteps = workflow && workflow.length > 0 ? workflow : toWorkflowSteps(title, description)
  const logicItems = logic && logic.length > 0 ? logic : toLogicItems(description)

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
      <PopoverContent align={align} className={`z-[1300] w-96 max-w-[90vw] text-sm ${className}`}>
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
