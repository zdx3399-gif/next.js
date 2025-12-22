"use client"

import { useState } from "react"
import { useMeetings } from "../hooks/useMeetings"
import { MeetingDetails } from "./MeetingDetails"

export function MeetingList() {
  const { meetings, loading, error } = useMeetings()
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredMeetings = meetings.filter((meeting) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      meeting.topic.toLowerCase().includes(term) ||
      meeting.location?.toLowerCase().includes(term) ||
      false ||
      new Date(meeting.time).toLocaleDateString("zh-TW").includes(term)
    )
  })

  if (selectedMeetingId) {
    return <MeetingDetails meetingId={selectedMeetingId} onBack={() => setSelectedMeetingId(null)} />
  }

  if (loading) {
    return (
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="text-center text-red-500 p-8">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
        <span className="material-icons">event</span>
        會議/活動
      </h2>

      <div className="mb-4">
        <input
          type="text"
          placeholder="搜尋會議主題、地點或日期..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-xl theme-input outline-none"
        />
      </div>

      <div className="space-y-3">
        {filteredMeetings.length > 0 ? (
          filteredMeetings.map((meeting) => (
            <button
              key={meeting.id}
              onClick={() => setSelectedMeetingId(meeting.id!)}
              className="w-full bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-accent-light)] border border-[var(--theme-border)] p-4 rounded-xl transition-all text-left cursor-pointer"
            >
              <h3 className="text-lg font-bold text-[var(--theme-text-primary)] mb-2">{meeting.topic}</h3>
              <div className="flex flex-col gap-1 text-sm">
                <p className="text-[var(--theme-text-secondary)] flex items-center gap-2">
                  <span className="material-icons text-sm">place</span>
                  地點: {meeting.location}
                </p>
                <p className="text-[var(--theme-text-secondary)] flex items-center gap-2">
                  <span className="material-icons text-sm">schedule</span>
                  日期: {new Date(meeting.time).toLocaleString("zh-TW")}
                </p>
                {meeting.key_takeaways && meeting.key_takeaways.length > 0 && (
                  <p className="text-[var(--theme-accent)] flex items-center gap-2 mt-1">
                    <span className="material-icons text-sm">list</span>
                    {meeting.key_takeaways.length} 項重點摘要
                  </p>
                )}
                {meeting.pdf_file_url && (
                  <p className="text-green-500 flex items-center gap-2 mt-1">
                    <span className="material-icons text-sm">description</span>
                    附有完整會議記錄
                  </p>
                )}
              </div>
            </button>
          ))
        ) : (
          <div className="text-center text-[var(--theme-text-muted)] py-8">
            {searchTerm ? "沒有符合條件的會議/活動" : "目前沒有會議/活動"}
          </div>
        )}
      </div>
    </div>
  )
}
