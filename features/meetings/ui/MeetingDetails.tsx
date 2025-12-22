"use client"

import { useState, useEffect } from "react"
import { getMeetingById, type Meeting } from "../api/meetings"

interface MeetingDetailsProps {
  meetingId: string
  onBack: () => void
}

export function MeetingDetails({ meetingId, onBack }: MeetingDetailsProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)

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
      </div>
    </div>
  )
}
