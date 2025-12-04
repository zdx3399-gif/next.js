"use client"

import { useMeetings } from "../hooks/useMeetings"

export function MeetingList() {
  const { meetings, loading, error } = useMeetings()

  if (loading) {
    return (
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
        <div className="text-center text-red-500 py-8">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <h2 className="flex gap-2 items-center text-[var(--theme-accent)] mb-5 text-xl">
        <span className="material-icons">event</span>
        會議/活動
      </h2>
      <div className="space-y-3">
        {meetings.length > 0 ? (
          meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-[var(--theme-text-primary)] font-bold text-lg mb-1">{meeting.topic}</div>
                  <div className="text-[var(--theme-text-muted)] text-sm flex items-center gap-1">
                    <span className="material-icons text-sm">schedule</span>
                    {new Date(meeting.time).toLocaleString("zh-TW")}
                  </div>
                  <div className="text-[var(--theme-text-muted)] text-sm flex items-center gap-1 mt-1">
                    <span className="material-icons text-sm">location_on</span>
                    {meeting.location}
                  </div>
                  {meeting.notes && <div className="text-[var(--theme-text-muted)] text-sm mt-2">{meeting.notes}</div>}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-[var(--theme-text-muted)] py-8">目前沒有會議/活動</div>
        )}
      </div>
    </div>
  )
}
