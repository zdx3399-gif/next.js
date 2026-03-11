"use client"

import type { Visitor } from "../api/visitors"
import { HelpHint } from "@/components/ui/help-hint"

interface VisitorCardProps {
  visitor: Visitor
  isAdmin?: boolean
  onCheckIn?: (id: string) => void
  onCheckOut?: (id: string) => void
}

export function VisitorCard({ visitor, isAdmin, onCheckIn, onCheckOut }: VisitorCardProps) {
  const statusConfig: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
    reserved: {
      label: "已預約",
      bgColor: "bg-blue-500/20",
      textColor: "text-blue-500",
      borderColor: "border-blue-500/30",
    },
    checked_in: {
      label: "訪客中",
      bgColor: "bg-yellow-500/20",
      textColor: "text-yellow-500",
      borderColor: "border-yellow-500/30",
    },
    checked_out: {
      label: "已離開",
      bgColor: "bg-green-500/20",
      textColor: "text-green-500",
      borderColor: "border-green-500/30",
    },
  }

  const config = statusConfig[visitor.status] || statusConfig.checked_out

  return (
    <div
      className={`bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all ${
        visitor.status === "checked_out" ? "opacity-75" : ""
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="text-[var(--theme-text-primary)] font-bold text-lg">{visitor.name}</div>
          <div className="text-[var(--theme-text-muted)] text-sm mt-1">拜訪房號: {visitor.room}</div>
          {visitor.phone && <div className="text-[var(--theme-text-muted)] text-sm">電話: {visitor.phone}</div>}
          {visitor.purpose && <div className="text-[var(--theme-text-muted)] text-sm">來訪目的: {visitor.purpose}</div>}
          {visitor.reserved_by && visitor.status === "reserved" && (
            <div className="text-[var(--theme-text-muted)] text-sm">預約人: {visitor.reserved_by}</div>
          )}
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 ${config.bgColor} ${config.textColor}`}
        >
          <span className="inline-flex items-center gap-1">{config.label}<HelpHint title="訪客狀態" description="顯示訪客目前流程狀態：預約、訪客中、已離開。" workflow={["先看狀態標籤判斷目前流程階段。","預約狀態可簽到、訪客中可簽退、已離開僅查閱。","搭配時間欄位確認流程是否完整。"]} logic={["狀態是訪客流程控制核心，決定可執行按鈕。","流程順序為預約→訪客中→已離開。"]} align="center" /></span>
        </div>
      </div>

      <div className="flex justify-between items-end gap-2">
        <div className="text-[var(--theme-text-muted)] text-sm space-y-1">
          {visitor.status === "reserved" && visitor.reservation_time && (
            <div>預約時間: {new Date(visitor.reservation_time).toLocaleString("zh-TW")}</div>
          )}
          {visitor.checked_in_at && <div>簽到時間: {new Date(visitor.checked_in_at).toLocaleString("zh-TW")}</div>}
          {visitor.checked_out_at && (
            <div className="text-green-500">簽退時間: {new Date(visitor.checked_out_at).toLocaleString("zh-TW")}</div>
          )}
        </div>

        {isAdmin && visitor.status === "reserved" && onCheckIn && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCheckIn(visitor.id)}
              className="px-4 py-2 bg-[#4caf50] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-all"
            >
              訪客簽到
            </button>
            <HelpHint title="管理端簽到" description="訪客到達時點擊簽到，開始訪客中狀態。" workflow={["核對訪客身份與預約資料。","確認到場後點擊訪客簽到。","簽到成功後檢查狀態是否改為訪客中。"]} logic={["簽到會寫入到場時間並切換狀態為 checked_in。"]} align="center" />
          </div>
        )}
        {isAdmin && visitor.status === "checked_in" && onCheckOut && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCheckOut(visitor.id)}
              className="px-4 py-2 bg-[#f44336] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-all"
            >
              訪客簽退
            </button>
            <HelpHint title="管理端簽退" description="訪客離開時點擊簽退，完成一筆訪客流程。" workflow={["確認訪客實際離場。","點擊訪客簽退完成流程。","簽退後到歷史區確認紀錄。"]} logic={["簽退會寫入離場時間並切換狀態為 checked_out。"]} align="center" />
          </div>
        )}
      </div>
    </div>
  )
}
