"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import type { User } from "@/features/profile/api/profile"
import { closeVote, createVote, fetchVotes, type Vote } from "@/features/votes/api/votes"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Search } from "lucide-react"

const GOOGLE_FORM_EDIT_LINK = "https://drive.google.com/drive/folders/1ORmuy3ZpoY-dhTlt-plOHyWKbC91K6of"
const GOOGLE_FORM_CREATE_LINK = "https://docs.google.com/forms/create"

interface VoteManagementAdminProps {
  currentUser?: User | null
  isPreviewMode?: boolean
}

const PREVIEW_VOTES: Vote[] = [
  {
    id: "preview-internal",
    title: "電梯保養時段票選",
    description: "請住戶選擇較可接受的保養時段。",
    mode: "internal",
    options: ["週六上午", "週六下午", "週日上午"],
    status: "active",
    ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    author: "測試資料",
    total_votes: 18,
    results: { "週六上午": 6, "週六下午": 9, "週日上午": 3 },
  },
  {
    id: "preview-external",
    title: "公共空間改善問卷",
    description: "請填寫外部問卷，協助規劃年度改善項目。",
    mode: "external",
    external_url: "https://docs.google.com/forms/d/e/example/viewform",
    options: [],
    status: "active",
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    author: "測試資料",
    total_votes: 0,
    results: {},
  },
]

export function VoteManagementAdmin({ currentUser, isPreviewMode = false }: VoteManagementAdminProps) {
  const [loading, setLoading] = useState(false)
  const [currentView, setCurrentView] = useState<"create" | "repo">("create")
  const [activeTab, setActiveTab] = useState<"external" | "internal">("external")

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    endDate: "",
    externalUrl: "",
    optionsText: "同意\n反對\n棄權",
  })

  const [voteHistory, setVoteHistory] = useState<Vote[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [closingVoteId, setClosingVoteId] = useState<string | null>(null)

  const loadHistory = async () => {
    if (isPreviewMode) {
      setVoteHistory(PREVIEW_VOTES)
      return
    }

    setLoading(true)
    const result = await fetchVotes({ scope: "all", withResults: true })
    setVoteHistory(result.votes)
    setLoading(false)
  }

  useEffect(() => {
    loadHistory()
  }, [isPreviewMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.endDate) {
      alert("請填寫標題與截止時間")
      return
    }

    const parsedOptions = formData.optionsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)

    if (activeTab === "external" && !formData.externalUrl.trim()) {
      alert("連結模式必須填寫外部連結")
      return
    }

    if (activeTab === "internal" && parsedOptions.length < 2) {
      alert("內部投票至少需要兩個選項")
      return
    }

    setLoading(true)

    const vote = await createVote({
      title: formData.title.trim(),
      description: formData.description.trim(),
      ends_at: new Date(formData.endDate).toISOString(),
      mode: activeTab,
      external_url: activeTab === "external" ? formData.externalUrl.trim() : undefined,
      options: activeTab === "internal" ? parsedOptions : [],
      author: currentUser?.name || "管委會",
      created_by: currentUser?.id,
    })

    setLoading(false)

    if (!vote) {
      alert("建立投票失敗")
      return
    }

    alert("投票已建立並完成通知")
    setFormData({ title: "", description: "", endDate: "", externalUrl: "", optionsText: "同意\n反對\n棄權" })
    loadHistory()
  }

  const filteredVoteHistory = useMemo(() => {
    if (!searchTerm) return voteHistory
    const term = searchTerm.toLowerCase()
    return voteHistory.filter((vote) => {
      return (
        vote.title?.toLowerCase().includes(term) ||
        vote.description?.toLowerCase().includes(term) ||
        vote.author?.toLowerCase().includes(term)
      )
    })
  }, [searchTerm, voteHistory])

  const handleCloseVote = async (vote: Vote) => {
    if (!confirm(`確定要手動關閉「${vote.title}」嗎？`)) return

    setClosingVoteId(vote.id)
    const result = await closeVote(vote.id)
    setClosingVoteId(null)

    if (!result.success) {
      alert(result.error || "關閉投票失敗")
      return
    }

    alert("投票已手動關閉")
    loadHistory()
  }

  return (
    <div className="space-y-6">
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
          description="管理端可建立內部投票或外部問卷，並在歷史區查看類型、截止狀態與統計。"
          workflow={[
            "在發布中心選擇模式並輸入內容。",
            "建立後切到紀錄與結果追蹤活動狀態。",
            "內部投票可直接查看系統統計結果。",
          ]}
          logic={[
            "所有投票以 votes 資料表為唯一來源。",
            "住戶端只會看到 active 且未截止活動。",
          ]}
          align="center"
        />
      </div>

      {currentView === "create" && (
        <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] flex justify-between items-center">
            <h2 className="flex gap-2 items-center text-[var(--theme-text-primary)] font-bold text-lg">
              <span className="material-icons text-[var(--theme-accent)]">add_circle</span>
              發起新投票 / 問卷
            </h2>
            <div className="flex bg-[var(--theme-bg-primary)] p-1 rounded-lg border border-[var(--theme-border)]">
              <button
                onClick={() => setActiveTab("external")}
                className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${
                  activeTab === "external" ? "bg-blue-500 text-white" : "text-[var(--theme-text-secondary)]"
                }`}
              >
                連結模式
              </button>
              <button
                onClick={() => setActiveTab("internal")}
                className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${
                  activeTab === "internal" ? "bg-[var(--theme-accent)] text-white" : "text-[var(--theme-text-secondary)]"
                }`}
              >
                內部投票
              </button>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--theme-text-primary)] mb-1">標題</label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
                    placeholder="輸入標題..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--theme-text-primary)] mb-1">截止時間</label>
                  <input
                    type="datetime-local"
                    className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--theme-text-primary)] mb-1">說明</label>
                <textarea
                  className="w-full p-3 rounded-lg border border-[var(--theme-border)] min-h-[90px] bg-white dark:bg-black/20"
                  placeholder="請輸入投票說明..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {activeTab === "external" ? (
                <div className="space-y-3 bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div>
                    <label className="block text-blue-700 dark:text-blue-400 font-bold text-sm mb-1">外部問卷連結</label>
                    <input
                      type="url"
                      className="w-full p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-black/20"
                      placeholder="https://docs.google.com/forms/..."
                      value={formData.externalUrl}
                      onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-[var(--theme-accent)]/5 p-5 rounded-xl border border-[var(--theme-accent)]/20">
                  <label className="block text-[var(--theme-accent)] font-bold text-sm">投票選項（每行一個）</label>
                  <textarea
                    className="w-full p-3 rounded-lg border border-[var(--theme-accent)]/20 min-h-[100px] bg-white dark:bg-black/20"
                    placeholder="同意&#10;反對&#10;棄權"
                    value={formData.optionsText}
                    onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading || isPreviewMode}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 ${
                  loading || isPreviewMode
                    ? "bg-gray-400 cursor-not-allowed"
                    : activeTab === "external"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-[var(--theme-accent)] hover:opacity-90"
                }`}
              >
                {loading ? "處理中..." : activeTab === "external" ? "發送外部問卷通知" : "發起內部投票"}
              </button>
            </form>
          </div>
        </div>
      )}

      {currentView === "repo" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-6">
            <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold mb-4">
              <span className="material-icons">bookmark</span>
              快速捷徑
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-6">
            <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold mb-4">
              <span className="material-icons">history</span>
              歷史紀錄 / 結果庫
            </h2>

            <div className="mb-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--theme-text-primary)]">搜尋紀錄</span>
                </div>
                <Button variant="outline" onClick={loadHistory} disabled={loading || isPreviewMode}>
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
                    <th className="px-4 py-3 whitespace-nowrap">截止狀態</th>
                    <th className="px-4 py-3 whitespace-nowrap">發布者</th>
                    <th className="px-4 py-3 rounded-r-lg text-right whitespace-nowrap">連結與結果</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoteHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--theme-text-secondary)]">
                        {searchTerm ? "沒有符合條件的歷史紀錄" : "尚無歷史紀錄"}
                      </td>
                    </tr>
                  ) : (
                    filteredVoteHistory.map((vote) => {
                      const isExpired = vote.ends_at ? new Date(vote.ends_at).getTime() <= Date.now() : false
                      const isClosed = vote.status === "closed"
                      const resultSummary =
                        vote.mode === "internal"
                          ? vote.options
                              .map((option) => `${option}: ${vote.results?.[option] || 0}`)
                              .join(" / ") || "無統計資料"
                          : "外部連結結果由表單平台查看"

                      return (
                        <tr
                          key={vote.id}
                          className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-bg-secondary)]/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                            {vote.created_at ? new Date(vote.created_at).toLocaleDateString() : "-"}
                          </td>
                          <td className="px-4 py-3 font-medium text-[var(--theme-text-primary)]">{vote.title}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{vote.mode === "external" ? "外部問卷" : "系統內投票"}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={isClosed || isExpired ? "destructive" : "secondary"}>
                              {isClosed || isExpired ? "已截止" : "進行中"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[var(--theme-text-secondary)]">{vote.author || "管委會"}</td>
                          <td className="px-4 py-3 text-right space-y-1">
                            {vote.mode === "external" && vote.external_url ? (
                              <a
                                href={vote.external_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline block"
                              >
                                開啟外部表單
                              </a>
                            ) : (
                              <span className="text-[var(--theme-text-secondary)] block">總票數：{vote.total_votes || 0}</span>
                            )}
                            <span className="text-xs text-[var(--theme-text-secondary)] block">{resultSummary}</span>
                            {!isClosed && (
                              <button
                                onClick={() => handleCloseVote(vote)}
                                disabled={closingVoteId === vote.id || isPreviewMode}
                                className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {closingVoteId === vote.id ? "關閉中..." : "手動關閉投票"}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
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
