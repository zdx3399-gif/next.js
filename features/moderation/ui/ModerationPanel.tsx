"use client"

import { useState } from "react"
import { ModerationQueue } from "./ModerationQueue"
import { ModerationDetail } from "./ModerationDetail"
import type { User } from "@/features/profile/api/profile"
import { HelpHint } from "@/components/ui/help-hint"

interface ModerationPanelProps {
  currentUser: User
}

export function ModerationPanel({ currentUser }: ModerationPanelProps) {
  const [view, setView] = useState<"queue" | "detail">("queue")
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId)
    setView("detail")
  }

  const handleBack = () => {
    setView("queue")
    setSelectedItemId(null)
  }

  const handleResolved = () => {
    setView("queue")
    setSelectedItemId(null)
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[var(--theme-text-primary)] text-sm font-medium">管理端內容審核</span>
        <HelpHint
          title="管理端審核中心"
          description="可先在佇列挑選案件，再進入詳情進行處置與留存理由。"
          workflow={[
            "先在佇列篩選待處理案件並點選目標。",
            "進入詳情頁閱讀內容與檢舉資訊後做處置。",
            "完成送出後會回到佇列，繼續下一筆案件。",
          ]}
          logic={[
            "審核流程分為佇列挑件與詳情決策兩段，降低誤判。",
            "每次處置都需留存原因，供稽核與申訴追溯。",
          ]}
        />
      </div>
      {view === "queue" ? (
        <ModerationQueue currentUser={currentUser} onSelectItem={handleSelectItem} />
      ) : (
        selectedItemId && (
          <ModerationDetail
            itemId={selectedItemId}
            currentUser={currentUser}
            onBack={handleBack}
            onResolved={handleResolved}
          />
        )
      )}
    </div>
  )
}
