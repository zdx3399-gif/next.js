"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KnowledgeCardItem } from "./KnowledgeCardItem"
import { useKnowledgeCards, useVoteCard } from "../hooks/useKMS"
import type { User } from "@/features/profile/api/profile"
import { Search, Plus } from "lucide-react"

interface KnowledgeCardListProps {
  currentUser: User | null
  onSelectCard: (cardId: string) => void
  onCreateCard?: () => void
}

export function KnowledgeCardList({ currentUser, onSelectCard, onCreateCard }: KnowledgeCardListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const { cards, loading, error } = useKnowledgeCards({
    category: selectedCategory,
    search: searchQuery || undefined,
  })
  const { voteCard } = useVoteCard(currentUser?.id || "")

  // Updated categories to match spec
  const categories = [
    { value: undefined, label: "全部" },
    { value: "package", label: "包裹" },
    { value: "visitor", label: "訪客" },
    { value: "repair", label: "報修" },
    { value: "facility", label: "設施" },
    { value: "fee", label: "管理費" },
    { value: "emergency", label: "緊急" },
    { value: "rules", label: "規章" },
    { value: "other", label: "其他" },
  ]

  const canManageKMS = currentUser && ["committee", "admin"].includes(currentUser.role)

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p className="text-sm">載入失敗: {error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Improved search bar with create button */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋知識卡..."
            className="pl-10 bg-background border-border/50"
          />
        </div>
        {canManageKMS && onCreateCard && (
          <Button onClick={onCreateCard} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            新增
          </Button>
        )}
      </div>

      {/* Cleaner category pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <Button
            key={cat.value || "all"}
            onClick={() => setSelectedCategory(cat.value)}
            variant="ghost"
            size="sm"
            className={`shrink-0 rounded-full px-4 ${
              selectedCategory === cat.value
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "hover:bg-muted"
            }`}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Using new KnowledgeCardItem component in grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.length === 0 ? (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <p className="text-sm">尚無知識卡</p>
          </div>
        ) : (
          cards.map((card) => (
            <KnowledgeCardItem
              key={card.id}
              card={card}
              onVote={(cardId, voteType) => voteCard(cardId, voteType === "helpful" ? "up" : "down")}
              onView={(cardId) => onSelectCard(cardId)}
            />
          ))
        )}
      </div>
    </div>
  )
}
