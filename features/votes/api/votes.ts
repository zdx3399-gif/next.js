export interface Vote {
  id: string
  title: string
  description: string
  options: string[]
  mode: "internal" | "external"
  external_url?: string
  result_file_url?: string
  result_file_name?: string
  created_by?: string
  author?: string
  status: "active" | "closed"
  ends_at: string | null
  created_at?: string
  results?: Record<string, number>
  total_votes?: number
}

export interface VoteRecord {
  id?: string
  vote_id: string
  user_id: string
  user_name?: string
  option_selected: string
  voted_at?: string
}

interface FetchVotesOptions {
  scope?: "all" | "active"
  userId?: string
  withResults?: boolean
}

function getCurrentOperator() {
  if (typeof window === "undefined") return { id: "", role: "unknown", name: "" }

  try {
    const raw = localStorage.getItem("currentUser")
    if (!raw) return { id: "", role: "unknown", name: "" }
    const parsed = JSON.parse(raw)
    return {
      id: parsed?.id || "",
      role: parsed?.role || "unknown",
      name: parsed?.name || "",
    }
  } catch {
    return { id: "", role: "unknown", name: "" }
  }
}

function buildVoteQuery(options?: FetchVotesOptions) {
  const params = new URLSearchParams()
  if (options?.scope) params.set("scope", options.scope)
  if (options?.userId) params.set("userId", options.userId)
  if (options?.withResults) params.set("withResults", "1")
  const query = params.toString()
  return query ? `/api/votes?${query}` : "/api/votes"
}

export async function fetchVotes(options?: FetchVotesOptions): Promise<{ votes: Vote[]; votedVoteIds: Set<string> }> {
  try {
    const res = await fetch(buildVoteQuery(options), { cache: "no-store" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || "讀取投票失敗")
    }

    const payload = await res.json()
    const votes: Vote[] = Array.isArray(payload.votes) ? payload.votes : []
    const votedVoteIds = new Set<string>(Array.isArray(payload.votedVoteIds) ? payload.votedVoteIds : [])
    return { votes, votedVoteIds }
  } catch (error) {
    console.error("Error fetching votes:", error)
    return { votes: [], votedVoteIds: new Set<string>() }
  }
}

export async function fetchUserVotedPolls(userId: string): Promise<Set<string>> {
  const { votedVoteIds } = await fetchVotes({ userId })
  return votedVoteIds
}

export async function submitVote(voteRecord: VoteRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const operator = getCurrentOperator()
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        vote_id: voteRecord.vote_id,
        user_id: voteRecord.user_id,
        user_name: voteRecord.user_name || "住戶",
        option_selected: voteRecord.option_selected,
        operatorId: operator.id || voteRecord.user_id,
        operatorRole: operator.id ? operator.role : "resident",
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || "投票失敗" }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "投票失敗" }
  }
}

export async function createVote(vote: {
  title: string
  description: string
  ends_at: string
  mode: "internal" | "external"
  external_url?: string
  options?: string[]
  author?: string
  created_by?: string
}): Promise<Vote | null> {
  try {
    const operator = getCurrentOperator()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15 秒超時
    let res: Response
    try {
      res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...vote,
          operatorId: operator.id || vote.created_by || null,
          operatorRole: operator.role,
          operatorName: operator.name || vote.author || "管委會",
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.details ? `${data.error || "建立投票失敗"}: ${data.details}` : data.error || "建立投票失敗")
    }

    return data.vote || null
  } catch (error) {
    console.error("Error creating vote:", error)
    return null
  }
}

export async function closeVote(voteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const operator = getCurrentOperator()
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close",
        vote_id: voteId,
        operatorId: operator.id || null,
        operatorRole: operator.role,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || "關閉投票失敗" }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "關閉投票失敗" }
  }
}

export async function updateVoteEndTime(params: {
  vote_id: string
  ends_at: string
}): Promise<{ success: boolean; vote?: Vote; error?: string }> {
  try {
    const operator = getCurrentOperator()
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_vote",
        ...params,
        operatorId: operator.id || null,
        operatorRole: operator.role,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || "修改截止時間失敗" }
    }

    return { success: true, vote: data.vote }
  } catch (error: any) {
    return { success: false, error: error?.message || "修改截止時間失敗" }
  }
}

export async function deleteVoteById(voteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const operator = getCurrentOperator()
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_vote",
        vote_id: voteId,
        operatorId: operator.id || null,
        operatorRole: operator.role,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || "刪除投票失敗" }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "刪除投票失敗" }
  }
}

export async function uploadVoteResultFile(
  file: File,
  folder = "votes/results"
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", folder)

    const res = await fetch("/api/upload-file", {
      method: "POST",
      body: formData,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || "上傳檔案失敗" }
    }

    return { success: true, url: data.url }
  } catch (error: any) {
    return { success: false, error: error?.message || "上傳檔案失敗" }
  }
}

export async function attachExternalResultFile(params: {
  vote_id: string
  result_file_url: string
  result_file_name?: string
}): Promise<{ success: boolean; vote?: Vote; error?: string }> {
  try {
    const operator = getCurrentOperator()
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "attach_external_result",
        ...params,
        operatorId: operator.id || null,
        operatorRole: operator.role,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: data.error || "更新外部結果檔失敗" }
    }

    return { success: true, vote: data.vote }
  } catch (error: any) {
    return { success: false, error: error?.message || "更新外部結果檔失敗" }
  }
}

export function getAuthorName(vote: Vote): string {
  return vote.author || "管理員"
}
