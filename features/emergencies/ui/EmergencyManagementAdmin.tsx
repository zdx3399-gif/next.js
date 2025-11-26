"use client"

import { useEmergencies } from "../hooks/useEmergencies"

interface EmergencyManagementAdminProps {
  currentUserName?: string
}

const emergencyTypes = [
  { icon: "local_hospital", title: "救護車 119", type: "救護車119", note: "醫療緊急狀況" },
  { icon: "report_problem", title: "報警 110", type: "報警110", note: "治安緊急狀況" },
  { icon: "favorite", title: "AED", type: "AED", note: "需要AED急救設備" },
  { icon: "warning", title: "可疑人員", type: "可疑人員", note: "陌生人員闖入警告" },
]

export function EmergencyManagementAdmin({ currentUserName }: EmergencyManagementAdminProps) {
  const { emergencies, loading, confirmAndTrigger, deleteEmergency } = useEmergencies(true)

  return (
    <div className="space-y-6">
      {/* 緊急事件按鈕區 */}
      <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
        <h3 className="flex gap-2 items-center text-[#f44336] mb-4">
          <span className="material-icons">emergency</span>
          緊急事件
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {emergencyTypes.map((emergency) => (
            <div
              key={emergency.type}
              onClick={() => confirmAndTrigger(emergency.type, emergency.note, currentUserName || "管理員")}
              className="p-3 bg-white/5 border border-[#f44336]/30 rounded-lg cursor-pointer hover:bg-[rgba(244,67,54,0.1)] transition-all text-center"
            >
              <div className="material-icons text-2xl mb-1">{emergency.icon}</div>
              <h3 className="font-bold text-xs">{emergency.title}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* 緊急事件紀錄表格 */}
      <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-5">
        <h3 className="flex gap-2 items-center text-[#ffd700] mb-4">
          <span className="material-icons">history</span>
          緊急事件紀錄
        </h3>

        {loading ? (
          <div className="text-center text-[#b0b0b0] py-8">載入中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="p-3 text-[#ffd700] border-b border-white/5">類別</th>
                  <th className="p-3 text-[#ffd700] border-b border-white/5">時間</th>
                  <th className="p-3 text-[#ffd700] border-b border-white/5">發起人</th>
                  <th className="p-3 text-[#ffd700] border-b border-white/5">備註</th>
                  <th className="p-3 text-[#ffd700] border-b border-white/5">操作</th>
                </tr>
              </thead>
              <tbody>
                {emergencies.length > 0 ? (
                  emergencies.map((row) => (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 border-b border-white/5 text-white">{row.type}</td>
                      <td className="p-3 border-b border-white/5 text-white">
                        {row.time ? new Date(row.time).toLocaleString("zh-TW") : ""}
                      </td>
                      <td className="p-3 border-b border-white/5 text-white">{row.by}</td>
                      <td className="p-3 border-b border-white/5 text-white">{row.note}</td>
                      <td className="p-3 border-b border-white/5">
                        <button
                          onClick={() => row.id && deleteEmergency(row.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <span className="material-icons text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#b0b0b0]">
                      目前沒有緊急事件紀錄
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
