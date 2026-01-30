"use client"

import { useState } from "react"
import { KnowledgeCardList } from "./KnowledgeCardList"
import { KnowledgeCardDetail } from "./KnowledgeCardDetail"
import type { User } from "@/features/profile/api/profile"

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
      {view === "list" ? (
        <KnowledgeCardList currentUser={currentUser} onSelectCard={handleSelectCard} />
      ) : (
        selectedCardId && <KnowledgeCardDetail cardId={selectedCardId} currentUser={currentUser} onBack={handleBack} />
      )}
    </div>
  )
}
