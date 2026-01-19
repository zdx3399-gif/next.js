"use client"

import { useState, useEffect } from "react"
import {
  getKnowledgeCards,
  getKnowledgeCardById,
  createKnowledgeCard,
  updateKnowledgeCard,
  deleteKnowledgeCard,
  getCardVersionHistory,
  voteKnowledgeCard,
  type KnowledgeCard,
} from "../api/kms"

export function useKnowledgeCards(filters?: { category?: string; credibility?: string; search?: string }) {
  const [cards, setCards] = useState<KnowledgeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCards = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getKnowledgeCards(filters)
      setCards(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCards()
  }, [filters?.category, filters?.credibility, filters?.search])

  const handleCreateCard = async (card: Parameters<typeof createKnowledgeCard>[0]) => {
    try {
      const newCard = await createKnowledgeCard(card)
      setCards((prev) => [newCard, ...prev])
      return newCard
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const handleUpdateCard = async (
    cardId: string,
    updates: Parameters<typeof updateKnowledgeCard>[1],
    userId: string,
  ) => {
    try {
      const updatedCard = await updateKnowledgeCard(cardId, updates, userId)
      setCards((prev) => prev.map((c) => (c.id === cardId ? updatedCard : c)))
      return updatedCard
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    try {
      await deleteKnowledgeCard(cardId)
      setCards((prev) => prev.filter((c) => c.id !== cardId))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return {
    cards,
    loading,
    error,
    refresh: loadCards,
    createCard: handleCreateCard,
    updateCard: handleUpdateCard,
    deleteCard: handleDeleteCard,
  }
}

export function useKnowledgeCardDetail(cardId: string) {
  const [card, setCard] = useState<KnowledgeCard | null>(null)
  const [versions, setVersions] = useState<KnowledgeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCardDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cardData, versionData] = await Promise.all([getKnowledgeCardById(cardId), getCardVersionHistory(cardId)])
      setCard(cardData)
      setVersions(versionData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (cardId) {
      loadCardDetail()
    }
  }, [cardId])

  const handleVote = async (userId: string, voteType: "helpful" | "not_helpful") => {
    try {
      await voteKnowledgeCard(cardId, userId, voteType)
      await loadCardDetail()
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return {
    card,
    versions,
    loading,
    error,
    refresh: loadCardDetail,
    vote: handleVote,
  }
}

export function useVoteCard(userId: string) {
  const [isLoading, setIsLoading] = useState(false)

  const voteCard = async (cardId: string, voteType: "up" | "down") => {
    setIsLoading(true)
    try {
      const mappedVoteType = voteType === "up" ? "helpful" : "not_helpful"
      await voteKnowledgeCard(cardId, userId, mappedVoteType)
    } catch (err: any) {
      throw new Error(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    voteCard,
    isLoading,
  }
}
