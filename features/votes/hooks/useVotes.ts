import { useState, useEffect, useCallback } from "react"
import { fetchVotes, fetchUserVotedPolls, submitVote, Vote } from "../api/votes"

export function useVotes(userId?: string) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadVotes = useCallback(async () => {
    setLoading(true)
    const votesData = await fetchVotes()
    setVotes(votesData)

    if (userId) {
      const voted = await fetchUserVotedPolls(userId)
      setVotedPolls(voted)
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    loadVotes()
  }, [loadVotes])

  const handleVote = async (
    voteId: string,
    optionIndex: number,
    userName: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!userId) {
      return { success: false, error: "請先登入" }
    }

    if (votedPolls.has(voteId)) {
      return { success: false, error: "您已經投過票了" }
    }

    const vote = votes.find((v) => v.id === voteId)
    if (!vote) {
      return { success: false, error: "找不到此投票" }
    }

    const options = Array.isArray(vote.options) ? vote.options : JSON.parse(vote.options || "[]")
    const selectedOption = options[optionIndex]

    const result = await submitVote({
      vote_id: voteId,
      user_id: userId,
      user_name: userName,
      option_selected: selectedOption,
    })

    if (result.success) {
      setVotedPolls((prev) => new Set(prev).add(voteId))
      await loadVotes()
    } else if (result.error === "您已經投過票了") {
      setVotedPolls((prev) => new Set(prev).add(voteId))
    }

    return result
  }

  return {
    votes,
    votedPolls,
    loading,
    reload: loadVotes,
    handleVote,
  }
}
