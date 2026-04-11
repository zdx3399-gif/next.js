"use client"

import { useState } from "react"
import { KnowledgeCardList } from "./KnowledgeCardList"
import { KnowledgeCardDetail } from "./KnowledgeCardDetail"
import type { User } from "@/features/profile/api/profile"
import { HelpHint } from "@/components/ui/help-hint"

interface KnowledgeBaseProps {
  currentUser: User | null
}
export function KnowledgeBase({ currentUser }: KnowledgeBaseProps) {
  const [view, setView] = useState<"list" | "detail">("list")
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const handleSelectCard = (cardId: string) => {
    setSelectedCardId(cardId)
    setView("detail")
  }

  const handleBack = () => {
    setView("list")
    setSelectedCardId(null)
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">住戶知識庫</span>
        <HelpHint title="住戶端知識庫" description="可先看列表，再進入詳情閱讀完整步驟與注意事項。" workflow={["先在列表頁搜尋或篩選要找的主題。","點進詳情閱讀步驟與注意事項。","如仍不清楚可依聯絡資訊詢問管理端。"]} logic={["知識庫採列表→詳情兩段閱讀，降低資訊負擔。","內容以可重複使用流程為主，避免每次重問。"]} />
      </div>
      {view === "list" ? (
        <KnowledgeCardList currentUser={currentUser} onSelectCard={handleSelectCard} />
      ) : (
        selectedCardId && <KnowledgeCardDetail cardId={selectedCardId} currentUser={currentUser} onBack={handleBack} />
      )}
    </div>
  )
}
