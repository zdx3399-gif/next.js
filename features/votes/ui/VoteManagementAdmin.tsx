"use client"

import { useState, useEffect } from "react"
import type { User } from "@/features/profile/api/profile"
import { getSupabaseClient } from "@/lib/supabase"

// ==================================================================================
// 🔧 CONFIG: Your Static Default Links
// ==================================================================================
// Link 1: 編輯既有的預設表單
const GOOGLE_FORM_EDIT_LINK = "https://drive.google.com/drive/folders/1ORmuy3ZpoY-dhTlt-plOHyWKbC91K6of"
// Link 2: 建立全新的表單
const GOOGLE_FORM_CREATE_LINK = "https://docs.google.com/forms/create"

interface VoteManagementAdminProps {
  currentUser?: User | null
}

export function VoteManagementAdmin({ currentUser }: VoteManagementAdminProps) {
  const [loading, setLoading] = useState(false)
  
  // --- View States ---
  const [currentView, setCurrentView] = useState<'create' | 'repo'>('create')
  
  // --- Form States ---
  const [activeTab, setActiveTab] = useState<'link' | 'vote'>('link') 
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    endDate: "",
    googleFormUrl: ""
    // googleResultUrl removed as requested
  })

  // --- History State ---
  const [voteHistory, setVoteHistory] = useState<any[]>([])

  // --- Fetch History on Load ---
  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .order('created_at', { ascending: false })
    
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
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          ends_at: formData.endDate,
          form_url: activeTab === 'link' ? formData.googleFormUrl : "",
          author: currentUser?.name || "管委會",
          options: ['同意', '反對', '棄權'],
          test: false 
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '發起失敗')

      alert('✅ 通知已建立並推播至 LINE')
      setFormData({ title: "", description: "", endDate: "", googleFormUrl: "" })
      fetchHistory() // Refresh history

    } catch (error: any) {
      console.error(error)
      alert(`❌ 錯誤: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* ==================================================================================
          TOP NAVIGATION TABS (SLIDE SWITCHER)
      ================================================================================== */}
      <div className="flex p-1 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-xl w-full max-w-md mx-auto mb-6">
        <button
          onClick={() => setCurrentView('create')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            currentView === 'create'
              ? 'bg-[var(--theme-accent)] text-white shadow-md'
              : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-secondary)]'
          }`}
        >
          <span className="material-icons text-lg">campaign</span>
          發布中心
        </button>
        <button
          onClick={() => setCurrentView('repo')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            currentView === 'repo'
              ? 'bg-[var(--theme-accent)] text-white shadow-md'
              : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-secondary)]'
          }`}
        >
          <span className="material-icons text-lg">history_edu</span>
          紀錄與結果
        </button>
      </div>

      {/* ==================================================================================
          SLIDE 1: CREATE (Broadcasting)
      ================================================================================== */}
      {currentView === 'create' && (
        <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] flex justify-between items-center">
            <h2 className="flex gap-2 items-center text-[var(--theme-text-primary)] font-bold text-lg">
              <span className="material-icons text-[var(--theme-accent)]">add_circle</span>
              發起新投票 / 問卷
            </h2>
            <div className="flex bg-[var(--theme-bg-primary)] p-1 rounded-lg border border-[var(--theme-border)]">
              <button onClick={() => setActiveTab('link')} className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'link' ? 'bg-blue-500 text-white' : 'text-[var(--theme-text-secondary)]'}`}>
                連結模式
              </button>
              <button onClick={() => setActiveTab('vote')} className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'vote' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-text-secondary)]'}`}>
                投票模式
              </button>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-1 text-[var(--theme-text-primary)]">標題</label>
                  <input type="text" className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
                    placeholder="輸入標題..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-[var(--theme-text-primary)]">截止時間</label>
                  <input type="datetime-local" className="w-full p-3 rounded-lg theme-input border border-[var(--theme-border)]"
                    value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>

              {activeTab === 'link' ? (
                <div className="space-y-3 bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div>
                    <label className="block text-blue-700 dark:text-blue-400 font-bold text-sm mb-1 flex items-center gap-1">
                      <span className="material-icons text-sm">link</span> Google Form 網址 (給住戶填寫)
                    </label>
                    <input type="url" className="w-full p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-black/20"
                      placeholder="https://docs.google.com/forms/..." 
                      value={formData.googleFormUrl} onChange={e => setFormData({...formData, googleFormUrl: e.target.value})} />
                  </div>
                  {/* Google Excel Link Removed */}
                </div>
              ) : (
                <div className="bg-[var(--theme-accent)]/5 p-5 rounded-xl border border-[var(--theme-accent)]/20">
                  <label className="block text-[var(--theme-accent)] font-bold text-sm mb-1">投票說明</label>
                  <textarea className="w-full p-3 rounded-lg border border-[var(--theme-accent)]/20 min-h-[80px] bg-white dark:bg-black/20"
                    placeholder="請輸入說明..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              )}

              <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 ${loading ? "bg-gray-400 cursor-not-allowed" : activeTab === 'link' ? "bg-blue-600 hover:bg-blue-700" : "bg-[var(--theme-accent)] hover:opacity-90"}`}>
                {loading ? "處理中..." : (
                  <>
                    <span className="material-icons">send</span>
                    {activeTab === 'link' ? "發送問卷連結通知" : "發起投票"}
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
      {currentView === 'repo' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* STATIC LINKS CARD */}
          <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-6">
             <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl font-bold mb-4">
              <span className="material-icons">bookmark</span>
              快速捷徑 (Shortcuts)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Button 1: Edit EXISTING */}
              <a href={GOOGLE_FORM_EDIT_LINK} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-accent)] hover:text-white transition-all group">
                <span className="material-icons text-3xl text-purple-500 group-hover:text-white">edit_document</span>
                <div>
                  <h3 className="font-bold">打開 Google Drive 設定</h3>
                  <p className="text-xs opacity-70">Edit Google Drive Settings</p>
                </div>
              </a>

              {/* Button 2: CREATE NEW */}
              <a href={GOOGLE_FORM_CREATE_LINK} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] hover:bg-blue-600 hover:text-white transition-all group">
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
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[var(--theme-text-secondary)] uppercase bg-[var(--theme-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">日期</th>
                    <th className="px-4 py-3">標題</th>
                    <th className="px-4 py-3">類型</th>
                    <th className="px-4 py-3">發布者</th>
                    <th className="px-4 py-3 rounded-r-lg text-right">連結與結果</th>
                  </tr>
                </thead>
                <tbody>
                  {voteHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--theme-text-secondary)]">尚無歷史紀錄</td>
                    </tr>
                  ) : (
                    voteHistory.map((vote) => (
                      <tr key={vote.id} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-bg-secondary)]/50 transition-colors">
                        <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                          {new Date(vote.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--theme-text-primary)]">
                          {vote.title}
                        </td>
                        <td className="px-4 py-3">
                          {vote.form_url || (vote.description && vote.description.includes('http')) ? (
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">Google Form</span>
                          ) : (
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">Line Vote</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                          {vote.author || '管委會'}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {(vote.form_url || (vote.description && vote.description.match(/https?:\/\/[^\s\)]+/))) ? (
                            <>
                              <a href={vote.form_url || vote.description.match(/https?:\/\/[^\s\)]+/)?.[0]} target="_blank" rel="noreferrer"
                                 className="text-blue-600 hover:underline">
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