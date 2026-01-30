"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThumbsUp, ThumbsDown, ExternalLink, Shield, CheckCircle2 } from "lucide-react"
import { useState } from "react"

interface KnowledgeCardItemProps {
  card: {
    id: string
    title: string
    summary: string
    category: string
    credibility: string // Changed from credibility_level
    helpful_count: number // Changed from vote_up
    not_helpful_count: number // Changed from vote_down
    view_count: number
    created_at: string
    tags?: string[]
  }
  onVote?: (cardId: string, voteType: "helpful" | "not_helpful") => void
  onView?: (cardId: string) => void
}

export function KnowledgeCardItem({ card, onVote, onView }: KnowledgeCardItemProps) {
  const [voted, setVoted] = useState<"helpful" | "not_helpful" | null>(null)

  const getCredibilityBadge = (level: string) => {
    switch (level) {
      case "official":
        return (
          <Badge variant="default" className="gap-1 bg-blue-500 border-0">
            <Shield className="w-3 h-3" />
            官方
          </Badge>
        )
      case "verified":
        return (
          <Badge variant="default" className="gap-1 bg-green-500 border-0">
            <CheckCircle2 className="w-3 h-3" />
            已驗證
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            社區
          </Badge>
        )
    }
  }

  const handleVote = (voteType: "helpful" | "not_helpful") => {
    setVoted(voteType)
    onVote?.(card.id, voteType)
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 overflow-hidden border-border/40">
      <div className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getCredibilityBadge(card.credibility)}
              <Badge variant="outline" className="text-xs border-border/50">
                {card.category}
              </Badge>
            </div>
            <h3 className="font-semibold text-base md:text-lg leading-snug text-balance mb-2">{card.title}</h3>
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">{card.summary}</p>

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {card.tags.slice(0, 4).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs px-2 py-0 border-border/50 text-muted-foreground">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 h-8 px-2 ${voted === "helpful" ? "text-green-500" : "text-muted-foreground"}`}
              onClick={() => handleVote("helpful")}
            >
              <ThumbsUp className={`w-4 h-4 ${voted === "helpful" ? "fill-current" : ""}`} />
              <span className="text-xs">{card.helpful_count || 0}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 h-8 px-2 ${voted === "not_helpful" ? "text-red-500" : "text-muted-foreground"}`}
              onClick={() => handleVote("not_helpful")}
            >
              <ThumbsDown className={`w-4 h-4 ${voted === "not_helpful" ? "fill-current" : ""}`} />
              <span className="text-xs">{card.not_helpful_count || 0}</span>
            </Button>

            <span className="text-xs text-muted-foreground ml-2">{card.view_count || 0} 次瀏覽</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 px-2 text-primary hover:text-primary"
            onClick={() => onView?.(card.id)}
          >
            查看詳情
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
