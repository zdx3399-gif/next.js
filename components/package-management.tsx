"use client"
import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

interface Package {
  id: string
  courier: string
  recipient_name: string
  recipient_room: string
  tracking_number?: string
  arrived_at: string
  picked_up_at?: string
  picked_up_by?: string
  status: "pending" | "picked_up"
}

interface PackageManagementProps {
  userRoom?: string
  currentUser?: any
  isAdmin?: boolean
}

export function PackageManagement({ userRoom, currentUser, isAdmin = false }: PackageManagementProps) {
  const [packages, setPackages] = useState<Package[]>([])
  const [pendingPackages, setPendingPackages] = useState<Package[]>([])
  const [pickedUpPackages, setPickedUpPackages] = useState<Package[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [pickerNames, setPickerNames] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    loadPackages()
  }, [userRoom, currentUser, isAdmin])

  useEffect(() => {
    filterPackages()
  }, [packages, searchTerm])

  const loadPackages = async () => {
    if (!userRoom && !currentUser?.id && !isAdmin) return

    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      let query = supabase.from("packages").select("*")

      if (userRoom && !isAdmin) {
        query = query.eq("recipient_room", userRoom)
      }

      const { data, error } = await query.order("arrived_at", { ascending: false })

      if (error) {
        console.error("[v0] Error loading packages:", error)
        setPackages([])
      } else {
        setPackages(data || [])
      }
    } catch (e) {
      console.error("[v0] Failed to load packages:", e)
      setPackages([])
    } finally {
      setLoading(false)
    }
  }

  const filterPackages = () => {
    let pending = packages.filter((pkg) => pkg.status === "pending")
    let pickedUp = packages.filter((pkg) => pkg.status === "picked_up")

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchesTerm = (pkg: Package) =>
        pkg.courier.toLowerCase().includes(term) ||
        pkg.recipient_name.toLowerCase().includes(term) ||
        pkg.tracking_number?.toLowerCase().includes(term)

      pending = pending.filter(matchesTerm)
      pickedUp = pickedUp.filter(matchesTerm)
    }

    setPendingPackages(pending)
    setPickedUpPackages(pickedUp)
  }

  const markAsPickedUp = async (packageId: string) => {
    try {
      let pickedUpBy = currentUser?.name || "未知"

      if (isAdmin) {
        const pickerName = pickerNames[packageId]?.trim()
        if (!pickerName) {
          alert("請輸入領取人姓名")
          return
        }
        pickedUpBy = pickerName
      }

      const supabase = getSupabaseClient()
      const pickedUpTime = new Date().toISOString()

      const { error } = await supabase
        .from("packages")
        .update({
          status: "picked_up",
          picked_up_at: pickedUpTime,
          picked_up_by: pickedUpBy,
        })
        .eq("id", packageId)

      if (error) throw error

      setPackages(
        packages.map((pkg) =>
          pkg.id === packageId
            ? { ...pkg, status: "picked_up" as const, picked_up_at: pickedUpTime, picked_up_by: pickedUpBy }
            : pkg,
        ),
      )

      setPickerNames((prev) => {
        const newState = { ...prev }
        delete newState[packageId]
        return newState
      })

      alert("包裹已標記為已領取")
    } catch (e: any) {
      console.error("[v0] Error marking package as picked up:", e)
      alert("標記失敗：" + e.message)
    }
  }

  return (
    <div className="space-y-6">
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
              待領取 ({pendingPackages.length})
            </h3>
            <div className="space-y-3">
              {pendingPackages.length > 0 ? (
                pendingPackages.map((pkg) => (
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
                    {isAdmin && (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[#ffd700] text-sm font-bold mb-1 block">領取人姓名</label>
                          <input
                            type="text"
                            placeholder="請輸入領取人姓名"
                            value={pickerNames[pkg.id] || ""}
                            onChange={(e) =>
                              setPickerNames((prev) => ({
                                ...prev,
                                [pkg.id]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-[rgba(255,215,0,0.3)] text-white placeholder-white/40 outline-none focus:border-[#ffd700]"
                          />
                        </div>
                        <button
                          onClick={() => markAsPickedUp(pkg.id)}
                          disabled={!pickerNames[pkg.id]?.trim()}
                          className="px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg text-sm font-bold hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          標記已領
                        </button>
                      </div>
                    )}
                    {!isAdmin && (
                      <button
                        onClick={() => markAsPickedUp(pkg.id)}
                        className="w-full px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg text-sm font-bold hover:brightness-90 transition-all"
                      >
                        標記已領
                      </button>
                    )}
                  </div>
                ))
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
              已領取 ({pickedUpPackages.length})
            </h3>
            <div className="space-y-3">
              {pickedUpPackages.length > 0 ? (
                pickedUpPackages.map((pkg) => (
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
