"use client"

import { useState } from "react"
import { ModerationQueue } from "./ModerationQueue"
import { ModerationDetail } from "./ModerationDetail"
import { MobileReviewDialog } from "./MobileReviewDialog"
import type { User } from "@/features/profile/api/profile"
import { useIsMobile } from "@/hooks/use-mobile"

interface ModerationPanelProps {
  currentUser: User
}

export function ModerationPanel({ currentUser }: ModerationPanelProps) {
  const isMobile = useIsMobile()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId)
    if (isMobile) setDialogOpen(true)
  }

  const handleResolved = () => {
    setSelectedItemId(null)
    setDialogOpen(false)
  }

  // ── 桌機：左右分欄 ──────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex gap-0 h-[calc(100vh-200px)] min-h-[520px]">
        {/* 左側佇列 */}
        <div className="w-[340px] shrink-0 border-r border-[var(--theme-border)] overflow-y-auto pr-0">
          <div className="px-4 pt-3 pb-2 border-b border-[var(--theme-border)] sticky top-0 bg-[var(--theme-bg-primary)] z-10">
            <span className="text-sm font-semibold text-[var(--theme-text-primary)]">審核佇列</span>
          </div>
          <ModerationQueue
            currentUser={currentUser}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId ?? undefined}
            compact
          />
        </div>

        {/* 右側詳情 */}
        <div className="flex-1 overflow-y-auto pl-0">
          {selectedItemId ? (
            <div className="p-4">
              <ModerationDetail
                key={selectedItemId}
                itemId={selectedItemId}
                currentUser={currentUser}
                onBack={() => setSelectedItemId(null)}
                onResolved={handleResolved}
                inPanel
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--theme-text-secondary)] gap-3">
              <span className="material-icons text-5xl opacity-30">gavel</span>
              <p className="text-sm">請從左側佇列選擇一件案件開始審核</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 手機：佇列 + 強化 Dialog ─────────────────────────────────
  return (
    <div>
      <div className="mb-3 px-1">
        <span className="text-sm font-semibold text-[var(--theme-text-primary)]">審核佇列</span>
      </div>
      <ModerationQueue
        currentUser={currentUser}
        onSelectItem={handleSelectItem}
        selectedItemId={selectedItemId ?? undefined}
      />
      {selectedItemId && (
        <MobileReviewDialog
          open={dialogOpen}
          itemId={selectedItemId}
          currentUser={currentUser}
          onClose={() => { setDialogOpen(false); setSelectedItemId(null) }}
          onResolved={handleResolved}
        />
      )}
    </div>
  )
}
