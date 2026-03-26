"use client"

import { useState } from "react"
import { useVisitors } from "../hooks/useVisitors"
import { VisitorReservationForm } from "./VisitorReservationForm"
import { VisitorCard } from "./VisitorCard"
import { HelpHint } from "@/components/ui/help-hint"
import type { VisitorReservation } from "../api/visitors"

interface VisitorListProps {
  userRoom?: string | null
  currentUser?: any
}

export function VisitorList({ userRoom, currentUser }: VisitorListProps) {
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null)

  const {
    reservedVisitors,
    checkedInVisitors,
    historyVisitors,
    loading,
    handleReservation,
    handleUpdateReservation,
    handleDeleteReservation,
  } = useVisitors({
    userRoom,
    currentUser,
    isAdmin: false,
  })

  const editingVisitor = reservedVisitors.find((v) => v.id === editingVisitorId)

  const handleSubmitReservation = async (reservation: VisitorReservation) => {
    if (editingVisitorId) {
      const success = await handleUpdateReservation({ id: editingVisitorId, ...reservation })
      if (success) {
        setEditingVisitorId(null)
        setShowReservationForm(false)
      }
      return success
    }

    return handleReservation(reservation)
  }

  const handleEdit = (visitorId: string) => {
    setEditingVisitorId(visitorId)
    setShowReservationForm(true)
  }

  const handleDelete = async (visitorId: string) => {
    if (!confirm("確定要刪除此預約訪客嗎？")) return
    await handleDeleteReservation(visitorId)
  }

  const filterVisitors = (visitors: any[]) => {
    if (!searchTerm) return visitors
    const term = searchTerm.toLowerCase()
    return visitors.filter(
      (visitor) =>
        visitor.name?.toLowerCase().includes(term) ||
        visitor.phone?.toLowerCase().includes(term) ||
        visitor.purpose?.toLowerCase().includes(term),
    )
  }

  const filteredReserved = filterVisitors(reservedVisitors)
  const filteredCheckedIn = filterVisitors(checkedInVisitors)
  const filteredHistory = filterVisitors(historyVisitors)

  if (loading) {
    return <div className="text-center text-[var(--theme-text-muted)] py-8">載入中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 預約按鈕 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-[var(--theme-text-primary)] text-sm font-medium">住戶訪客功能</span>
          <HelpHint
            title="住戶端訪客功能"
            description="可在此預約訪客、查詢目前訪客狀態與歷史紀錄。建議在訪客到達前先完成預約。"
            workflow={[
              "先點預約訪客填寫來訪資料。",
              "送出後可在預約訪客區確認是否建立成功。",
              "訪客到場與離場後可在對應區塊追蹤狀態變化。",
            ]}
            logic={[
              "住戶端可建立與查閱資料；簽到/簽退由管理端執行。",
            ]}
          />
        </div>
        <button
          onClick={() => {
            if (showReservationForm) {
              setEditingVisitorId(null)
            }
            setShowReservationForm(!showReservationForm)
          }}
          className="px-4 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-lg font-bold hover:opacity-90 transition-all"
        >
          {showReservationForm ? "取消" : "預約訪客"}
        </button>
      </div>

      {/* 搜尋輸入 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[var(--theme-text-primary)] text-sm">搜尋</span>
          <HelpHint
            title="住戶端訪客搜尋"
            description="可用訪客姓名、電話或來訪事由篩選資料，快速找出指定訪客紀錄。"
            workflow={[
              "輸入姓名、電話或事由關鍵字。",
              "在三個區塊中查看過濾後結果。",
              "清空搜尋可恢復完整列表。",
            ]}
            logic={[
              "搜尋僅做前端篩選，不改變原始資料。",
            ]}
          />
        </div>
        <input
          type="text"
          placeholder="搜尋訪客姓名、電話或事由..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-xl theme-input outline-none"
        />
      </div>

      {/* 預約表單 */}
      {showReservationForm && (
        <VisitorReservationForm
          onSubmit={handleSubmitReservation}
          onCancel={() => {
            setShowReservationForm(false)
            setEditingVisitorId(null)
          }}
          initialData={
            editingVisitor
              ? {
                  name: editingVisitor.name,
                  phone: editingVisitor.phone || "",
                  purpose: editingVisitor.purpose || "",
                  reservation_time: editingVisitor.reservation_time ? new Date(editingVisitor.reservation_time).toISOString().slice(0, 16) : "",
                }
              : undefined
          }
          submitLabel={editingVisitor ? "儲存變更" : "確認預約"}
          title={editingVisitor ? "編輯預約訪客" : "預約訪客"}
        />
      )}

      {/* 預約訪客 */}
      <div className="bg-[var(--theme-bg-secondary)] border-2 border-blue-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-blue-500 font-bold text-lg mb-4">
          <span className="material-icons">event</span>
          預約訪客 ({filteredReserved.length})
          <HelpHint
            title="住戶端預約訪客"
            description="此區顯示你已預約但尚未簽到的訪客，方便確認預約是否成功。"
            workflow={[
              "建立預約後先在此區確認訪客資料。",
              "若訪客到場，等待管理端執行簽到。",
              "若資訊有誤，重新建立正確預約。",
            ]}
            logic={[
              "此區僅顯示 reserved 狀態訪客。",
            ]}
          />
        </h3>
        <div className="space-y-3">
          {filteredReserved.length > 0 ? (
            filteredReserved.map((visitor) => (
              <VisitorCard
                key={visitor.id}
                visitor={visitor}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-6">
              {searchTerm ? "沒有符合條件的預約訪客" : "目前沒有預約訪客"}
            </div>
          )}
        </div>
      </div>

      {/* 訪客中 */}
      <div className="bg-[var(--theme-bg-secondary)] border-2 border-yellow-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-yellow-500 font-bold text-lg mb-4">
          <span className="material-icons">how_to_reg</span>
          訪客中 ({filteredCheckedIn.length})
          <HelpHint
            title="住戶端訪客中"
            description="顯示目前已進入社區的訪客，可即時掌握訪客是否已到達。"
            workflow={[
              "查看訪客是否已簽到進入社區。",
              "若訪客已離場但仍顯示在此，通知管理端協助簽退。",
              "必要時以搜尋快速定位特定訪客。",
            ]}
            logic={[
              "此區顯示 checked_in 狀態，代表訪客尚在場。",
            ]}
          />
        </h3>
        <div className="space-y-3">
          {filteredCheckedIn.length > 0 ? (
            filteredCheckedIn.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-6">
              {searchTerm ? "沒有符合條件的訪客" : "目前沒有訪客"}
            </div>
          )}
        </div>
      </div>

      {/* 訪客歷史 */}
      <div className="bg-[var(--theme-bg-secondary)] border-2 border-green-500/30 rounded-xl p-5">
        <h3 className="flex gap-2 items-center text-green-500 font-bold text-lg mb-4">
          <span className="material-icons">history</span>
          訪客歷史 ({filteredHistory.length})
          <HelpHint
            title="住戶端訪客歷史"
            description="保留已完成訪客記錄，可回查過往來訪時間與目的。"
            workflow={[
              "在此區回查過往訪客紀錄。",
              "搭配搜尋快速定位特定來訪者。",
              "需要證明時可依時間與目的提供資訊。",
            ]}
            logic={[
              "歷史區顯示 checked_out 狀態資料，為已完成流程紀錄。",
            ]}
          />
        </h3>
        <div className="space-y-3">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
          ) : (
            <div className="text-center text-[var(--theme-text-muted)] py-6">
              {searchTerm ? "沒有符合條件的訪客歷史" : "目前沒有訪客歷史"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
