import { useCallback, useEffect, useState } from "react"
import { fetchVotes, type Vote } from "@/features/votes/api/votes"

interface UseVotesOptions {
  scope?: "all" | "active"
  userId?: string
  withResults?: boolean
}

export function useVotes(options?: UseVotesOptions) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [votedVoteIds, setVotedVoteIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await fetchVotes(options)
    setVotes(result.votes)
    setVotedVoteIds(result.votedVoteIds)
    setLoading(false)
  }, [options])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    votes,
    votedVoteIds,
    loading,
    refresh,
  }
}