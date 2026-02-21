"use client"

// ==================================================================================
// 👇👇👇 PASTE YOUR PUBLIC FORM LINK HERE (請在這裡貼上給住戶投票的連結) 👇👇👇
// ==================================================================================

const PUBLIC_VOTE_LINK = "https://forms.gle/eAnYYKxtKVBRaMmF8" 

// ==================================================================================

import { HelpHint } from "@/components/ui/help-hint"

interface VoteListProps {
  userId?: string
  userName?: string
}

export function VoteList({ userId, userName }: VoteListProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8 bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)]">
      
      <div className="text-center space-y-3 px-4">
        <div className="inline-flex p-4 rounded-full bg-[var(--theme-accent)]/10 mb-2">
           <span className="material-icons text-4xl text-[var(--theme-accent)]">how_to_vote</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-2xl font-bold text-[var(--theme-text-primary)]">社區投票活動</h2>
          <HelpHint
            title="住戶端投票功能"
            description="這裡提供住戶參與社區投票或問卷。點『前往投票』會開啟外部表單，請在截止前完成填寫，逾時可能無法送出。"
            align="center"
          />
        </div>
        <p className="text-[var(--theme-text-secondary)] max-w-md mx-auto">
          為了確保投票的公正與便利，我們使用 Google 表單進行投票。請點擊下方按鈕前往。
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[var(--theme-text-primary)] text-sm">投票入口</span>
        <HelpHint
          title="住戶端投票入口"
          description="點此按鈕會另開新視窗進入投票表單。若無法開啟，請確認瀏覽器是否阻擋彈出視窗。"
          align="center"
        />
      </div>
      <a
        href={PUBLIC_VOTE_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group flex items-center gap-4 px-8 py-5 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-2xl font-bold text-xl hover:opacity-90 hover:scale-105 transition-all shadow-xl hover:shadow-[var(--theme-accent)]/30"
      >
        <span>前往投票</span>
        <span className="material-icons group-hover:translate-x-1 transition-transform">arrow_forward</span>
      </a>

      <div className="text-xs text-[var(--theme-text-muted)] text-center px-4">
        <p>點擊後將開啟新視窗 (Google Form)</p>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--theme-text-muted)]">
        <span>投票提醒</span>
        <HelpHint
          title="住戶端投票提醒"
          description="投票前建議先完整閱讀題目說明。每位住戶是否可重複填答，依該次表單設定為準。"
          align="center"
        />
      </div>
    </div>
  )
}