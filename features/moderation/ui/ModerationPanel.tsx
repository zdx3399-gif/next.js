"use client"

import { useState } from "react"
import { ModerationQueue } from "./ModerationQueue"
import { ModerationDetail } from "./ModerationDetail"
import type { User } from "@/features/profile/api/profile"

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
