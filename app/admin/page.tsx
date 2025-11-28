"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"
import { AnnouncementDetailsAdmin } from "@/components/announcement-details-admin"
import { canAccessSection, getRoleLabel, shouldUseBackend, type UserRole } from "@/lib/permissions"
import { VisitorManagement } from "@/components/visitor-management"
import { PackageManagement } from "@/components/package-management"
import { useAnnouncements } from "@/features/announcements/hooks/useAnnouncements"
import { AnnouncementCarousel } from "@/features/announcements/ui/AnnouncementCarousel"

type User = {
  id: string
  email: string
  name: string
  role: string
  phone: string
  room: string
  status: string
}

type Section =
  | "dashboard"
  | "announcements"
  | "votes"
  | "maintenance"
  | "finance"
  | "residents"
  | "packages"
  | "visitors"
  | "meetings"
  | "emergencies"
  | "facilities"
  | "announcement-details"

export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentSection, setCurrentSection] = useState<Section>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { announcements, loading: announcementsLoading, reload } = useAnnouncements(false)

  // --- GENERIC DATA STATE ---
  const [data, setData] = useState<any[]>([]) 
  const [loading, setLoading] = useState(false)
  const [imageFiles, setImageFiles] = useState<{ [key: number]: File | null }>({})

  // --- NEW: FINANCE & EXPENSE STATE ---
  const [expenses, setExpenses] = useState<any[]>([]) // Separate state for expenses
  const [financeView, setFinanceView] = useState<'income' | 'expense' | 'report'>('income')
  const [financeFilter, setFinanceFilter] = useState("unpaid")
  
  // --- FEE MODAL STATE (Income - from Code 1) ---
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<any>({
    id: null, room: "", ping_size: 0, car_spots: 0, moto_spots: 0, amount: 0, due: "", invoice: "", paid: false,
  })

  // --- EXPENSE MODAL STATE (Expenditure - from Code 2) ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>({
    id: null, title: "", category: "維護費", amount: 0, payment_date: "", vendor_name: "", invoice_number: "",
  })

  // --- FINANCE CALCULATIONS ---
  // Fee Calculation (Code 1 logic)
  const calculateFeeTotal = (ping: number, car: number, moto: number) => {
    const BASE_RATE = 90    
    const CAR_RATE = 500    
    const MOTO_RATE = 100   
    return Math.round((ping * BASE_RATE) + (car * CAR_RATE) + (moto * MOTO_RATE))
  }

  // Report Calculation (Code 2 logic)
  const getFinancialReport = () => {
    // Income comes from 'data' (when section is finance, data = fees)
    const totalIncome = data.filter(i => i.paid).reduce((sum, item) => sum + (item.amount || 0), 0)
    // Expense comes from 'expenses' state
    const totalExpense = expenses.reduce((sum, item) => sum + (item.amount || 0), 0)
    const netIncome = totalIncome - totalExpense
    
    // Category Analysis
    const expenseByCategory: Record<string, number> = {}
    expenses.forEach(exp => {
       expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + exp.amount
    })

    return { totalIncome, totalExpense, netIncome, expenseByCategory }
  }
  
  const report = getFinancialReport()
  const isCommittee = currentUser?.role === 'committee'

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser")
    if (!storedUser) { router.push("/auth"); return }

    try {
      const user = JSON.parse(storedUser)
      if (!shouldUseBackend(user.role as UserRole)) { router.push("/dashboard"); return }
      setCurrentUser(user)
      // Default Committee to Report view when entering finance
      if (user.role === 'committee') setFinanceView('report')
    } catch (e) {
      localStorage.removeItem("currentUser")
      router.push("/auth")
    }
  }, [router])

  // --- DATA LOADING ---
  useEffect(() => {
    if (currentSection === "finance") {
      loadFinanceData()
    } else if (currentSection !== "dashboard" && currentSection !== "votes") {
      loadData()
    }
  }, [currentSection])

  // Specialized Loader for Finance (Fetches both Fees and Expenses)
  const loadFinanceData = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      // 1. Load Fees (Put into generic 'data' state)
      const { data: feesData } = await supabase.from("fees").select("*").order("created_at", { ascending: false }).limit(100)
      setData(feesData || [])
      
      // 2. Load Expenses (Put into specific 'expenses' state)
      const { data: expData } = await supabase.from("expenses").select("*").order("payment_date", { ascending: false }).limit(100)
      setExpenses(expData || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  // Generic Loader for other sections
  const loadData = async () => {
    setLoading(true)
    try {
      const tableMap: Record<Section, string> = {
        dashboard: "", announcements: "announcements", votes: "", maintenance: "maintenance", finance: "fees", residents: "residents", packages: "packages", visitors: "visitors", meetings: "meetings", emergencies: "emergencies", facilities: "facilities", "announcement-details": "",
      }

      const table = tableMap[currentSection]
      if (!table) return

      const supabase = getSupabaseClient()
      const { data: fetchedData, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(100)

      if (error) throw error
      setData(fetchedData || [])
    } catch (e) {
      console.error(e)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  // --- MODAL & SAVE HANDLERS ---

  // 1. Fee Handlers (Income)
  const openFeeModal = (row: any) => {
    if (row) {
      setEditingFee({ ...row, ping_size: row.ping_size || 0, car_spots: row.car_spots || 0, moto_spots: row.moto_spots || 0 })
    } else {
      setEditingFee({ id: null, room: "", ping_size: 0, car_spots: 0, moto_spots: 0, amount: 0, due: new Date().toISOString().split("T")[0], invoice: "", paid: false })
    }
    setIsFeeModalOpen(true)
  }

  const saveFee = async () => {
    try {
      const supabase = getSupabaseClient()
      const finalAmount = calculateFeeTotal(editingFee.ping_size, editingFee.car_spots, editingFee.moto_spots)
      const feeToSave = { ...editingFee, amount: finalAmount }

      if (feeToSave.id) {
        const { error } = await supabase.from("fees").update(feeToSave).eq("id", feeToSave.id)
        if (error) throw error
      } else {
        const { id, ...newFee } = feeToSave
        const { error } = await supabase.from("fees").insert([newFee])
        if (error) throw error
      }
      setIsFeeModalOpen(false)
      loadFinanceData() // Reload finance specific data
      alert("更新成功！")
    } catch (e: any) { alert("儲存失敗: " + e.message) }
  }

  // 2. Expense Handlers (Expenditure)
  const openExpenseModal = (row: any) => {
    setEditingExpense(row || { id: null, title: "", category: "維護費", amount: 0, payment_date: new Date().toISOString().split("T")[0], vendor_name: "", invoice_number: "" })
    setIsExpenseModalOpen(true)
  }

  const saveExpense = async () => {
    try {
      const supabase = getSupabaseClient()
      if (editingExpense.id) {
        await supabase.from("expenses").update(editingExpense).eq("id", editingExpense.id)
      } else {
        const { id, ...newExp } = editingExpense
        await supabase.from("expenses").insert([newExp])
      }
      setIsExpenseModalOpen(false)
      loadFinanceData()
      alert("支出已記錄！")
    } catch (e: any) { alert("失敗: " + e.message) }
  }

  const handleDeleteExpense = async (id: string) => {
    if(isCommittee) return
    if(!confirm("確定刪除此支出記錄?")) return
    const supabase = getSupabaseClient()
    await supabase.from("expenses").delete().eq("id", id)
    loadFinanceData()
  }

  // 3. Generic Handlers (For other sections)
  const handleSave = async (row: any, index: number) => {
    try {
      const tableMap: Record<Section, string> = {
        dashboard: "", announcements: "announcements", votes: "", maintenance: "maintenance", finance: "fees", residents: "residents", packages: "packages", visitors: "visitors", meetings: "meetings", emergencies: "emergencies", facilities: "facilities", "announcement-details": "",
      }
      const table = tableMap[currentSection]
      if (!table) return

      // Image Upload
      if ((currentSection === "announcements" || currentSection === "facilities") && imageFiles[index]) {
        const file = imageFiles[index]
        const reader = new FileReader()
        await new Promise((resolve, reject) => {
          reader.onload = () => { row.image_url = reader.result as string; resolve(null) }
          reader.onerror = reject; reader.readAsDataURL(file!)
        })
      }

      const supabase = getSupabaseClient()
      if (row.id) {
        const { error } = await supabase.from(table).update(row).eq("id", row.id)
        if (error) throw error
        alert("儲存成功！")
      } else {
        const { id, ...rowWithoutId } = row
        const { error } = await supabase.from(table).insert([rowWithoutId])
        if (error) throw error
        alert("新增成功！")
      }
      if (imageFiles[index]) { const newImageFiles = { ...imageFiles }; delete newImageFiles[index]; setImageFiles(newImageFiles) }

      await loadData()
      if (currentSection === "announcements") await reload()
    } catch (e: any) { console.error(e); alert("操作失敗：" + e.message) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此筆資料？")) return
    try {
      const tableMap: Record<Section, string> = {
        dashboard: "", announcements: "announcements", votes: "", maintenance: "maintenance", finance: "fees", residents: "residents", packages: "packages", visitors: "visitors", meetings: "meetings", emergencies: "emergencies", facilities: "facilities", "announcement-details": "",
      }
      const table = tableMap[currentSection]
      if (!table) return

      const supabase = getSupabaseClient()
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error
      alert("刪除成功！")
      await loadData()
      if (currentSection === "announcements") await reload()
    } catch (e: any) { console.error(e); alert("刪除失敗：" + e.message) }
  }

  const handleAdd = () => {
    // Intercept Finance Add to open correct Modal
    if (currentSection === "finance") {
      if (isCommittee) return
      if (financeView === 'expense') openExpenseModal(null)
      else openFeeModal(null)
      return
    }

    const newRow: any = { id: null }
    switch (currentSection) {
      case "announcements": newRow.status = "draft"; newRow.author = currentUser?.name || ""; break
      case "maintenance": newRow.status = "open"; newRow.cost = 0; break
      case "residents": newRow.role = "resident"; break
      case "packages": newRow.status = "pending"; newRow.arrived_at = new Date().toISOString(); break
      case "visitors": newRow.in = new Date().toISOString(); break
      case "facilities": newRow.capacity = 1; newRow.available = true; break
    }
    setData([newRow, ...data])
  }

  const updateRow = (index: number, field: string, value: any) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    setData(newData)
  }

  const handleImageFileChange = (index: number, file: File | null) => { setImageFiles({ ...imageFiles, [index]: file }) }

  const confirmEmergency = (type: string, note: string) => {
    if (confirm(`確定要送出「${type}」事件嗎？`)) {
      triggerEmergency(type, note)
    }
  }

  const triggerEmergency = async (type: string, note: string) => {
    if (!currentUser) return
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from("emergencies").insert([{ type: type, note: note, time: new Date().toISOString(), by: currentUser.name || "未知" }])
      if (error) throw error
      alert(`已送出緊急事件：${type}`)
    } catch (e: any) { console.error(e); alert("送出失敗：" + e.message) }
  }

  const logout = () => { localStorage.removeItem("currentUser"); router.push("/") }
  const switchToResident = () => { localStorage.setItem("currentUser", JSON.stringify({ ...currentUser, role: "resident" })); router.push("/dashboard") }
  const toggleSidebar = () => { if (window.innerWidth >= 1024) { setSidebarCollapsed(!sidebarCollapsed) } else { setSidebarOpen(!sidebarOpen) } }

  const allNavItems = [
    { id: "dashboard", icon: "dashboard", label: "首頁" },
    { id: "announcements", icon: "campaign", label: "公告管理" },
    { id: "announcement-details", icon: "article", label: "公告詳情" },
    { id: "votes", icon: "how_to_vote", label: "投票管理" },
    { id: "maintenance", icon: "build", label: "設備/維護" },
    { id: "finance", icon: "account_balance", label: "財務管理" }, // Renamed to Generic Finance
    { id: "residents", icon: "people", label: "住戶/人員" },
    { id: "packages", icon: "inventory_2", label: "包裹管理" },
    { id: "visitors", icon: "how_to_reg", label: "訪客管理" },
    { id: "meetings", icon: "event", label: "會議/活動" },
    { id: "emergencies", icon: "emergency", label: "緊急事件" },
    { id: "facilities", icon: "meeting_room", label: "設施管理" },
  ]

  const navItems = currentUser ? allNavItems.filter((item) => canAccessSection(currentUser.role as UserRole, item.id as any, false)) : allNavItems
  const hasAccess = currentUser ? canAccessSection(currentUser.role as UserRole, currentSection, false) : false

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]">
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99] lg:hidden" onClick={toggleSidebar} />}

      <nav className={`fixed lg:static top-0 left-0 h-screen bg-[rgba(45,45,45,0.95)] backdrop-blur-lg border-r-2 border-[#ffd700] overflow-y-auto overflow-x-hidden transition-all duration-300 z-[100] ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${sidebarCollapsed ? "lg:w-0 lg:hidden" : "lg:w-[280px]"}`}>
        <div className={`p-8 pb-6 border-b border-[rgba(255,215,0,0.3)] ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <div className="text-[#ffd700] font-bold text-xl mb-4">社區管理系統</div>
          {currentUser && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#ffd700] text-[#222] flex items-center justify-center font-bold text-lg">{currentUser.name.charAt(0).toUpperCase()}</div>
              <div><div className="text-white font-medium">{currentUser.name}</div><div className="text-[#b0b0b0] text-sm">{getRoleLabel(currentUser.role as UserRole)}</div></div>
            </div>
          )}
        </div>
        <ul className="py-4">
          {navItems.map((item) => (
            <li key={item.id}>
              <button onClick={() => { setCurrentSection(item.id as Section); if (window.innerWidth < 1024) setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-6 py-3 text-white border-l-4 transition-all ${currentSection === item.id ? "bg-[rgba(255,215,0,0.1)] border-[#ffd700] text-[#ffd700]" : "border-transparent hover:bg-[rgba(255,215,0,0.1)] hover:border-[#ffd700] hover:text-[#ffd700]"}`}>
                <span className="material-icons text-xl">{item.icon}</span><span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center px-4 py-3 bg-[#1a1a1a] border-b border-[rgba(255,215,0,0.2)] flex-shrink-0">
          <div className="flex items-center gap-2 text-[#ffd700] font-bold">
            <button onClick={toggleSidebar} className="material-icons p-1 rounded hover:bg-[rgba(255,215,0,0.2)] transition-all lg:hidden">menu</button>
            <span className="text-sm sm:text-base">{navItems.find((item) => item.id === currentSection)?.label || "首頁"}</span>
          </div>
          <div className="flex gap-2">
            {currentUser?.role === "committee" && <button onClick={switchToResident} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border-2 border-[#ffd700] rounded-lg text-[#ffd700] hover:bg-[#ffd700] hover:text-[#1a1a1a] transition-all font-semibold text-xs sm:text-sm"><span className="material-icons text-base sm:text-lg">home</span><span className="hidden sm:inline">住戶功能</span></button>}
            <button onClick={logout} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-[#ffd700] text-[#1a1a1a] rounded-lg hover:bg-[#ffed4e] transition-all font-semibold text-xs sm:text-sm"><span className="material-icons text-base sm:text-lg">logout</span><span className="hidden sm:inline">登出</span></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          {!hasAccess && currentSection !== "dashboard" && currentSection !== "announcement-details" ? (
            <div className="flex items-center justify-center h-full"><div className="bg-[rgba(45,45,45,0.85)] border-2 border-[#f44336] rounded-2xl p-8 text-center max-w-md"><span className="material-icons text-6xl text-[#f44336] mb-4">block</span><h2 className="text-2xl font-bold text-[#f44336] mb-2">沒有權限</h2><p className="text-white mb-4">您的身份無法訪問此功能</p></div></div>
          ) : currentSection === "dashboard" ? (
            <div className="space-y-4">
              {announcements.length > 0 && <AnnouncementCarousel announcements={announcements} loading={announcementsLoading} />}
              <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-4 sm:p-6"><h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-[#f44336] mb-4"><span className="material-icons">emergency</span> 緊急事件</h2><div className="grid grid-cols-4 gap-2 sm:gap-3">{[{ icon: "local_hospital", title: "救護車 119", type: "救護車119", note: "醫療緊急狀況" }, { icon: "report_problem", title: "報警 110", type: "報警110", note: "治安緊急狀況" }, { icon: "favorite", title: "AED", type: "AED", note: "需要AED急救設備" }, { icon: "warning", title: "陌生人員闖入", type: "可疑人員", note: "陌生人員闖入警告" }].map((emergency) => (<button key={emergency.type} onClick={() => confirmEmergency(emergency.type, emergency.note)} className="bg-[rgba(45,45,45,0.85)] border-2 border-[#f44336] rounded-xl p-2 text-center cursor-pointer font-bold text-[#f44336] hover:bg-[rgba(244,67,54,0.2)] transition-all"><div className="material-icons text-2xl mb-1">{emergency.icon}</div><h3 className="font-bold text-xs">{emergency.title}</h3></button>))}</div></div>
            </div>
          ) : currentSection === "finance" ? (
            // ========================== NEW FINANCE SECTION ==========================
            <div className="space-y-6">
                {/* Finance Tabs */}
                <div className="flex p-1 bg-black/20 rounded-xl w-fit border border-white/10">
                 <button onClick={() => setFinanceView('income')} className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${financeView === 'income' ? 'bg-[#ffd700] text-[#222] shadow-lg' : 'text-white/60 hover:text-white'}`}><span className="mr-2">📥</span>收費</button>
                 <button onClick={() => setFinanceView('expense')} className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${financeView === 'expense' ? 'bg-[#f44336] text-white shadow-lg' : 'text-white/60 hover:text-white'}`}><span className="mr-2">📤</span>支出</button>
                 <button onClick={() => setFinanceView('report')} className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${financeView === 'report' ? 'bg-[#2196f3] text-white shadow-lg' : 'text-white/60 hover:text-white'}`}><span className="mr-2">📊</span>報表</button>
               </div>

               {/* VIEW 1: INCOME (Original Fees Table) */}
               {financeView === 'income' && (
                 <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-6">
                   <div className="flex justify-between items-center mb-6">
                     <div className="flex gap-2">
                        {!isCommittee && <button onClick={() => openFeeModal(null)} className="flex items-center gap-2 px-4 py-2 bg-[#ffd700] text-[#222] rounded-lg font-bold hover:brightness-90"><span className="material-icons">add</span> 新增收費</button>}
                        <button onClick={loadFinanceData} className="p-2 border border-white/20 rounded-lg text-white hover:bg-white/10"><span className="material-icons">sync</span></button>
                     </div>
                     <div className="flex gap-2">
                        {['unpaid', 'paid', 'all'].map(filter => (<button key={filter} onClick={() => setFinanceFilter(filter)} className={`px-3 py-1 rounded text-sm capitalize ${financeFilter === filter ? 'bg-[#2196f3] text-white' : 'bg-white/10 text-[#b0b0b0]'}`}>{filter === 'unpaid' ? '未繳' : filter === 'paid' ? '已繳' : '全部'}</button>))}
                     </div>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full border-collapse min-w-[600px]">
                       <thead>
                         <tr className="bg-white/5 text-[#ffd700] text-left"><th className="p-3 border-b border-white/10">房號</th><th className="p-3 border-b border-white/10">金額</th><th className="p-3 border-b border-white/10">狀態</th><th className="p-3 border-b border-white/10">到期日</th><th className="p-3 border-b border-white/10">發票</th>{!isCommittee && <th className="p-3 border-b border-white/10">操作</th>}</tr>
                       </thead>
                       <tbody>
                         {data.filter(row => financeFilter === 'all' ? true : financeFilter === 'paid' ? row.paid : !row.paid).map(row => (
                           <tr key={row.id} className="hover:bg-white/5 transition-colors border-b border-white/5">
                             <td className="p-3 text-white font-medium">{row.room}</td>
                             <td className="p-3 text-xl font-bold text-[#ffd700]">${row.amount?.toLocaleString()}</td>
                             <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold border ${row.paid ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-red-500 text-red-400 bg-red-500/10'}`}>{row.paid ? '已繳' : '未繳'}</span></td>
                             <td className="p-3 text-[#b0b0b0]">{row.due}</td>
                             <td className="p-3 text-[#b0b0b0]">{row.invoice || "-"}</td>
                             {!isCommittee && <td className="p-3"><button onClick={() => openFeeModal(row)} className="flex items-center gap-1 px-3 py-1.5 bg-[#2196f3] text-white rounded hover:brightness-110 text-sm"><span className="material-icons text-sm">edit</span> 編輯</button></td>}
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}

               {/* VIEW 2: EXPENSES (Bills) */}
               {financeView === 'expense' && (
                 <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                       <div className="flex gap-2">
                         {!isCommittee && <button onClick={() => openExpenseModal(null)} className="flex items-center gap-2 px-4 py-2 bg-[#f44336] text-white rounded-lg font-bold hover:brightness-90"><span className="material-icons">remove_circle</span> 新增支出</button>}
                         <button onClick={loadFinanceData} className="p-2 border border-white/20 rounded-lg text-white hover:bg-white/10"><span className="material-icons">sync</span></button>
                       </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse min-w-[600px]">
                        <thead><tr className="bg-white/5 text-gray-400 text-left border-b border-white/10"><th className="p-3">日期</th><th className="p-3">項目</th><th className="p-3">類別</th><th className="p-3">廠商</th><th className="p-3 text-right">金額</th>{!isCommittee && <th className="p-3">操作</th>}</tr></thead>
                        <tbody>
                          {expenses.map(exp => (
                            <tr key={exp.id} className="hover:bg-white/5 transition-colors border-b border-white/5">
                               <td className="p-3 text-gray-400">{exp.payment_date}</td>
                               <td className="p-3 text-white font-bold">{exp.title}</td>
                               <td className="p-3 text-gray-300">{exp.category}</td>
                               <td className="p-3 text-gray-400">{exp.vendor_name}</td>
                               <td className="p-3 text-right text-[#f44336] font-mono font-bold">-${exp.amount?.toLocaleString()}</td>
                               {!isCommittee && (
                                 <td className="p-3">
                                   <button onClick={() => openExpenseModal(exp)} className="text-[#2196f3] mr-3 hover:underline">編輯</button>
                                   <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-400 hover:underline">刪除</button>
                                 </td>
                               )}
                            </tr>
                          ))}
                        </tbody>
                     </table>
                   </div>
                 </div>
               )}

               {/* VIEW 3: REPORT (Dashboard) */}
               {financeView === 'report' && (
                 <div className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-2xl">
                         <div className="text-green-400 text-sm font-bold uppercase">總收入 (Total Income)</div>
                         <div className="text-3xl font-bold text-white mt-2">+${report.totalIncome.toLocaleString()}</div>
                         <div className="text-xs text-gray-400 mt-1">來自管理費收入</div>
                      </div>
                      <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-2xl">
                         <div className="text-red-400 text-sm font-bold uppercase">總支出 (Total Expenses)</div>
                         <div className="text-3xl font-bold text-white mt-2">-${report.totalExpense.toLocaleString()}</div>
                         <div className="text-xs text-gray-400 mt-1">維護、人事、行政費用</div>
                      </div>
                      <div className={`border p-6 rounded-2xl ${report.netIncome >= 0 ? 'bg-blue-900/20 border-blue-500/30' : 'bg-orange-900/20 border-orange-500/30'}`}>
                         <div className="text-blue-400 text-sm font-bold uppercase">本期損益 (Net Income)</div>
                         <div className={`text-3xl font-bold mt-2 ${report.netIncome >= 0 ? 'text-[#ffd700]' : 'text-orange-400'}`}>
                            {report.netIncome >= 0 ? '+' : ''}{report.netIncome.toLocaleString()}
                         </div>
                      </div>
                   </div>
                   {/* Expense Analysis */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
                         <h3 className="text-white font-bold mb-4 flex items-center gap-2"><span className="material-icons text-[#f44336]">pie_chart</span> 支出類別分析</h3>
                         <div className="space-y-3">
                            {Object.entries(report.expenseByCategory).map(([cat, amount]) => (
                             <div key={cat}>
                                <div className="flex justify-between text-sm text-gray-300 mb-1"><span>{cat}</span><span>${amount.toLocaleString()}</span></div>
                                <div className="w-full bg-white/10 rounded-full h-2"><div className="bg-[#f44336] h-2 rounded-full" style={{width: `${Math.min(100, (amount/report.totalExpense)*100)}%`}}></div></div>
                             </div>
                            ))}
                            {Object.keys(report.expenseByCategory).length === 0 && <div className="text-gray-500 text-center">無支出資料</div>}
                         </div>
                      </div>
                      {/* Assets Overview */}
                      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
                         <h3 className="text-white font-bold mb-4 flex items-center gap-2"><span className="material-icons text-[#2196f3]">account_balance</span> 資產概況 (Assets)</h3>
                         <div className="space-y-4">
                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg"><span className="text-gray-300">銀行存款</span><span className="text-white font-mono font-bold">$ 2,681,720</span></div>
                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg"><span className="text-gray-300">定存</span><span className="text-white font-mono font-bold">$ 36,000,000</span></div>
                             <div className="border-t border-white/10 pt-3 flex justify-between"><span className="text-[#ffd700] font-bold">資產總計</span><span className="text-[#ffd700] font-bold">$ 38,690,354</span></div>
                         </div>
                      </div>
                   </div>
                 </div>
               )}
            </div>
          ) : currentSection === "visitors" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl"><span className="material-icons">how_to_reg</span>訪客管理 (警衛)</h2><VisitorManagement currentUser={currentUser} isAdmin={true} />
            </div>
          ) : currentSection === "packages" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <h2 className="flex gap-2 items-center text-[#ffd700] mb-5 text-xl"><span className="material-icons">inventory_2</span>包裹管理 (警衛)</h2><PackageManagement currentUser={currentUser} isAdmin={true} />
            </div>
          ) : currentSection === "announcement-details" ? (
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6"><AnnouncementDetailsAdmin onClose={() => setCurrentSection("dashboard")} currentUser={currentUser} /></div>
          ) : currentSection === "votes" ? (
             <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-6">
               <h2 className="flex gap-2 items-center text-[#ffd700] mb-4 text-xl"><span className="material-icons">how_to_vote</span> 投票與問卷管理</h2>
               <p className="text-[#b0b0b0] mb-8">目前社區投票系統已整合至 Google 表格，請使用下方按鈕進行管理或查看結果。</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                   <div className="flex items-center gap-3 text-[#ffd700] mb-3"><span className="material-icons text-3xl">edit_note</span><h3 className="text-xl font-bold">編輯表單</h3></div>
                   <p className="text-gray-400 text-sm mb-4">前往 Google Forms 編輯問卷內容、新增問題或修改選項。</p>
                   <a href="https://docs.google.com/forms/d/1-RIrL9cKOfX4HY2gLa7m6gF-fVX72uDdtfVhABMUFx8/edit" target="_blank" rel="noopener noreferrer" className="inline-block w-full text-center py-3 bg-[#ffd700] text-[#222] font-bold rounded-lg hover:brightness-90">開啟表單編輯器</a>
                 </div>
                 <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                   <div className="flex items-center gap-3 text-[#4caf50] mb-3"><span className="material-icons text-3xl">analytics</span><h3 className="text-xl font-bold">查看結果</h3></div>
                   <p className="text-gray-400 text-sm mb-4">查看即時投票結果、統計圖表以及匯出 Excel 報表。</p>
                   <a href="https://docs.google.com/spreadsheets/d/1xegZfzU-UyS0Rqfs00Ar-A9hIVc-vpLUhAcrNmhv_-0/edit?usp=sharing" target="_blank" rel="noopener noreferrer" className="inline-block w-full text-center py-3 bg-[#4caf50] text-white font-bold rounded-lg hover:brightness-90">查看統計結果</a>
                 </div>
               </div>
             </div>
          ) : (
            // ========================== GENERIC TABLE (For Residents, Maintenance, etc.) ==========================
            <div className="bg-[rgba(45,45,45,0.85)] border border-[rgba(255,215,0,0.25)] rounded-2xl p-3 sm:p-6">
              <div className="flex gap-2 mb-4 flex-wrap">
                {currentSection !== "emergencies" && <button onClick={handleAdd} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-[#4caf50] text-white rounded-lg hover:brightness-90 transition-all text-xs sm:text-sm"><span className="material-icons text-base sm:text-xl">add</span><span className="hidden sm:inline">新增一筆</span><span className="sm:hidden">新增</span></button>}
                <button onClick={loadData} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border border-[#ffd700] text-white rounded-lg hover:bg-[#ffd700] hover:text-[#222] transition-all text-xs sm:text-sm"><span className="material-icons text-base sm:text-xl">sync</span><span className="hidden sm:inline">重新整理</span><span className="sm:hidden">重整</span></button>
              </div>

              {loading ? (
                <div className="text-center text-[#b0b0b0] py-12">載入中...</div>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-white/5">
                          {currentSection === "facilities" && <><th className="p-3 text-left text-[#ffd700] border-b border-white/10">設施名稱</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">說明</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">位置</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">容納人數</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">圖片</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th></>}
                          {currentSection === "announcements" && <><th className="p-3 text-left text-[#ffd700] border-b border-white/10">標題</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">內容</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">圖片URL</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">作者</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th></>}
                          {currentSection === "maintenance" && <><th className="p-3 text-left text-[#ffd700] border-b border-white/10">設備</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">項目</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">描述</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">報修人</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">照片</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">狀態</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">處理人</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">費用</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th></>}
                          {currentSection === "residents" && <><th className="p-3 text-left text-[#ffd700] border-b border-white/10">姓名</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">房號</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">電話</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">Email</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">身分</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th></>}
                          {currentSection === "meetings" && <><th className="p-3 text-left text-[#ffd700] border-b border-white/10">主題</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">時間</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">地點</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">備註</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">操作</th></>}
                          {currentSection === "emergencies" && <><th className="p-3 text-left text-[#ffd700] border-b border-white/10">類型</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">時間</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">使用者</th><th className="p-3 text-left text-[#ffd700] border-b border-white/10">紀錄</th></>}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, index) => (
                           <tr key={row.id || index} className="hover:bg-white/5 transition-colors">
                              {/* RENDER LOGIC FOR SPECIFIC TABLES - PRESERVED FROM CODE 1 */}
                              {currentSection === "maintenance" && (
                                <>
                                  <td className="p-3 border-b border-white/5"><input type="text" value={row.equipment || ""} onChange={(e) => updateRow(index, "equipment", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><input type="text" value={row.item || ""} onChange={(e) => updateRow(index, "item", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><textarea value={row.description || ""} onChange={(e) => updateRow(index, "description", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><input type="text" value={row.reported_by || ""} onChange={(e) => updateRow(index, "reported_by", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5">{row.photo_url ? <img src={row.photo_url} alt="維修" className="max-w-[100px] h-auto rounded" onClick={() => window.open(row.photo_url, "_blank")} /> : <span className="text-[#b0b0b0] text-sm">無照片</span>}</td>
                                  <td className="p-3 border-b border-white/5"><select value={row.status || "open"} onChange={(e) => updateRow(index, "status", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white"><option value="open">待處理</option><option value="progress">處理中</option><option value="closed">已完成</option></select></td>
                                  <td className="p-3 border-b border-white/5"><input type="text" value={row.handler || ""} onChange={(e) => updateRow(index, "handler", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><input type="number" value={row.cost || 0} onChange={(e) => updateRow(index, "cost", Number(e.target.value))} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><div className="flex gap-2"><button onClick={() => handleSave(row, index)} className="px-3 py-1 bg-[#4caf50] text-white rounded">儲存</button>{row.id && <button onClick={() => handleDelete(row.id)} className="px-3 py-1 bg-[#f44336] text-white rounded">刪除</button>}</div></td>
                                </>
                              )}
                              {currentSection === "residents" && (
                                <>
                                  <td className="p-3 border-b border-white/5"><input type="text" value={row.name || ""} onChange={(e) => updateRow(index, "name", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><input type="text" value={row.room || ""} onChange={(e) => updateRow(index, "room", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><input type="tel" value={row.phone || ""} onChange={(e) => updateRow(index, "phone", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><input type="email" value={row.email || ""} onChange={(e) => updateRow(index, "email", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white" /></td>
                                  <td className="p-3 border-b border-white/5"><select value={row.role || "resident"} onChange={(e) => updateRow(index, "role", e.target.value)} className="w-full p-2 bg-white/10 border border-[rgba(255,215,0,0.3)] rounded text-white"><option value="resident">住戶</option><option value="committee">委員會</option><option value="vendor">廠商</option><option value="admin">管理員</option></select></td>
                                  <td className="p-3 border-b border-white/5"><div className="flex gap-2"><button onClick={() => handleSave(row, index)} className="px-3 py-1 bg-[#4caf50] text-white rounded">儲存</button>{row.id && <button onClick={() => handleDelete(row.id)} className="px-3 py-1 bg-[#f44336] text-white rounded">刪除</button>}</div></td>
                                </>
                              )}
                              {/* ... (Repeat for other sections: Announcements, Facilities, Meetings, Emergencies) ... */}
                              {/* Included minimal example for generic sections to keep code concise, full logic for specific tables above */}
                              {currentSection === "announcements" && (
                                <>
                                   <td className="p-3 border-b border-white/5"><input value={row.title} onChange={e=>updateRow(index,'title',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><textarea value={row.content} onChange={e=>updateRow(index,'content',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><input type="file" onChange={e=>handleImageFileChange(index, e.target.files?.[0] || null)} className="text-white"/></td>
                                   <td className="p-3 border-b border-white/5"><input value={row.author} onChange={e=>updateRow(index,'author',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><select value={row.status} onChange={e=>updateRow(index,'status',e.target.value)} className="bg-white/10 text-white p-2 rounded"><option value="draft">草稿</option><option value="published">發布</option></select></td>
                                   <td className="p-3 border-b border-white/5"><div className="flex gap-2"><button onClick={()=>handleSave(row,index)} className="bg-green-500 text-white px-2 py-1 rounded">Save</button>{row.id && <button onClick={()=>handleDelete(row.id)} className="bg-red-500 text-white px-2 py-1 rounded">Del</button>}</div></td>
                                </>
                              )}
                              {currentSection === "facilities" && (
                                <>
                                   <td className="p-3 border-b border-white/5"><input value={row.name} onChange={e=>updateRow(index,'name',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><textarea value={row.description} onChange={e=>updateRow(index,'description',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><input value={row.location} onChange={e=>updateRow(index,'location',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><input type="number" value={row.capacity} onChange={e=>updateRow(index,'capacity',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><input type="file" onChange={e=>handleImageFileChange(index, e.target.files?.[0] || null)} className="text-white"/></td>
                                   <td className="p-3 border-b border-white/5"><select value={String(row.available)} onChange={e=>updateRow(index,'available',e.target.value)} className="bg-white/10 text-white p-2 rounded"><option value="true">可用</option><option value="false">不可用</option></select></td>
                                   <td className="p-3 border-b border-white/5"><div className="flex gap-2"><button onClick={()=>handleSave(row,index)} className="bg-green-500 text-white px-2 py-1 rounded">Save</button>{row.id && <button onClick={()=>handleDelete(row.id)} className="bg-red-500 text-white px-2 py-1 rounded">Del</button>}</div></td>
                                </>
                              )}
                              {currentSection === "meetings" && (
                                <>
                                   <td className="p-3 border-b border-white/5"><input value={row.topic} onChange={e=>updateRow(index,'topic',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><input type="datetime-local" value={row.time?.slice(0,16)} onChange={e=>updateRow(index,'time',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><input value={row.location} onChange={e=>updateRow(index,'location',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><input value={row.notes} onChange={e=>updateRow(index,'notes',e.target.value)} className="bg-white/10 text-white p-2 rounded w-full"/></td>
                                   <td className="p-3 border-b border-white/5"><div className="flex gap-2"><button onClick={()=>handleSave(row,index)} className="bg-green-500 text-white px-2 py-1 rounded">Save</button>{row.id && <button onClick={()=>handleDelete(row.id)} className="bg-red-500 text-white px-2 py-1 rounded">Del</button>}</div></td>
                                </>
                              )}
                              {currentSection === "emergencies" && (
                                <>
                                   <td className="p-3 border-b border-white/5 text-red-500">{row.type}</td>
                                   <td className="p-3 border-b border-white/5 text-gray-400">{new Date(row.time).toLocaleString()}</td>
                                   <td className="p-3 border-b border-white/5 text-white">{row.by}</td>
                                   <td className="p-3 border-b border-white/5 text-gray-400">{row.note}</td>
                                </>
                              )}
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* FEE CALCULATOR & EDIT MODAL (Income - Detailed from Code 1) */}
      {isFeeModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#2d2d2d] border-2 border-[#ffd700] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#1a1a1a] p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-[#ffd700] flex items-center gap-2"><span className="material-icons">calculate</span> 編輯費用明細</h3>
              <button onClick={() => setIsFeeModalOpen(false)} className="text-white hover:text-red-400"><span className="material-icons">close</span></button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold text-[#2196f3] uppercase tracking-wider mb-3">1. 費用計算</h4>
                <div className="mb-3"><label className="block text-sm text-[#b0b0b0] mb-1">房號</label><input type="text" value={editingFee.room} onChange={e => setEditingFee({ ...editingFee, room: e.target.value })} className="w-full p-2 bg-black/30 border border-white/20 rounded text-white" /></div>
                <div className="mb-3"><div className="flex justify-between text-sm mb-1"><span className="text-white">房屋坪數</span><span className="text-[#b0b0b0]">$90 / 坪</span></div><div className="flex items-center gap-2"><input type="number" value={editingFee.ping_size} onChange={e => setEditingFee({ ...editingFee, ping_size: Number(e.target.value) })} className="flex-1 p-2 bg-black/30 border border-white/20 rounded text-white" /><span className="text-[#ffd700] font-mono w-20 text-right">$ {(editingFee.ping_size * 90).toLocaleString()}</span></div></div>
                <div className="mb-3"><div className="flex justify-between text-sm mb-1"><span className="text-white">汽車位</span><span className="text-[#b0b0b0]">$500 / 位</span></div><div className="flex items-center gap-2"><button onClick={() => setEditingFee({ ...editingFee, car_spots: Math.max(0, editingFee.car_spots - 1) })} className="w-8 h-8 bg-white/10 rounded text-white">-</button><span className="flex-1 text-center text-white font-bold">{editingFee.car_spots}</span><button onClick={() => setEditingFee({ ...editingFee, car_spots: editingFee.car_spots + 1 })} className="w-8 h-8 bg-white/10 rounded text-white">+</button><span className="text-[#ffd700] font-mono w-20 text-right">$ {(editingFee.car_spots * 500).toLocaleString()}</span></div></div>
                <div className="mb-3"><div className="flex justify-between text-sm mb-1"><span className="text-white">機車位</span><span className="text-[#b0b0b0]">$100 / 位</span></div><div className="flex items-center gap-2"><button onClick={() => setEditingFee({ ...editingFee, moto_spots: Math.max(0, editingFee.moto_spots - 1) })} className="w-8 h-8 bg-white/10 rounded text-white">-</button><span className="flex-1 text-center text-white font-bold">{editingFee.moto_spots}</span><button onClick={() => setEditingFee({ ...editingFee, moto_spots: editingFee.moto_spots + 1 })} className="w-8 h-8 bg-white/10 rounded text-white">+</button><span className="text-[#ffd700] font-mono w-20 text-right">$ {(editingFee.moto_spots * 100).toLocaleString()}</span></div></div>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center"><span className="text-white font-bold">本月總計:</span><span className="text-2xl font-bold text-[#ffd700]">$ {calculateFeeTotal(editingFee.ping_size, editingFee.car_spots, editingFee.moto_spots).toLocaleString()}</span></div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#2196f3] uppercase tracking-wider mb-3 mt-6">2. 行政資訊</h4>
                <div className="grid grid-cols-2 gap-4 mb-3"><div><label className="block text-xs text-[#b0b0b0] mb-1">到期日</label><input type="date" value={editingFee.due} onChange={e => setEditingFee({ ...editingFee, due: e.target.value })} className="w-full p-2 bg-black/30 border border-white/20 rounded text-white text-sm" /></div><div><label className="block text-xs text-[#b0b0b0] mb-1">發票號碼</label><input type="text" value={editingFee.invoice || ""} onChange={e => setEditingFee({ ...editingFee, invoice: e.target.value })} className="w-full p-2 bg-black/30 border border-white/20 rounded text-white text-sm" /></div></div>
                <div className="flex items-center gap-4 p-3 bg-black/20 rounded-lg border border-white/5"><span className="text-sm text-white">繳費狀態:</span><label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={!editingFee.paid} onChange={() => setEditingFee({ ...editingFee, paid: false })} name="status" /><span className="text-red-400 text-sm font-bold">未繳</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={editingFee.paid} onChange={() => setEditingFee({ ...editingFee, paid: true })} name="status" /><span className="text-green-400 text-sm font-bold">已繳</span></label></div>
              </div>
            </div>
            <div className="p-4 bg-[#1a1a1a] border-t border-white/10 flex gap-3">
              {editingFee.id && <button onClick={() => { if (confirm('刪除此筆資料?')) { handleDelete(editingFee.id); setIsFeeModalOpen(false) } }} className="px-4 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">刪除</button>}
              <div className="flex-1"></div>
              <button onClick={() => setIsFeeModalOpen(false)} className="px-4 py-2 text-[#b0b0b0] hover:text-white">取消</button>
              <button onClick={saveFee} className="px-6 py-2 bg-[#ffd700] text-[#222] font-bold rounded hover:brightness-90">儲存並更新</button>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL (Expense - From Code 2) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200]">
          <div className="bg-[#222] p-6 rounded-2xl w-96 border border-[#f44336]">
            <h3 className="text-[#f44336] text-xl font-bold mb-4">記錄支出</h3>
            <div className="space-y-3">
              <input className="w-full bg-black/30 p-2 rounded text-white" placeholder="項目名稱" value={editingExpense.title} onChange={e => setEditingExpense({ ...editingExpense, title: e.target.value })} />
              <select className="w-full bg-black/30 p-2 rounded text-white" value={editingExpense.category} onChange={e => setEditingExpense({ ...editingExpense, category: e.target.value })}><option value="維護費">維護費</option><option value="人事費">人事費</option><option value="行政費">行政費</option><option value="清潔費">清潔費</option></select>
              <input type="number" className="w-full bg-black/30 p-2 rounded text-white" placeholder="金額" value={editingExpense.amount} onChange={e => setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })} />
              <input type="date" className="w-full bg-black/30 p-2 rounded text-white" value={editingExpense.payment_date} onChange={e => setEditingExpense({ ...editingExpense, payment_date: e.target.value })} />
              <div className="flex gap-2">
                 <button onClick={() => setIsExpenseModalOpen(false)} className="flex-1 py-3 bg-gray-600 text-white font-bold rounded">取消</button>
                 <button onClick={saveExpense} className="flex-1 py-3 bg-[#f44336] text-white font-bold rounded">確認支出</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}