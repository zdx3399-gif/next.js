"use client"

import { useVisitors } from "../hooks/useVisitors"
import { VisitorCard } from "./VisitorCard"
import type { Visitor } from "../api/visitors"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Search } from "lucide-react"

interface VisitorManagementAdminProps {
  currentUser?: any
  isPreviewMode?: boolean
}

// 預覽模式的模擬資料
const PREVIEW_VISITORS: { reserved: Visitor[]; checkedIn: Visitor[]; history: Visitor[] } = {
  reserved: [
    { id: "preview-1", name: "測試資料", room: "測試資料", phone: "測試資料", reservation_time: new Date().toISOString(), status: "reserved" as const, created_at: new Date().toISOString() },
    { id: "preview-2", name: "測試資料", room: "測試資料", phone: "測試資料", reservation_time: new Date().toISOString(), status: "reserved" as const, created_at: new Date().toISOString() },
  ],
  checkedIn: [
    { id: "preview-3", name: "測試資料", room: "測試資料", phone: "測試資料", reservation_time: new Date().toISOString(), status: "checked_in" as const, checked_in_at: new Date().toISOString(), created_at: new Date().toISOString() },
  ],
  history: [
    { id: "preview-4", name: "測試資料", room: "測試資料", phone: "測試資料", reservation_time: new Date(Date.now() - 86400000).toISOString(), status: "checked_out" as const, checked_out_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400000).toISOString() },
  ],
}

export function VisitorManagementAdmin({ currentUser, isPreviewMode = false }: VisitorManagementAdminProps) {
  const {
    reservedVisitors: realReserved,
    checkedInVisitors: realCheckedIn,
    historyVisitors: realHistory,
    loading,
    searchTerm,
    setSearchTerm,
    handleCheckIn,
    handleCheckOut,
    reload,
  } = useVisitors({ currentUser, isAdmin: true })

  // 預覽模式使用模擬資料
  const reservedVisitors = isPreviewMode ? PREVIEW_VISITORS.reserved : realReserved
  const checkedInVisitors = isPreviewMode ? PREVIEW_VISITORS.checkedIn : realCheckedIn
  const historyVisitors = isPreviewMode ? PREVIEW_VISITORS.history : realHistory

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]"></div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex gap-2 items-center text-[var(--theme-accent)] text-xl">
          <span className="material-icons">how_to_reg</span>
          訪客管理 (警衛)
          <HelpHint
            title="管理端訪客管理"
            description="管理端可查詢預約、執行訪客簽到/簽退，並保留訪客歷史，支援門禁與服務台作業。"
            workflow={[
              "先以搜尋定位訪客，再查看所在區塊（預約/訪客中/歷史）。",
              "訪客到達時在預約區執行簽到，狀態會移到訪客中。",
              "訪客離開時在訪客中執行簽退，流程完成後進入歷史。",
            ]}
            logic={[
              "訪客流程為 reserved → checked_in → checked_out，依序推進。",
              "歷史區保留完整紀錄，供事後查詢與稽核。",
            ]}
          />
        </h2>
        <Button variant="outline" onClick={reload} disabled={loading || isPreviewMode}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重新整理
        </Button>
      </div>

      {/* 搜尋欄 */}
      <div className="mb-4 max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[var(--theme-text-primary)] text-sm">搜尋</span>
          <HelpHint
            title="管理端訪客搜尋"
            description="可用姓名、房號或電話快速篩選，協助警衛在尖峰時段快速核對。"
            workflow={[
              "輸入姓名、房號或電話任一關鍵字。",
              "確認列表縮小後選擇目標訪客進行操作。",
              "查無結果時清空關鍵字回到完整列表。",
            ]}
            logic={[
              "搜尋只影響畫面顯示，不會修改訪客資料。",
            ]}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
          <Input
            placeholder="搜尋訪客姓名、房號或電話..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* 預約訪客 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-blue-500/30 rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-blue-500 font-bold text-lg mb-4">
            <span className="material-icons">event</span>
            預約訪客 ({reservedVisitors.length})
            <HelpHint
              title="管理端預約訪客"
              description="顯示尚未簽到的預約資料。可在核對身份後執行簽到。"
              workflow={[
                "先核對訪客姓名、房號與預約時間。",
                "確認身分無誤後點訪客簽到。",
                "簽到後到訪客中區塊確認狀態已更新。",
              ]}
              logic={[
                "此區僅顯示 reserved 狀態資料。",
              ]}
            />
          </h3>
          <div className="space-y-3">
            {reservedVisitors.length > 0 ? (
              reservedVisitors.map((visitor) => (
                <VisitorCard key={visitor.id} visitor={visitor} isAdmin={true} onCheckIn={handleCheckIn} />
              ))
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的預約訪客" : "目前沒有預約訪客"}
              </div>
            )}
          </div>
        </div>

        {/* 訪客中 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-yellow-500/30 rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-yellow-500 font-bold text-lg mb-4">
            <span className="material-icons">how_to_reg</span>
            訪客中 ({checkedInVisitors.length})
            <HelpHint
              title="管理端訪客中"
              description="顯示已進入社區但尚未簽退訪客，離開時請執行簽退完成流程。"
              workflow={[
                "查看目前在場訪客清單。",
                "訪客離開時立即點訪客簽退。",
                "簽退後到歷史區確認紀錄已建立。",
              ]}
              logic={[
                "此區僅顯示 checked_in 狀態，代表尚未完成流程。",
              ]}
            />
          </h3>
          <div className="space-y-3">
            {checkedInVisitors.length > 0 ? (
              checkedInVisitors.map((visitor) => (
                <VisitorCard key={visitor.id} visitor={visitor} isAdmin={true} onCheckOut={handleCheckOut} />
              ))
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的訪客" : "目前沒有訪客"}
              </div>
            )}
          </div>
        </div>

        {/* 訪客歷史 */}
        <div className="bg-[var(--theme-accent-light)] border-2 border-green-500/30 rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-green-500 font-bold text-lg mb-4">
            <span className="material-icons">history</span>
            訪客歷史 ({historyVisitors.length})
            <HelpHint
              title="管理端訪客歷史"
              description="保留完整訪客進出紀錄，便於事後查詢、客服回覆與安全稽核。"
              workflow={[
                "使用搜尋找出指定日期或訪客紀錄。",
                "核對簽到/簽退時間與來訪資訊。",
                "必要時提供作業回覆或安全查核依據。",
              ]}
              logic={[
                "歷史區主要為查閱用途，不提供流程操作按鈕。",
              ]}
            />
          </h3>
          <div className="space-y-3">
            {historyVisitors.length > 0 ? (
              historyVisitors.map((visitor) => <VisitorCard key={visitor.id} visitor={visitor} />)
            ) : (
              <div className="text-center text-[var(--theme-text-secondary)] py-6">
                {searchTerm ? "沒有符合條件的訪客歷史" : "目前沒有訪客歷史"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
