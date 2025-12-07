"use client"

import { useState } from "react"
import { usePackages } from "../hooks/usePackages"
import type { Package } from "../api/packages"

interface PackageListProps {
  userRoom?: string | null
  currentUser?: { unit_id?: string } | null
}

export function PackageList({ userRoom, currentUser }: PackageListProps) {
  const { pendingPackages, pickedUpPackages, loading } = usePackages({
    userRoom: userRoom || undefined,
    isAdmin: false,
    userUnitId: currentUser?.unit_id,
  })
  const [searchTerm, setSearchTerm] = useState("")

  const filterPackages = (pkgs: Package[]) => {
    if (!searchTerm) return pkgs
    const term = searchTerm.toLowerCase()
    return pkgs.filter(
      (pkg) =>
        pkg.courier.toLowerCase().includes(term) ||
        (pkg.recipient_name || "").toLowerCase().includes(term) ||
        pkg.tracking_number?.toLowerCase().includes(term),
    )
  }

  const filteredPending = filterPackages(pendingPackages)
  const filteredPickedUp = filterPackages(pickedUpPackages)

  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="搜尋快遞商、收件人或追蹤號碼..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="theme-input w-full px-4 py-3 rounded-lg"
      />

      {loading ? (
        <div className="text-center text-[var(--theme-text-muted)] py-8">載入中...</div>
      ) : (
        <>
          <div className="bg-[var(--theme-bg-secondary)] border-2 border-yellow-500/30 rounded-xl p-5">
            <h3 className="flex gap-2 items-center text-yellow-500 font-bold text-lg mb-4">
              <span className="material-icons">schedule</span>
              待領取 ({filteredPending.length})
            </h3>
            <div className="space-y-3">
              {filteredPending.length > 0 ? (
                filteredPending.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-[var(--theme-text-primary)] font-bold text-lg">{pkg.courier}</div>
                        <div className="text-[var(--theme-text-muted)] text-sm mt-1">收件人: {pkg.recipient_name}</div>
                        <div className="text-[var(--theme-text-muted)] text-sm">房號: {pkg.recipient_room}</div>
                        {pkg.tracking_number && (
                          <div className="text-[var(--theme-text-muted)] text-sm">
                            追蹤號:{" "}
                            <code className="bg-[var(--theme-bg-primary)] px-2 py-1 rounded">
                              {pkg.tracking_number}
                            </code>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-yellow-500/20 text-yellow-500">
                        待領取
                      </div>
                    </div>
                    <div className="text-[var(--theme-text-muted)] text-sm">
                      到達: {new Date(pkg.arrived_at).toLocaleString("zh-TW")}
                    </div>
                    <div className="mt-3 text-[var(--theme-accent)] text-sm">
                      <span className="material-icons text-sm align-middle mr-1">info</span>
                      請至警衛室領取包裹
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[var(--theme-text-muted)] py-6">
                  {searchTerm ? "沒有符合條件的待領取包裹" : "沒有待領取的包裹"}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[var(--theme-bg-secondary)] border-2 border-green-500/30 rounded-xl p-5">
            <h3 className="flex gap-2 items-center text-green-500 font-bold text-lg mb-4">
              <span className="material-icons">check_circle</span>
              已領取 ({filteredPickedUp.length})
            </h3>
            <div className="space-y-3">
              {filteredPickedUp.length > 0 ? (
                filteredPickedUp.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border)] rounded-lg p-4 hover:bg-[var(--theme-accent-light)] transition-all opacity-75"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-[var(--theme-text-primary)] font-bold text-lg">{pkg.courier}</div>
                        <div className="text-[var(--theme-text-muted)] text-sm mt-1">收件人: {pkg.recipient_name}</div>
                        <div className="text-[var(--theme-text-muted)] text-sm">房號: {pkg.recipient_room}</div>
                        {pkg.tracking_number && (
                          <div className="text-[var(--theme-text-muted)] text-sm">
                            追蹤號:{" "}
                            <code className="bg-[var(--theme-bg-primary)] px-2 py-1 rounded">
                              {pkg.tracking_number}
                            </code>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 bg-green-500/20 text-green-500">
                        已領取
                      </div>
                    </div>
                    <div className="text-[var(--theme-text-muted)] text-sm space-y-1">
                      <div>到達: {new Date(pkg.arrived_at).toLocaleString("zh-TW")}</div>
                      {pkg.picked_up_by && <div className="text-green-500 font-bold">領取人: {pkg.picked_up_by}</div>}
                      {pkg.picked_up_at && (
                        <div className="text-green-500">
                          領取時間: {new Date(pkg.picked_up_at).toLocaleString("zh-TW")}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[var(--theme-text-muted)] py-6">
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
