"use client"

// ==================================================================================
// 👇👇👇 PASTE YOUR PUBLIC FORM LINK HERE (請在這裡貼上給住戶投票的連結) 👇👇👇
// ==================================================================================

const PUBLIC_VOTE_LINK = "https://forms.gle/eAnYYKxtKVBRaMmF8" 

// ==================================================================================

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
        <h2 className="text-2xl font-bold text-[var(--theme-text-primary)]">社區投票活動</h2>
        <p className="text-[var(--theme-text-secondary)] max-w-md mx-auto">
          為了確保投票的公正與便利，我們使用 Google 表單進行投票。請點擊下方按鈕前往。
        </p>
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
    </div>
  )
}