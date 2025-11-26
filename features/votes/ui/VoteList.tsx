"use client"

import { useVotes } from "../hooks/useVotes"

interface VoteListProps {
  userId?: string
  userName?: string
}

export function VoteList({ userId, userName }: VoteListProps) {
  const { votes, votedPolls, loading, handleVote } = useVotes(userId)

  const onVote = async (voteId: string, optionIndex: number) => {
    const result = await handleVote(voteId, optionIndex, userName || "未知")
    if (result.success) {
      alert("投票成功！")
    } else {
      alert(result.error || "投票失敗")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd700]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {votes.length > 0 ? (
        votes.map((vote) => {
          const optionsArray = Array.isArray(vote.options) ? vote.options : JSON.parse(vote.options || "[]")
          const hasVoted = votedPolls.has(vote.id)

          return (
            <div key={vote.id} className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-white font-bold text-lg mb-2">{vote.title}</h3>
                  <p className="text-[#b0b0b0] mb-3">{vote.description}</p>
                </div>
                <div className="flex gap-2">
                  {hasVoted && (
                    <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold">已投票</div>
                  )}
                  <div className="px-3 py-1 rounded-full bg-[#ffd700] text-[#222] text-sm font-bold">
                    {vote.status === "active" ? "進行中" : "已結束"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mb-3">
                {optionsArray.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => onVote(vote.id, idx)}
                    disabled={vote.status !== "active" || hasVoted}
                    className="px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    投給 {option}
                  </button>
                ))}
              </div>
              {hasVoted && <div className="text-green-400 text-sm mb-2">✓ 您已經投過票了，無法再次投票</div>}
              <div className="text-[#b0b0b0] text-sm">
                截止日期: {vote.ends_at ? new Date(vote.ends_at).toLocaleDateString("zh-TW") : "無期限"}
              </div>
            </div>
          )
        })
      ) : (
        <div className="text-center text-[#b0b0b0] py-8">目前沒有進行中的投票</div>
      )}
    </div>
  )
}
