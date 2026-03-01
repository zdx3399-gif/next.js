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
            workflow={[
              "先閱讀投票活動說明與注意事項。",
              "點「前往投票」開啟外部表單填答。",
              "送出後返回本頁確認是否還有其他活動。",
            ]}
            logic={[
              "本頁主要作為入口，實際填答在外部表單完成。",
              "是否可重複填答由該表單設定決定。",
            ]}
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
          workflow={[
            "點擊按鈕後在新分頁開啟表單。",
            "若未開啟，檢查瀏覽器彈出視窗限制。",
            "確認連結正確後再開始填答。",
          ]}
          logic={[
            "入口連結為固定外部網址，需保持最新有效。",
          ]}
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
          workflow={[
            "進入表單前先確認投票主題與截止時間。",
            "填答時依題目說明逐項完成。",
            "送出前再次檢查選項是否正確。",
          ]}
          logic={[
            "重複填答限制與身分驗證規則由外部表單控制。",
          ]}
          align="center"
        />
      </div>
    </div>
  )
}