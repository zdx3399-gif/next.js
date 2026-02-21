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
        <HelpHint title="住戶端知識庫" description="可先看列表，再進入詳情閱讀完整步驟與注意事項。" />
      </div>
      {view === "list" ? (
        <KnowledgeCardList currentUser={currentUser} onSelectCard={handleSelectCard} />
      ) : (
        selectedCardId && <KnowledgeCardDetail cardId={selectedCardId} currentUser={currentUser} onBack={handleBack} />
      )}
    </div>
  )
}
