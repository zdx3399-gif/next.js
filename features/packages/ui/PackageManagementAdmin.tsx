"use client"

import { useState, useEffect } from "react"
import { usePackages } from "../hooks/usePackages"
import { fetchResidentsByRoom } from "@/features/residents/api/residents"
import type { Package } from "../api/packages"
import type { Resident } from "@/features/residents/api/residents"

interface PackageManagementAdminProps {
  currentUser?: any
}

const getRelationshipLabel = (relationship?: string): string => {
  const labels: Record<string, string> = {
    owner: "戶主",
    household_member: "住戶成員",
    tenant: "租客",
  }
  return labels[relationship || "household_member"] || "住戶成員"
}

export function PackageManagementAdmin({ currentUser }: PackageManagementAdminProps) {
  const { pendingPackages, pickedUpPackages, loading, handleAddPackage, handleMarkAsPickedUp } = usePackages({
    isAdmin: true,
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPickers, setSelectedPickers] = useState<{ [key: string]: Resident | null }>({})
  const [roomResidents, setRoomResidents] = useState<{ [room: string]: Resident[] }>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPackage, setNewPackage] = useState({
    courier: "",
    recipient_name: "",
    recipient_room: "",
    tracking_number: "",
    arrived_at: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    pendingPackages.forEach((pkg) => {
      loadRoomResidents(pkg.recipient_room)
    })
  }, [pendingPackages])

  const filterPackages = (pkgs: Package[]) => {
    if (!searchTerm) return pkgs
    const term = searchTerm.toLowerCase()
    return pkgs.filter(
      (pkg) =>
        pkg.courier.toLowerCase().includes(term) ||
        pkg.recipient_name.toLowerCase().includes(term) ||
        pkg.tracking_number?.toLowerCase().includes(term),
    )
  }

  const filteredPending = filterPackages(pendingPackages)
  const filteredPickedUp = filterPackages(pickedUpPackages)

  const loadRoomResidents = async (room: string) => {
    if (roomResidents[room]) return // Already cached
    const residents = await fetchResidentsByRoom(room)
    setRoomResidents((prev) => ({
      ...prev,
      [room]: residents,
    }))
  }

  const onMarkAsPickedUp = async (packageId: string) => {
    const selectedResident = selectedPickers[packageId]
    if (!selectedResident || !selectedResident.name) {
      alert("請選擇領取人")
      return
    }

    const success = await handleMarkAsPickedUp(packageId, selectedResident.name)
    if (success) {
      setSelectedPickers((prev) => {
        const newState = { ...prev }
        delete newState[packageId]
        return newState
      })
      alert("包裹已標記為已領取")
    } else {
      alert("標記失敗")
    }
  }

  const onAddPackage = async () => {
    if (!newPackage.courier || !newPackage.recipient_name || !newPackage.recipient_room) {
      alert("請填寫快遞公司、收件人和房號")
      return
    }

    const success = await handleAddPackage(newPackage)
    if (success) {
      alert("包裹新增成功")
      setShowAddForm(false)
      setNewPackage({
        courier: "",
        recipient_name: "",
        recipient_room: "",
        tracking_number: "",
        arrived_at: new Date().toISOString().slice(0, 16),
      })
    } else {
      alert("新增失敗")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg hover:brightness-90 transition-all font-bold"
        >
          <span className="material-icons text-xl">add</span>
          新增包裹
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white/5 border-2 border-[#ffd700] rounded-xl p-5">
          <h3 className="flex gap-2 items-center text-[#ffd700] font-bold text-lg mb-4">
            <span className="material-icons">add_box</span>
            新增包裹
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[#ffd700] text-sm font-bold mb-1 block">快遞公司 *</label>
              <input
                type="text"
                placeholder="例如：UPS、郵局、黑貓"
                value={newPackage.courier}
                onChange={(e) => setNewPackage({ ...newPackage, courier: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white placeholder-white/40 outline-none focus:border-[#ffd700]"
              />
            </div>
            <div>
              <label className="text-[#ffd700] text-sm font-bold mb-1 block">收件人 *</label>
              <input
                type="text"
                placeholder="收件人姓名"
                value={newPackage.recipient_name}
                onChange={(e) => setNewPackage({ ...newPackage, recipient_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white placeholder-white/40 outline-none focus:border-[#ffd700]"
              />
            </div>
            <div>
              <label className="text-[#ffd700] text-sm font-bold mb-1 block">房號 *</label>
              <input
                type="text"
                placeholder="例如：A-102"
                value={newPackage.recipient_room}
                onChange={(e) => setNewPackage({ ...newPackage, recipient_room: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white placeholder-white/40 outline-none focus:border-[#ffd700]"
              />
            </div>
            <div>
              <label className="text-[#ffd700] text-sm font-bold mb-1 block">追蹤號碼</label>
              <input
                type="text"
                placeholder="選填"
                value={newPackage.tracking_number}
                onChange={(e) => setNewPackage({ ...newPackage, tracking_number: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white placeholder-white/40 outline-none focus:border-[#ffd700]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[#ffd700] text-sm font-bold mb-1 block">到達時間</label>
              <input
                type="datetime-local"
                value={newPackage.arrived_at}
                onChange={(e) => setNewPackage({ ...newPackage, arrived_at: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={onAddPackage}
              className="px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90 transition-all"
            >
              確認新增
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewPackage({
                  courier: "",
                  recipient_name: "",
                  recipient_room: "",
                  tracking_number: "",
                  arrived_at: new Date().toISOString().slice(0, 16),
                })
              }}
              className="px-4 py-2 border-2 border-[#ffd700] text-[#ffd700] rounded-lg font-bold hover:bg-[#ffd700] hover:text-[#222] transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="搜尋快遞商、收件人或追蹤號碼..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-4 py-3 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white placeholder-white/50 outline-none focus:border-[#ffd700]"
      />

      {loading ? (
        <div className="text-center text-[#b0b0b0] py-8">載入中...</div>
      ) : (
        <>
          <div className="bg-white/5 border-2 border-yellow-500/30 rounded-xl p-5">
            <h3 className="flex gap-2 items-center text-yellow-400 font-bold text-lg mb-4">
              <span className="material-icons">schedule</span>
              待領取 ({filteredPending.length})
            </h3>
            <div className="space-y-3">
              {filteredPending.length > 0 ? (
                filteredPending.map((pkg) => {
                  const residents = roomResidents[pkg.recipient_room] || []
                  const selectedResident = selectedPickers[pkg.id]

                  return (
                    <div
                      key={pkg.id}
                      className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="text-white font-bold text-lg">{pkg.courier}</div>
                          <div className="text-[#b0b0b0] text-sm mt-1">收件人: {pkg.recipient_name}</div>
                          <div className="text-[#b0b0b0] text-sm">房號: {pkg.recipient_room}</div>
                          {pkg.tracking_number && (
                            <div className="text-[#b0b0b0] text-sm">
                              追蹤號: <code className="bg-black/30 px-2 py-1 rounded">{pkg.tracking_number}</code>
                            </div>
                          )}
                        </div>
                        <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-yellow-500/20 text-yellow-400">
                          待領取
                        </div>
                      </div>
                      <div className="text-[#b0b0b0] text-sm mb-3">
                        到達: {new Date(pkg.arrived_at).toLocaleString("zh-TW")}
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[#ffd700] text-sm font-bold mb-1 block">領取人</label>
                          <select
                            value={selectedResident?.id || ""}
                            onChange={(e) => {
                              const resident = residents.find((r) => r.id === e.target.value)
                              setSelectedPickers((prev) => ({
                                ...prev,
                                [pkg.id]: resident || null,
                              }))
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[rgba(255,215,0,0.3)] text-white outline-none focus:border-[#ffd700] cursor-pointer [&>option]:bg-[#2a2a2a] [&>option]:text-white"
                          >
                            <option value="">-- 選擇領取人 --</option>
                            {residents.map((resident) => (
                              <option key={resident.id} value={resident.id}>
                                {resident.name} ({getRelationshipLabel(resident.relationship)})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => onMarkAsPickedUp(pkg.id)}
                          disabled={!selectedResident}
                          className="px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg text-sm font-bold hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          標記已領
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center text-[#b0b0b0] py-6">
                  {searchTerm ? "沒有符合條件的待領取包裹" : "沒有待領取的包裹"}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/5 border-2 border-green-500/30 rounded-xl p-5">
            <h3 className="flex gap-2 items-center text-green-400 font-bold text-lg mb-4">
              <span className="material-icons">check_circle</span>
              已領取 ({filteredPickedUp.length})
            </h3>
            <div className="space-y-3">
              {filteredPickedUp.length > 0 ? (
                filteredPickedUp.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-white/5 border border-[rgba(255,215,0,0.2)] rounded-lg p-4 hover:bg-white/8 transition-all opacity-75"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-white font-bold text-lg">{pkg.courier}</div>
                        <div className="text-[#b0b0b0] text-sm mt-1">收件人: {pkg.recipient_name}</div>
                        <div className="text-[#b0b0b0] text-sm">房號: {pkg.recipient_room}</div>
                        {pkg.tracking_number && (
                          <div className="text-[#b0b0b0] text-sm">
                            追蹤號: <code className="bg-black/30 px-2 py-1 rounded">{pkg.tracking_number}</code>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-green-500/20 text-green-400">
                        已領取
                      </div>
                    </div>
                    <div className="text-[#b0b0b0] text-sm space-y-1">
                      <div>到達: {new Date(pkg.arrived_at).toLocaleString("zh-TW")}</div>
                      {pkg.picked_up_by && <div className="text-green-400 font-bold">領取人: {pkg.picked_up_by}</div>}
                      {pkg.picked_up_at && (
                        <div className="text-green-400">
                          領取時間: {new Date(pkg.picked_up_at).toLocaleString("zh-TW")}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[#b0b0b0] py-6">
                  {searchTerm ? "沒有符合條件的已領取包裹" : "沒有已領取的包裹"}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
