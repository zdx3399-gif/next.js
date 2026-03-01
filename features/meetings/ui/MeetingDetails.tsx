"use client"

import { useState, useEffect } from "react"
import { getMeetingById, type Meeting } from "../api/meetings"
import { exportMeetingToPDF, exportMeetingPDFViaAPI } from "@/lib/export-pdf"
import { HelpHint } from "@/components/ui/help-hint"

interface MeetingDetailsProps {
  meetingId: string
  onBack: () => void
}

export function MeetingDetails({ meetingId, onBack }: MeetingDetailsProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState("")

  useEffect(() => {
    const loadMeeting = async () => {
      setLoading(true)
      const data = await getMeetingById(meetingId)
      setMeeting(data)
      setLoading(false)
    }
    loadMeeting()
  }, [meetingId])

  if (loading) {
    return (
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="text-center text-red-500 py-8">無法載入會議資料</div>
      </div>
    )
  }

  const handleDownloadPDF = () => {
    if (meeting.pdf_file_url) {
      const link = document.createElement("a")
      link.href = meeting.pdf_file_url
      link.download = `會議記錄_${meeting.topic}_${new Date(meeting.time).toLocaleDateString("zh-TW")}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleQuickExportPDF = async () => {
    if (!meeting) return
    setExporting(true)
    setExportMessage("正在生成 PDF...")
    try {
      const result = await exportMeetingToPDF(meeting)
      setExportMessage(result.message)
      setTimeout(() => setExportMessage(""), 3000)
    } catch (error) {
      console.error("導出失敗:", error)
      setExportMessage("❌ 導出失敗，請重試")
      setTimeout(() => setExportMessage(""), 3000)
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDFViaAPI = async () => {
    if (!meeting) return
    setExporting(true)
    setExportMessage("正在生成 PDF...")
    try {
      const result = await exportMeetingPDFViaAPI(meeting.id)
      setExportMessage(result.message)
      setTimeout(() => setExportMessage(""), 3000)
    } catch (error) {
      console.error("API 導出失敗:", error)
      setExportMessage("❌ 導出失敗，請重試")
      setTimeout(() => setExportMessage(""), 3000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-[var(--theme-accent-light)] transition-colors">
          <span className="material-icons text-[var(--theme-accent)]">arrow_back</span>
        </button>
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
          <span className="material-icons">event</span>
          會議詳情
          <HelpHint
            title="住戶端會議詳情"
            description="此頁可查看會議時間地點、重點摘要、備註與完整記錄檔案。"
            workflow={[
              "先確認會議主題、時間與地點。",
              "再閱讀重點摘要與備註掌握決議內容。",
              "需要留存時下載或匯出 PDF。",
            ]}
            logic={[
              "詳情頁整合會議核心資訊，便於一次查閱。",
              "附件與匯出功能用於後續保存與分享。",
            ]}
          />
        </h2>
      </div>

      {/* Meeting Info */}
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold text-[var(--theme-text-primary)] mb-3">{meeting.topic}</h3>
          <div className="flex flex-col gap-2 text-[var(--theme-text-muted)]">
            <div className="flex items-center gap-2">
              <span className="material-icons text-sm">schedule</span>
              <span>{new Date(meeting.time).toLocaleString("zh-TW")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons text-sm">location_on</span>
              <span>{meeting.location}</span>
            </div>
          </div>
        </div>

        {/* Key Takeaways Section */}
        {meeting.key_takeaways && meeting.key_takeaways.length > 0 && (
          <div className="border-t border-[var(--theme-border)] pt-4">
            <h4 className="text-lg font-semibold text-[var(--theme-accent)] mb-3 flex items-center gap-2">
              <span className="material-icons">fact_check</span>
              重點摘要
              <HelpHint
                title="住戶端重點摘要內容"
                description="列出會議決議重點，方便快速掌握結論。"
                workflow={[
                  "先看摘要條目數與排序。",
                  "逐項閱讀決議重點，確認與自身相關事項。",
                  "有疑問時再對照完整會議記錄。",
                ]}
                logic={[
                  "摘要為精簡版內容，完整細節仍以會議記錄為準。",
                ]}
                align="center"
              />
            </h4>
            <ul className="space-y-2">
              {meeting.key_takeaways.map((item, index) => (
                <li key={index} className="flex gap-3 text-[var(--theme-text-primary)]">
                  <span className="text-[var(--theme-accent)] font-bold">{index + 1}.</span>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Additional Notes */}
        {meeting.notes && (
          <div className="border-t border-[var(--theme-border)] pt-4">
            <h4 className="text-lg font-semibold text-[var(--theme-accent)] mb-2">備註</h4>
            <p className="text-[var(--theme-text-primary)] whitespace-pre-wrap">{meeting.notes}</p>
          </div>
        )}

        {/* PDF Download Section */}
        {meeting.pdf_file_url && (
          <div className="border-t border-[var(--theme-border)] pt-4">
            <h4 className="text-lg font-semibold text-[var(--theme-accent)] mb-3 flex items-center gap-2">
              <span className="material-icons">description</span>
              完整會議記錄
              <HelpHint
                title="住戶端完整記錄"
                description="若有附檔，可下載完整會議記錄 PDF 供留存。"
                workflow={[
                  "確認此會議是否有附 PDF。",
                  "點下載按鈕取得完整會議記錄。",
                  "下載後檢查檔名與日期是否正確。",
                ]}
                logic={[
                  "下載內容通常包含完整紀錄或簽章版文件，適合正式留存。",
                ]}
                align="center"
              />
            </h4>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all font-semibold"
            >
              <span className="material-icons">download</span>
              下載完整會議記錄 (含簽章).PDF
            </button>
          </div>
        )}

        {/* Quick Export PDF Section */}
        <div className="border-t border-[var(--theme-border)] pt-4">
          <h4 className="text-lg font-semibold text-[var(--theme-accent)] mb-3 flex items-center gap-2">
            <span className="material-icons">save_as</span>
            匯出為 PDF
            <HelpHint
              title="住戶端匯出 PDF"
              description="提供快速導出與服務器導出兩種方式，方便保存或分享會議資料。"
              workflow={[
                "優先使用快速導出產生 PDF。",
                "若快速導出失敗，再改用服務器導出。",
                "完成後確認訊息並檢查檔案內容。",
              ]}
              logic={[
                "兩種導出方式可互補，提高成功率。",
                "導出失敗時系統會顯示狀態訊息供排查。",
              ]}
              align="center"
            />
          </h4>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleQuickExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-600 text-white hover:opacity-90 transition-all font-semibold disabled:opacity-50"
            >
              <span className="material-icons">{exporting ? "hourglass_empty" : "download"}</span>
              {exporting ? "生成中..." : "快速導出 PDF"}
            </button>
            <button
              onClick={handleExportPDFViaAPI}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white hover:opacity-90 transition-all font-semibold disabled:opacity-50"
            >
              <span className="material-icons">{exporting ? "hourglass_empty" : "cloud_download"}</span>
              {exporting ? "生成中..." : "服務器導出"}
            </button>
            {exportMessage && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm">
                {exportMessage}
              </div>
            )}
          </div>
          <p className="text-sm text-[var(--theme-text-muted)] mt-2">
            💡 支持兩種方式導出：快速導出（瀏覽器生成）或服務器導出（後端生成）
          </p>
        </div>
      </div>
    </div>
  )
}
