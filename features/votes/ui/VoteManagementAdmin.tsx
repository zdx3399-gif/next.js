"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { User } from "@/features/profile/api/profile"
import { getSupabaseClient } from "@/lib/supabase"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Search } from "lucide-react"

// ==================================================================================
// 🔧 CONFIG: Your Static Default Links
// ==================================================================================
// Link 1: 編輯既有的預設表單 (保留)
const GOOGLE_FORM_EDIT_LINK = "https://drive.google.com/drive/folders/1ORmuy3ZpoY-dhTlt-plOHyWKbC91K6of"
// Link 2: 建立全新的表單 (已更新 👇)
const GOOGLE_FORM_CREATE_LINK = "https://docs.google.com/forms/create"

interface VoteManagementAdminProps {
  currentUser?: User | null
  isPreviewMode?: boolean
}

// 預覽模式的模擬資料
const PREVIEW_VOTES = [
  { id: "preview-1", title: "測試資料", description: "測試資料", created_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * 86400000).toISOString(), author: "測試資料", vote_url: "" },
  { id: "preview-2", title: "測試資料", description: "測試資料", created_at: new Date(Date.now() - 7 * 86400000).toISOString(), ends_at: new Date(Date.now() - 1 * 86400000).toISOString(), author: "測試資料", vote_url: "測試資料" },
]

export function VoteManagementAdmin({ currentUser, isPreviewMode = false }: VoteManagementAdminProps) {
  const [loading, setLoading] = useState(false)

  // --- View States ---
  // 'create' = The form to make new votes
  // 'repo'   = The history and static links
  const [currentView, setCurrentView] = useState<"create" | "repo">("create")

  // --- Form States ---
  const [activeTab, setActiveTab] = useState<"link" | "vote">("link")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    endDate: "",
    googleFormUrl: "",
    googleResultUrl: "",
  })

  // --- History State ---
  const [voteHistory, setVoteHistory] = useState<any[]>([])

  const [searchTerm, setSearchTerm] = useState("")

  // --- Fetch History on Load ---
  useEffect(() => {
    if (!isPreviewMode) {
      fetchHistory()
    } else {
      setVoteHistory(PREVIEW_VOTES)
    }
  }, [isPreviewMode])

  const fetchHistory = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setVoteHistory([])
      return
    }
    const { data, error } = await supabase.from("votes").select("*").order("created_at", { ascending: false })

    if (data) setVoteHistory(data)
    if (error) console.error("Error fetching history:", error)
  }

  // --- Handle Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.endDate) {
      alert("請填寫標題與截止日期")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          ends_at: formData.endDate,
          vote_url: activeTab === "link" ? formData.googleFormUrl : "",
          author: currentUser?.name || "管委會",
          options: ["同意", "反對", "棄權"],
          test: false,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "發起失敗")

      alert("✅ 通知已建立並推播至 LINE")
      setFormData({ title: "", description: "", endDate: "", googleFormUrl: "", googleResultUrl: "" })
      fetchHistory() // Refresh history
    } catch (error: any) {
      console.error(error)
      alert(`❌ 錯誤: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredVoteHistory = voteHistory.filter((vote) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      vote.title?.toLowerCase().includes(term) ||
      vote.description?.toLowerCase().includes(term) ||
      vote.author?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* ==================================================================================
          TOP NAVIGATION TABS (SLIDE SWITCHER)
      ================================================================================== */}
      <div className="flex p-1 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-xl w-full max-w-md mx-auto mb-6">
        <button
          onClick={() => setCurrentView("create")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            currentView === "create"
              ? "bg-[var(--theme-accent)] text-white shadow-md"
              : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-secondary)]"
          }`}
        >
          <span className="material-icons text-lg">campaign</span>
          發布中心
        </button>
        <button
          onClick={() => setCurrentView("repo")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            currentView === "repo"
              ? "bg-[var(--theme-accent)] text-white shadow-md"
              : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-secondary)]"
          }`}
        >
          <span className="material-icons text-lg">history_edu</span>
          紀錄與結果
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 -mt-4 mb-2">
        <span className="text-sm text-[var(--theme-text-secondary)]">管理端投票功能說明</span>
        <HelpHint
          title="管理端投票功能"
          description="管理端可建立投票/問卷通知、切換發布模式、查看歷史紀錄與結果入口。建議先在發布中心建立內容，再到紀錄頁追蹤執行情況。"
          workflow={[
            "先在發布中心建立本次投票或問卷內容。",
            "確認模式、截止時間與連結後送出通知。",
            "到紀錄與結果頁追蹤執行狀態與回收情況。",
          ]}
          logic={[
            "本模組分為建立與追蹤兩階段，避免流程混亂。",
            "模式與截止時間會直接影響住戶端填答體驗。",
          ]}
          align="center"
        />
      </div>

      {/* ==================================================================================
          SLIDE 1: CREATE (Broadcasting)
      ================================================================================== */}
      {currentView === "create" && (
        <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] flex justify-between items-center">
            <h2 className="flex gap-2 items-center text-[var(--theme-text-primary)] font-bold text-lg">
              <span className="material-icons text-[var(--theme-accent)]">add_circle</span>
              發起新投票 / 問卷
              <HelpHint
                title="管理端發布中心"
                description="在此建立新投票通知。填寫標題、截止時間與內容後可直接推播，住戶端會看到對應入口。"
                workflow={[
                  "先填標題與截止時間。",
                  "依需求選擇連結模式或投票模式並填內容。",
                  "送出後到紀錄頁確認是否成功建立。",
                ]}
                logic={[
                  "發布中心是新投票唯一入口，欄位完整性會影響住戶端顯示。",
                ]}
              />
            </h2>
            <div className="flex bg-[var(--theme-bg-primary)] p-1 rounded-lg border border-[var(--theme-border)]">
              <button
                onClick={() => setActiveTab("link")}
                className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === "link" ? "bg-blue-500 text-white" : "text-[var(--theme-text-secondary)]"}`}
              >
                連結模式
              </button>
              <button
                onClick={() => setActiveTab("vote")}
                className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === "vote" ? "bg-[var(--theme-accent)] text-white" : "text-[var(--theme-text-secondary)]"}`}
              >
                投票模式
              </button>
            </div>
          </div>

          <div className="px-6 pt-4 flex items-center gap-2">
            <span className="text-sm text-[var(--theme-text-secondary)]">模式切換</span>
            <HelpHint
              title="管理端模式切換"
              description="連結模式：外部 Google Form 填答。投票模式：系統內文案投票流程。請依活動需求選擇。"
              workflow={[
                "先確認本次活動要走外部表單或內建投票。",
                "切換模式後填對應欄位內容。",
                "送出前再次確認模式是否正確。",
              ]}
              logic={[
                "不同模式會改變住戶端跳轉與填答方式。",
                "模式選錯會導致連結或內容不一致。",
              ]}
            />
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-bold text-[var(--theme-text-primary)]">標題</label>
                    <HelpHint
                      title="管理端投票標題"
                      description="住戶最先看到的文字。建議包含主題與目的，例如：『停車規則修訂投票』。"
                      workflow={[
                        "輸入主題與投票目的。",
                        "用住戶能快速理解的句型命名。",
                        "送出前確認與截止時間一致。",
                      ]}
                      logic={[
                        "標題會直接影響住戶是否點開與參與。",
                      ]}
                    />
                  </div>
                  <input
                    type="text"
                    className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
                    placeholder="輸入標題..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-bold text-[var(--theme-text-primary)]">截止時間</label>
                    <HelpHint
                      title="管理端截止時間"
                      description="投票有效期限。到期後住戶通常無法再參與，設定前請先確認公告時程。"
                      workflow={[
                        "先確認公告期間與投票結束時點。",
                        "設定截止時間後檢查時區與日期是否正確。",
                        "發布後若需延長，請重新公告說明。",
                      ]}
                      logic={[
                        "截止時間會控制可否填答，屬高影響欄位。",
                      ]}
                    />
                  </div>
                  <input
                    type="datetime-local"
                    className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              {activeTab === "link" ? (
                <div className="space-y-3 bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="block text-blue-700 dark:text-blue-400 font-bold text-sm flex items-center gap-1">
                        <span className="material-icons text-sm">link</span> Google Form 網址 (給住戶填寫)
                      </label>
                      <HelpHint
                        title="管理端 Google Form 連結"
                        description="貼入住戶要填寫的公開表單網址。送出後住戶端會導向這個連結。"
                        workflow={[
                          "貼上可公開存取的 Google Form 連結。",
                          "發布前先自行開啟測試連結可用性。",
                          "送出後於住戶端驗證跳轉是否正確。",
                        ]}
                        logic={[
                          "連結錯誤會造成住戶無法投票。",
                          "建議使用最終公開版連結，避免中途改版失效。",
                        ]}
                      />
                    </div>
                    <input
                      type="url"
                      className="w-full p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-black/20"
                      placeholder="https://docs.google.com/forms/..."
                      value={formData.googleFormUrl}
                      onChange={(e) => setFormData({ ...formData, googleFormUrl: e.target.value })}
                    />
                  </div>
               {/*    <div>
                    <label className="block text-green-700 dark:text-green-400 font-bold text-sm mb-1 flex items-center gap-1">
                      <span className="material-icons text-sm">table_view</span> Google Sheet 結果連結 (給管理員看)
                    </label>
                    <input
                      type="url"
                      className="w-full p-3 rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-black/20"
                      placeholder="https://docs.google.com/spreadsheets/..."
                      value={formData.googleResultUrl}
                      onChange={(e) => setFormData({ ...formData, googleResultUrl: e.target.value })}
                    />
                  </div> */}
                </div>
              ) : (
                <div className="bg-[var(--theme-accent)]/5 p-5 rounded-xl border border-[var(--theme-accent)]/20">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-[var(--theme-accent)] font-bold text-sm">投票說明</label>
                    <HelpHint
                      title="管理端投票說明"
                      description="填寫投票背景、選項解釋與決策依據，幫助住戶理解後再投票。"
                      workflow={[
                        "先交代背景與決策目的。",
                        "再補充選項差異與注意事項。",
                        "發布前確認說明內容與題目一致。",
                      ]}
                      logic={[
                        "說明越清楚，越能降低無效或誤解填答。",
                      ]}
                    />
                  </div>
                  <textarea
                    className="w-full p-3 rounded-lg border border-[var(--theme-accent)]/20 min-h-[80px] bg-white dark:bg-black/20"
                    placeholder="請輸入說明..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 ${loading ? "bg-gray-400 cursor-not-allowed" : activeTab === "link" ? "bg-blue-600 hover:bg-blue-700" : "bg-[var(--theme-accent)] hover:opacity-90"}`}
              >
                {loading ? (
                  "處理中..."
                ) : (
                  <>
                    <span className="material-icons">send</span>
                    {activeTab === "link" ? "發送問卷連結通知" : "發起投票"}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================================
          SLIDE 2: REPOSITORY (History & Static Links)
      ================================================================================== */}
      {currentView === "repo" && (
        <div className="space-y-6 animate-fade-in">
          {/* STATIC LINKS CARD */}
          <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-6">
            <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold mb-4">
              <span className="material-icons">bookmark</span>
              快速捷徑 (Shortcuts)
              <HelpHint
                title="管理端快速捷徑"
                description="提供常用外部操作：編輯既有表單與建立新表單。可縮短建立投票內容的時間。"
                workflow={[
                  "先判斷要編輯既有表單或建立新表單。",
                  "開啟對應捷徑後完成 Google 表單設定。",
                  "回到發布中心貼上最終連結。",
                ]}
                logic={[
                  "捷徑只負責開啟外部工具，發布仍需在本系統完成。",
                ]}
              />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Button 1: Edit EXISTING (Keep this one) */}
              <a
                href={GOOGLE_FORM_EDIT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-accent)] hover:text-white transition-all group"
              >
                <span className="material-icons text-3xl text-purple-500 group-hover:text-white">edit_document</span>
                <div>
                  <h3 className="font-bold">編輯預設表單</h3>
                  <p className="text-xs opacity-70">Edit Default Form</p>
                </div>
              </a>

              {/* Button 2: CREATE NEW (Updated as requested) */}
              <a
                href={GOOGLE_FORM_CREATE_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] hover:bg-blue-600 hover:text-white transition-all group"
              >
                <span className="material-icons text-3xl text-blue-500 group-hover:text-white">post_add</span>
                <div>
                  <h3 className="font-bold">建立新表單</h3>
                  <p className="text-xs opacity-70">Create New Google Form</p>
                </div>
              </a>
            </div>
          </div>

          {/* HISTORY TABLE CARD */}
          <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-6">
            <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold mb-4">
              <span className="material-icons">history</span>
              歷史紀錄 / 結果庫
              <HelpHint
                title="管理端歷史紀錄"
                description="可查詢過去投票/問卷，並透過連結回到表單或結果頁做後續分析與追蹤。"
                workflow={[
                  "先用搜尋定位目標投票紀錄。",
                  "查看日期、類型與發布者確認正確性。",
                  "必要時點連結回到表單或結果頁分析。",
                ]}
                logic={[
                  "歷史紀錄是追蹤活動成效與稽核依據。",
                ]}
              />
            </h2>

            <div className="mb-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--theme-text-primary)]">搜尋紀錄</span>
                  <HelpHint
                    title="管理端搜尋紀錄"
                    description="輸入標題、說明或發布者可快速定位指定投票紀錄。"
                    workflow={[
                      "輸入標題、說明或發布者關鍵字。",
                      "從結果中選擇要檢查的紀錄。",
                      "查無結果時調整字詞再搜尋。",
                    ]}
                    logic={[
                      "搜尋僅過濾目前列表，不會變更歷史資料。",
                    ]}
                  />
                </div>
                <Button variant="outline" onClick={fetchHistory} disabled={loading || isPreviewMode}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新整理
                </Button>
              </div>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
                <Input
                  placeholder="搜尋標題、說明或發布者..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm text-left">
                <thead className="text-[var(--theme-text-secondary)] uppercase bg-[var(--theme-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg whitespace-nowrap">日期</th>
                    <th className="px-4 py-3 whitespace-nowrap">標題</th>
                    <th className="px-4 py-3 whitespace-nowrap">類型</th>
                    <th className="px-4 py-3 whitespace-nowrap">發布者</th>
                    <th className="px-4 py-3 rounded-r-lg text-right whitespace-nowrap">連結與結果</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoteHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--theme-text-secondary)]">
                        {searchTerm ? "沒有符合條件的歷史紀錄" : "尚無歷史紀錄"}
                      </td>
                    </tr>
                  ) : (
                    filteredVoteHistory.map((vote) => (
                      <tr
                        key={vote.id}
                        className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-bg-secondary)]/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                          {new Date(vote.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--theme-text-primary)]">{vote.title}</td>
                        <td className="px-4 py-3">
                          {vote.vote_url || (vote.description && vote.description.includes("http")) ? (
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                              Google Form
                            </span>
                          ) : (
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                              Line Vote
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--theme-text-secondary)]">{vote.author || "管委會"}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {vote.vote_url || (vote.description && vote.description.match(/https?:\/\/[^\s)]+/)) ? (
                            <>
                              <a
                                href={vote.vote_url || vote.description.match(/https?:\/\/[^\s)]+/)?.[0]}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                開啟表單
                              </a>
                            </>
                          ) : (
                            <span className="text-[var(--theme-text-secondary)]">查看系統統計</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
