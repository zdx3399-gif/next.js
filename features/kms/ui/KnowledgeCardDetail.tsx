"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useKnowledgeCardDetail } from "../hooks/useKMS"
import type { User } from "@/features/profile/api/profile"

interface KnowledgeCardDetailProps {
  cardId: string
  currentUser: User | null
  onBack: () => void
  onEdit?: (cardId: string) => void
}

export function KnowledgeCardDetail({ cardId, currentUser, onBack, onEdit }: KnowledgeCardDetailProps) {
  const { card, versions, loading, error, vote } = useKnowledgeCardDetail(cardId)

  const handleVote = async (voteType: "helpful" | "not_helpful") => {
    if (!currentUser) {
      alert("請先登入")
      return
    }
    try {
      await vote(currentUser.id, voteType)
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="material-icons animate-spin text-4xl text-[var(--theme-accent)]">refresh</span>
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="text-center py-12">
        <span className="material-icons text-4xl mb-2 text-red-500">error</span>
        <p className="text-red-500">載入失敗: {error}</p>
        <Button onClick={onBack} className="mt-4">
          返回列表
        </Button>
      </div>
    )
  }

  const credibilityBadges: Record<string, { label: string; className: string }> = {
    official: { label: "官方", className: "bg-blue-600 text-white" },
    verified: { label: "認證", className: "bg-green-600 text-white" },
    community: { label: "社群", className: "bg-gray-500 text-white" },
  }

  const badge = credibilityBadges[card.credibility] || credibilityBadges.community
  const canEdit = currentUser && ["committee", "admin"].includes(currentUser.role)

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <div className="flex gap-2 items-center">
        <Button variant="outline" onClick={onBack} className="flex gap-2 items-center bg-transparent">
          <span className="material-icons">arrow_back</span>
          返回列表
        </Button>
        {canEdit && onEdit && (
          <Button onClick={() => onEdit(card.id)} className="flex gap-2 items-center ml-auto">
            <span className="material-icons">edit</span>
            編輯
          </Button>
        )}
      </div>

      {/* Card Content */}
      <Card className="p-6">
        <div className="flex gap-2 items-center mb-4">
          <Badge className={badge.className}>{badge.label}</Badge>
          {card.version > 1 && <Badge variant="outline">版本 {card.version}</Badge>}
        </div>

        <h1 className="text-2xl font-bold mb-2 text-[var(--theme-text-primary)]">{card.title}</h1>
        <p className="text-lg text-[var(--theme-text-secondary)] mb-6">{card.summary}</p>

        {/* Situation */}
        {card.situation && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2 flex gap-2 items-center text-[var(--theme-text-primary)]">
              <span className="material-icons">info</span>
              適用情境
            </h2>
            <p className="text-[var(--theme-text-secondary)]">{card.situation}</p>
          </div>
        )}

        {/* Steps */}
        {card.steps && Array.isArray(card.steps) && card.steps.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3 flex gap-2 items-center text-[var(--theme-text-primary)]">
              <span className="material-icons">list</span>
              操作步驟
            </h2>
            <ol className="list-decimal list-inside space-y-2">
              {card.steps.map((step: string, index: number) => (
                <li key={index} className="text-[var(--theme-text-secondary)]">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Notes */}
        {card.notes && Array.isArray(card.notes) && card.notes.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3 flex gap-2 items-center text-[var(--theme-text-primary)]">
              <span className="material-icons">warning</span>
              注意事項
            </h2>
            <ul className="list-disc list-inside space-y-2">
              {card.notes.map((note: string, index: number) => (
                <li key={index} className="text-[var(--theme-text-secondary)]">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact Info */}
        {card.contact_info && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3 flex gap-2 items-center text-[var(--theme-text-primary)]">
              <span className="material-icons">contact_phone</span>
              聯絡資訊
            </h2>
            <div className="bg-[var(--theme-accent-light)] rounded-lg p-4">
              <pre className="text-sm text-[var(--theme-text-secondary)] whitespace-pre-wrap">
                {typeof card.contact_info === "string" ? card.contact_info : JSON.stringify(card.contact_info, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Vote */}
        <div className="border-t pt-4">
          <p className="text-sm text-[var(--theme-text-secondary)] mb-3">這個知識卡對您有幫助嗎？</p>
          <div className="flex gap-2">
            <Button onClick={() => handleVote("helpful")} variant="outline" className="flex gap-2 items-center">
              <span className="material-icons text-green-600">thumb_up</span>
              有幫助 ({card.helpful_count})
            </Button>
            <Button onClick={() => handleVote("not_helpful")} variant="outline" className="flex gap-2 items-center">
              <span className="material-icons text-red-600">thumb_down</span>
              沒幫助 ({card.not_helpful_count})
            </Button>
          </div>
        </div>

        {/* Version History */}
        {versions.length > 1 && (
          <div className="border-t pt-4 mt-4">
            <h2 className="font-bold text-lg mb-3 flex gap-2 items-center text-[var(--theme-text-primary)]">
              <span className="material-icons">history</span>
              版本歷史 ({versions.length})
            </h2>
            <div className="space-y-2">
              {versions.map((v, index) => (
                <div key={v.id} className="text-sm">
                  <span className="font-medium">v{v.version}</span>
                  {v.changelog && <span className="text-[var(--theme-text-secondary)]"> - {v.changelog}</span>}
                  <span className="text-xs text-[var(--theme-text-secondary)] ml-2">
                    ({new Date(v.created_at).toLocaleDateString("zh-TW")})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
