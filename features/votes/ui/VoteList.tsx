"use client"

import { useEffect, useMemo, useState } from "react"
import { fetchVotes, submitVote, type Vote } from "@/features/votes/api/votes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { HelpHint } from "@/components/ui/help-hint"

interface VoteListProps {
  userId?: string
  userName?: string
}

export function VoteList({ userId, userName }: VoteListProps) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [votedVoteIds, setVotedVoteIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submittingVoteId, setSubmittingVoteId] = useState<string | null>(null)

  const loadVotes = async () => {
    setLoading(true)
    const result = await fetchVotes({ scope: "all", userId, withResults: true })
    setVotes(result.votes)
    setVotedVoteIds(result.votedVoteIds)
    setLoading(false)
  }

  useEffect(() => {
    loadVotes()
  }, [userId])

  const sortedVotes = useMemo(() => {
    const now = Date.now()
    return [...votes].sort((a, b) => {
      const aEnded = a.status === "closed" || (a.ends_at ? new Date(a.ends_at).getTime() <= now : false)
      const bEnded = b.status === "closed" || (b.ends_at ? new Date(b.ends_at).getTime() <= now : false)

      if (aEnded !== bEnded) {
        return aEnded ? 1 : -1
      }

      return new Date(a.ends_at || 0).getTime() - new Date(b.ends_at || 0).getTime()
    })
  }, [votes])

  const onSubmitInternalVote = async (vote: Vote, option: string) => {
    if (!userId) {
      alert("請先登入後再投票")
      return
    }

    setSubmittingVoteId(vote.id)
    const result = await submitVote({
      vote_id: vote.id,
      user_id: userId,
      user_name: userName || "住戶",
      option_selected: option,
    })
    setSubmittingVoteId(null)

    if (!result.success) {
      alert(result.error || "投票失敗")
      return
    }

    alert("投票成功")
    setVotedVoteIds((prev) => new Set([...prev, vote.id]))
  }

  return (
    <div className="space-y-6 bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] p-6">
      <div className="text-center space-y-3 px-4">
        <div className="inline-flex p-4 rounded-full bg-[var(--theme-accent)]/10 mb-2">
          <span className="material-icons text-4xl text-[var(--theme-accent)]">how_to_vote</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-2xl font-bold text-[var(--theme-text-primary)]">社區投票活動</h2>
          <HelpHint
            title="住戶端投票功能"
            description="這裡提供住戶參與社區投票或問卷。點『前往投票』會開啟外部表單，請在截止前完成填寫，逾時可能無法送出。"
            workflow={[
              "先閱讀投票活動說明與注意事項。",
              "若為內部投票，請直接點選本頁選項完成投票；若為外部投票，點「前往外部投票」開啟表單填答。",
              "送出後返回本頁確認是否還有其他活動，並查看是否顯示已完成。",
            ]}
            logic={[
              "本頁會顯示目前進行中的有效投票。",
              "外部連結與內部投票會依活動類型顯示不同按鈕。",
              "內部投票送出後，同一帳號於同一活動不可重複投票。",
            ]}
            align="center"
          />
        </div>
        <p className="text-[var(--theme-text-secondary)] max-w-md mx-auto">
          系統會自動顯示尚未截止的投票活動，請於期限前完成投票。
        </p>
      </div>

      {loading ? (
        <div className="text-center text-[var(--theme-text-secondary)] py-10">載入投票中...</div>
      ) : sortedVotes.length === 0 ? (
        <div className="text-center text-[var(--theme-text-secondary)] py-10">目前沒有進行中的投票</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedVotes.map((vote) => {
            const alreadyVoted = votedVoteIds.has(vote.id)
            const isEnded = vote.status === "closed" || (vote.ends_at ? new Date(vote.ends_at).getTime() <= Date.now() : false)
            const totalVotes = vote.total_votes || 0
            const internalResults =
              vote.mode === "internal"
                ? vote.options
                    .map((option) => ({
                      option,
                      count: vote.results?.[option] || 0,
                      percent: totalVotes > 0 ? Math.round(((vote.results?.[option] || 0) / totalVotes) * 100) : 0,
                    }))
                    .sort((a, b) => b.count - a.count)
                : []

            return (
              <Card key={vote.id} className="border-[var(--theme-border)]">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg text-[var(--theme-text-primary)]">{vote.title}</CardTitle>
                    <Badge variant="outline">{vote.mode === "external" ? "外部連結" : "系統內投票"}</Badge>
                  </div>
                  <div className="text-sm text-[var(--theme-text-secondary)]">
                    截止時間：{vote.ends_at ? new Date(vote.ends_at).toLocaleString() : "未設定"}
                  </div>
                  <div className="text-xs text-[var(--theme-text-secondary)]">
                    狀態：{isEnded ? "已截止" : "進行中"}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-[var(--theme-text-secondary)] whitespace-pre-wrap">{vote.description || "無說明"}</p>

                  {isEnded ? (
                    vote.mode === "external" ? (
                      vote.result_file_url ? (
                        <a href={vote.result_file_url} target="_blank" rel="noreferrer">
                          <Button className="w-full" variant="outline">
                            查看投票結果
                          </Button>
                        </a>
                      ) : (
                        <div className="text-sm text-[var(--theme-text-secondary)]">已截止，結果檔尚未公布</div>
                      )
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm text-[var(--theme-text-secondary)]">總票數：{totalVotes}</div>
                        <div className="space-y-1">
                          {internalResults.length === 0 ? (
                            <div className="text-sm text-[var(--theme-text-secondary)]">無統計資料</div>
                          ) : (
                            internalResults.map((item) => (
                              <div key={item.option} className="text-sm text-[var(--theme-text-secondary)]">
                                {item.option}：{item.count} 票（{item.percent}%）
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  ) : alreadyVoted ? (
                    <div className="text-sm text-emerald-600 font-semibold">您已完成此投票</div>
                  ) : vote.mode === "external" ? (
                    <a href={vote.external_url} target="_blank" rel="noreferrer">
                      <Button className="w-full">前往外部投票</Button>
                    </a>
                  ) : (
                    <div className="space-y-2">
                      {vote.options.map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className="w-full justify-start"
                          disabled={submittingVoteId === vote.id}
                          onClick={() => onSubmitInternalVote(vote, option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-[var(--theme-text-muted)]">
        <span>投票提醒</span>
        <HelpHint
          title="住戶端投票提醒"
          description="投票前建議先完整閱讀題目說明。每位住戶是否可重複填答，依該次表單設定為準。"
          workflow={[
            "進入表單前先確認投票主題與截止時間。",
            "填答時依題目說明逐項完成。",
            "送出前再次檢查選項是否正確。",
          ]}
          logic={[
            "系統內投票每位住戶每個活動只能投一次。",
          ]}
          align="center"
        />
      </div>
    </div>
  )
}