import { getSupabaseClient } from "@/lib/supabase"

export interface KnowledgeCard {
  id: string
  source_type: "community_post" | "announcement" | "meeting" | "manual"
  source_id: string | null
  title: string
  summary: string
  category: string
  situation: string | null
  steps: any
  notes: any
  contact_info: any
  credibility: "official" | "verified" | "community"
  status: "active" | "unverified" | "archived" | "removed"
  version: number
  previous_version_id: string | null
  changelog: string | null
  view_count: number
  helpful_count: number
  not_helpful_count: number
  created_by: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

// 獲取 AI 建議入庫的貼文
export async function getPendingKMSPosts() {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("status", "published")
    .not("structured_data->kms_suggestion", "is", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching pending KMS posts:", error)
    return []
  }

  // 過濾出 AI 建議入庫且尚未入庫的貼文
  const pendingPosts = (data || []).filter((post) => {
    const kmsSuggestion = post.structured_data?.kms_suggestion
    return kmsSuggestion?.suitable === true && !kmsSuggestion?.imported
  })

  return pendingPosts
}

// 將貼文轉換成知識卡
export async function importPostToKMS(
  postId: string,
  userId: string,
  overrides?: {
    title?: string
    summary?: string
    category?: string
  }
) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  // 獲取貼文
  const { data: post, error: postError } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .single()

  if (postError || !post) throw new Error("Post not found")

  const kmsSuggestion = post.structured_data?.kms_suggestion || {}

  // 建立知識卡
  const { data: card, error: cardError } = await supabase
    .from("knowledge_cards")
    .insert([
      {
        source_type: "community_post",
        source_id: postId,
        title: overrides?.title || kmsSuggestion.suggested_title || post.title,
        summary: overrides?.summary || kmsSuggestion.summary || post.content,
        category: overrides?.category || kmsSuggestion.suggested_category || post.category,
        credibility: "community",
        status: "active",
        version: 1,
        created_by: userId,
      },
    ])
    .select()
    .single()

  if (cardError) throw cardError

  // 標記貼文已入庫
  await supabase
    .from("community_posts")
    .update({
      structured_data: {
        ...post.structured_data,
        kms_suggestion: {
          ...kmsSuggestion,
          imported: true,
          imported_at: new Date().toISOString(),
          imported_by: userId,
          card_id: card.id,
        },
      },
    })
    .eq("id", postId)

  return card as KnowledgeCard
}

// 拒絕入庫建議
export async function rejectKMSSuggestion(postId: string, userId: string, reason: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  const { data: post, error: postError } = await supabase
    .from("community_posts")
    .select("structured_data")
    .eq("id", postId)
    .single()

  if (postError || !post) throw new Error("Post not found")

  const kmsSuggestion = post.structured_data?.kms_suggestion || {}

  await supabase
    .from("community_posts")
    .update({
      structured_data: {
        ...post.structured_data,
        kms_suggestion: {
          ...kmsSuggestion,
          rejected: true,
          rejected_at: new Date().toISOString(),
          rejected_by: userId,
          reject_reason: reason,
        },
      },
    })
    .eq("id", postId)
}

export async function getKnowledgeCards(filters?: { category?: string; credibility?: string; search?: string }) {
  const supabase = getSupabaseClient()
  if (!supabase) return []
  
  let query = supabase
    .from("knowledge_cards")
    .select("*")
    .eq("status", "active")
    .order("credibility", { ascending: true })
    .order("helpful_count", { ascending: false })

  if (filters?.category) {
    query = query.eq("category", filters.category)
  }

  if (filters?.credibility) {
    query = query.eq("credibility", filters.credibility)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) throw error
  return (data as KnowledgeCard[]) || []
}

export async function getKnowledgeCardById(cardId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")
  
  const { data, error } = await supabase.from("knowledge_cards").select("*").eq("id", cardId).single()

  if (error) throw error

  // 增加瀏覽次數
  await supabase
    .from("knowledge_cards")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", cardId)

  return data as KnowledgeCard
}

export async function createKnowledgeCard(card: {
  source_type: string
  source_id?: string
  title: string
  summary: string
  category: string
  situation?: string
  steps?: any
  notes?: any
  contact_info?: any
  credibility?: string
  created_by: string
}) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  const { data, error } = await supabase
    .from("knowledge_cards")
    .insert([
      {
        ...card,
        status: "active",
        version: 1,
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as KnowledgeCard
}

export async function updateKnowledgeCard(
  cardId: string,
  updates: {
    title?: string
    summary?: string
    category?: string
    situation?: string
    steps?: any
    notes?: any
    contact_info?: any
    changelog: string
  },
  userId: string,
) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  // 獲取舊版本
  const { data: oldCard } = await supabase.from("knowledge_cards").select("*").eq("id", cardId).single()

  if (!oldCard) throw new Error("Knowledge card not found")

  // 建立新版本
  const { data: newCard, error } = await supabase
    .from("knowledge_cards")
    .insert([
      {
        ...oldCard,
        ...updates,
        id: undefined,
        version: oldCard.version + 1,
        previous_version_id: cardId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single()

  if (error) throw error

  // 將舊版本標記為 archived
  await supabase.from("knowledge_cards").update({ status: "archived" }).eq("id", cardId)

  return newCard as KnowledgeCard
}

export async function deleteKnowledgeCard(cardId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  const { error } = await supabase.from("knowledge_cards").update({ status: "removed" }).eq("id", cardId)

  if (error) throw error
}

export async function verifyKnowledgeCard(cardId: string, verifiedBy: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  const { data, error } = await supabase
    .from("knowledge_cards")
    .update({
      credibility: "verified",
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select()
    .single()

  if (error) throw error
  return data as KnowledgeCard
}

export async function markAsOfficial(cardId: string, verifiedBy: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  const { data, error } = await supabase
    .from("knowledge_cards")
    .update({
      credibility: "official",
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select()
    .single()

  if (error) throw error
  return data as KnowledgeCard
}

export async function getCardVersionHistory(cardId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  // 找出所有版本
  const versions: KnowledgeCard[] = []
  let currentId: string | null = cardId

  while (currentId) {
    const { data }: { data: KnowledgeCard | null; error: any } = await supabase
      .from("knowledge_cards")
      .select("*")
      .eq("id", currentId)
      .single()

    if (data) {
      versions.push(data)
      currentId = data.previous_version_id
    } else {
      currentId = null
    }
  }

  return versions.reverse()
}

export async function voteKnowledgeCard(cardId: string, userId: string, voteType: "helpful" | "not_helpful") {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client not available")

  // 檢查是否已經投票過
  const { data: existing } = await supabase
    .from("user_interactions")
    .select("id, interaction_type")
    .eq("user_id", userId)
    .eq("target_type", "knowledge_card")
    .eq("target_id", cardId)
    .in("interaction_type", ["helpful", "not_helpful"])
    .single()

  if (existing) {
    // 如果已經投票且類型相同，則取消投票
    if (existing.interaction_type === voteType) {
      await supabase.from("user_interactions").delete().eq("id", existing.id)

      // 更新計數
      const column = voteType === "helpful" ? "helpful_count" : "not_helpful_count"
      await supabase.rpc(`decrement_card_${voteType}_count`, { card_id: cardId })

      return false
    } else {
      // 如果投票類型不同，則更新
      await supabase.from("user_interactions").update({ interaction_type: voteType }).eq("id", existing.id)

      // 更新計數
      const oldColumn = existing.interaction_type === "helpful" ? "helpful_count" : "not_helpful_count"
      const newColumn = voteType === "helpful" ? "helpful_count" : "not_helpful_count"
      await supabase.rpc(`decrement_card_${existing.interaction_type}_count`, { card_id: cardId })
      await supabase.rpc(`increment_card_${voteType}_count`, { card_id: cardId })

      return true
    }
  } else {
    // 新增投票
    await supabase.from("user_interactions").insert([
      {
        user_id: userId,
        target_type: "knowledge_card",
        target_id: cardId,
        interaction_type: voteType,
      },
    ])

    // 更新計數
    await supabase.rpc(`increment_card_${voteType}_count`, { card_id: cardId })

    return true
  }
}
