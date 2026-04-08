import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

export interface HandoverKnowledgeCard {
  id: string
  title: string
  summary: string
  category: string
  status: "active" | "unverified" | "archived" | "removed"
  created_at: string
  updated_at: string
  view_count: number
  helpful_count: number
  not_helpful_count: number
}

export const HANDOVER_SCENARIO = "handover_sop"

function getCurrentOperator() {
  if (typeof window === "undefined") return { id: "", role: "unknown" }

  try {
    const raw = localStorage.getItem("currentUser")
    if (!raw) return { id: "", role: "unknown" }
    const parsed = JSON.parse(raw)
    return { id: parsed?.id || "", role: parsed?.role || "unknown" }
  } catch {
    return { id: "", role: "unknown" }
  }
}

export async function getHandoverCards(filters?: { category?: string; status?: string; search?: string }) {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  let query = supabase
    .from("knowledge_cards")
    .select("id, title, summary, category, status, created_at, updated_at, view_count, helpful_count, not_helpful_count")
    .eq("situation", HANDOVER_SCENARIO)
    .order("created_at", { ascending: false })

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category)
  }

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data as HandoverKnowledgeCard[]) || [])
}

export async function createHandoverCard(input: {
  title: string
  summary: string
  category: string
  createdBy: string
}) {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) throw new Error("Supabase client not available")

  const { data, error } = await supabase
    .from("knowledge_cards")
    .insert([
      {
        source_type: "manual",
        title: input.title,
        summary: input.summary,
        category: input.category,
        situation: HANDOVER_SCENARIO,
        credibility: "official",
        status: "active",
        version: 1,
        created_by: input.createdBy,
      },
    ])
    .select("id")
    .single()

  if (error) throw error
  if (operator.id && data?.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "create_knowledge_card",
      targetType: "knowledge_card",
      targetId: data.id,
      reason: input.title,
      afterState: { category: input.category, scenario: HANDOVER_SCENARIO },
      additionalData: { module: "handover", status: "success" },
    })
  }
  return data
}

export async function updateHandoverCard(
  cardId: string,
  input: {
    title: string
    summary: string
    category: string
  },
) {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) throw new Error("Supabase client not available")

  const { error } = await supabase
    .from("knowledge_cards")
    .update({
      title: input.title,
      summary: input.summary,
      category: input.category,
    })
    .eq("id", cardId)
    .eq("situation", HANDOVER_SCENARIO)

  if (error) throw error
  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "update_knowledge_card",
      targetType: "knowledge_card",
      targetId: cardId,
      reason: input.title,
      afterState: { title: input.title, category: input.category },
      additionalData: { module: "handover", status: "success" },
    })
  }
}

export async function deleteHandoverCard(cardId: string) {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) throw new Error("Supabase client not available")

  const { error } = await supabase
    .from("knowledge_cards")
    .delete()
    .eq("id", cardId)
    .eq("situation", HANDOVER_SCENARIO)

  if (error) throw error
  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_knowledge_card",
      targetType: "knowledge_card",
      targetId: cardId,
      reason: "刪除交屋卡片",
      additionalData: { module: "handover", status: "success" },
    })
  }
}
