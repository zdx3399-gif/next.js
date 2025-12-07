import { getSupabaseClient } from "@/lib/supabase"

export interface Vote {
  id: string
  title: string
  description: string
  options: string | string[]
  created_by?: string
  author_name?: string
  status: "active" | "closed"
  ends_at: string | null
  created_at?: string
}

export interface VoteRecord {
  id?: string
  vote_id: string
  user_id: string
  option_selected: string
  voted_at?: string
}

export async function fetchVotes(): Promise<Vote[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("votes")
    .select(`
      *,
      author:profiles!votes_created_by_fkey(name)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching votes:", error)
    // Fallback
    const { data: fallbackData } = await supabase.from("votes").select("*").order("created_at", { ascending: false })
    return fallbackData || []
  }

  return (data || []).map((item: any) => ({
    ...item,
    author_name: item.author?.name || "管理員",
  }))
}

export async function fetchUserVotedPolls(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("vote_records").select("vote_id").eq("user_id", userId)

  if (error) {
    console.error("Error fetching user votes:", error)
    return new Set()
  }

  return new Set(data?.map((v) => v.vote_id) || [])
}

export async function submitVote(voteRecord: VoteRecord): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("vote_records").insert([
    {
      vote_id: voteRecord.vote_id,
      user_id: voteRecord.user_id,
      option_selected: voteRecord.option_selected,
      voted_at: new Date().toISOString(),
    },
  ])

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "您已經投過票了" }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function createVote(vote: Omit<Vote, "id" | "created_at" | "author_name">): Promise<Vote | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("votes").insert([vote]).select().single()

  if (error) {
    console.error("Error creating vote:", error)
    return null
  }

  return data
}

export async function updateVote(id: string, vote: Partial<Vote>): Promise<Vote | null> {
  const supabase = getSupabaseClient()
  const { author_name, ...dbData } = vote as any
  const { data, error } = await supabase.from("votes").update(dbData).eq("id", id).select().single()

  if (error) {
    console.error("Error updating vote:", error)
    return null
  }

  return data
}

export async function deleteVote(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  // 先刪除相關的投票記錄
  await supabase.from("vote_records").delete().eq("vote_id", id)

  const { error } = await supabase.from("votes").delete().eq("id", id)

  if (error) {
    console.error("Error deleting vote:", error)
    return false
  }

  return true
}

export function getAuthorName(vote: Vote): string {
  return vote.author_name || "管理員"
}
