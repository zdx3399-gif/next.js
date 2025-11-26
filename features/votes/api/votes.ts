import { getSupabaseClient } from "@/lib/supabase"

export interface Vote {
  id: string
  title: string
  description: string
  options: string | string[]
  author: string
  status: "active" | "closed"
  ends_at: string | null
  created_at?: string
}

export interface VoteRecord {
  id?: string
  vote_id: string
  user_id: string
  user_name: string
  option_selected: string
}

export async function fetchVotes(): Promise<Vote[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("votes").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching votes:", error)
    return []
  }

  return data || []
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
  const { error } = await supabase.from("vote_records").insert([voteRecord])

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "您已經投過票了" }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function createVote(vote: Omit<Vote, "id" | "created_at">): Promise<Vote | null> {
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
  const { data, error } = await supabase.from("votes").update(vote).eq("id", id).select().single()

  if (error) {
    console.error("Error updating vote:", error)
    return null
  }

  return data
}

export async function deleteVote(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("votes").delete().eq("id", id)

  if (error) {
    console.error("Error deleting vote:", error)
    return false
  }

  return true
}
