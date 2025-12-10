"use client"

// ==================================================================================
// 👇👇👇 PASTE YOUR ADMIN LINKS HERE (請在這裡貼上管理員專用的連結) 👇👇👇
// ==================================================================================

const GOOGLE_FORM_EDIT_LINK = "https://docs.google.com/forms/d/1-RIrL9cKOfX4HY2gLa7m6gF-fVX72uDdtfVhABMUFx8/edit" // 貼上 Google 表單的「編輯」連結
const GOOGLE_SHEET_RESULT_LINK = "https://docs.google.com/spreadsheets/d/1xegZfzU-UyS0Rqfs00Ar-A9hIVc-vpLUhAcrNmhv_-0/edit?usp=sharing" // 貼上 Google 試算表的連結

// ==================================================================================

export function VoteManagementAdmin() {
  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-6 min-h-[500px]">
      <div className="flex justify-between items-center mb-8">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold">
          <span className="material-icons">how_to_vote</span>
          Google 表單投票管理
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Button 1: Edit Form */}
        <a 
          href={GOOGLE_FORM_EDIT_LINK}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed border-[var(--theme-accent)] text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-bg-primary)] transition-all group"
        >
          <div className="p-4 rounded-full bg-[var(--theme-accent)]/10 group-hover:bg-white/20 transition-colors">
            <span className="material-icons text-5xl">edit_note</span>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold mb-1">編輯投票表單</h3>
            <p className="text-sm opacity-80">Edit Google Form</p>
          </div>
        </a>

        {/* Button 2: View Results */}
        <a 
          href={GOOGLE_SHEET_RESULT_LINK}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all group"
        >
          <div className="p-4 rounded-full bg-green-500/10 group-hover:bg-white/20 transition-colors">
            <span className="material-icons text-5xl">table_view</span>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold mb-1">查看投票結果</h3>
            <p className="text-sm opacity-80">View Results (Excel/Sheet)</p>
          </div>
        </a>
      </div>

      <div className="mt-8 p-4 bg-[var(--theme-bg-secondary)] rounded-xl border border-[var(--theme-border)] text-sm text-[var(--theme-text-secondary)]">
        <p className="font-bold mb-2">💡 設定說明：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>這是一個快速連結頁面，直接導向您的 Google 服務。</li>
          <li>若要修改連結，請直接更改程式碼檔案 <code>VoteManagementAdmin.tsx</code> 最上方的變數。</li>
        </ul>
      </div>
    </div>
  )
}