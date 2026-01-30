"use client"

import { useState } from "react"
import { CommunityPostList } from "./CommunityPostList"
import { CreatePostDialog } from "./CreatePostDialog"
import { PostDetailView } from "./PostDetailView"
import { ReportDialog } from "./ReportDialog"
import { useCommunityPosts, useReports } from "../hooks/useCommunity"
import type { User } from "@/features/profile/api/profile"

interface CommunityBoardProps {
  currentUser: User | null
}

export function CommunityBoard({ currentUser }: CommunityBoardProps) {
  const [view, setView] = useState<"list" | "detail">("list")
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportTarget, setReportTarget] = useState<{ type: string; id: string } | null>(null)

  const { createPost } = useCommunityPosts()
  const { createReport } = useReports(currentUser?.id || "")

  const handleSelectPost = (postId: string) => {
    setSelectedPostId(postId)
    setView("detail")
  }

  const handleBack = () => {
    setView("list")
    setSelectedPostId(null)
  }

  const handleReport = (targetType: string, targetId: string) => {
    if (!currentUser) {
      alert("請先登入")
      return
    }
    setReportTarget({ type: targetType, id: targetId })
    setShowReportDialog(true)
  }

  return (
    <div>
      {view === "list" ? (
        <CommunityPostList
          currentUser={currentUser}
          onSelectPost={handleSelectPost}
          onCreatePost={() => setShowCreateDialog(true)}
        />
      ) : (
        selectedPostId && (
          <PostDetailView
            postId={selectedPostId}
            currentUser={currentUser}
            onBack={handleBack}
            onReport={handleReport}
          />
        )
      )}

      {/* Create Post Dialog */}
      {currentUser && (
        <CreatePostDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={createPost}
          currentUser={currentUser}
        />
      )}

      {/* Report Dialog */}
      {currentUser && reportTarget && (
        <ReportDialog
          open={showReportDialog}
          onClose={() => {
            setShowReportDialog(false)
            setReportTarget(null)
          }}
          onSubmit={createReport}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          reporterId={currentUser.id}
        />
      )}
    </div>
  )
}
