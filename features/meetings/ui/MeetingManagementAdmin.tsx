"use client"

import { useState } from "react"
import { useMeetings } from "../hooks/useMeetings"
import type { Meeting } from "../api/meetings"
import { uploadMeetingPDF } from "../api/meetings"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, Search } from "lucide-react"

interface MeetingFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: Omit<Meeting, "id" | "created_at">
  onChange: (field: keyof Meeting, value: any) => void
  onSave: () => void
  isEditing: boolean
  onPDFFileChange: (file: File | null) => void
  pdfFile: File | null
}

function MeetingFormModal({
  isOpen,
  onClose,
  formData,
  onChange,
  onSave,
  isEditing,
  onPDFFileChange,
  pdfFile,
}: MeetingFormModalProps) {
  const [newTakeaway, setNewTakeaway] = useState("")
  const [editingTakeawayIndex, setEditingTakeawayIndex] = useState<number | null>(null)
  const [editingTakeawayText, setEditingTakeawayText] = useState("")

  if (!isOpen) return null

  const addTakeaway = () => {
    if (newTakeaway.trim()) {
      const currentTakeaways = formData.key_takeaways || []
      onChange("key_takeaways", [...currentTakeaways, newTakeaway.trim()])
      setNewTakeaway("")
    }
  }

  const startEditTakeaway = (index: number) => {
    const currentTakeaways = formData.key_takeaways || []
    setEditingTakeawayIndex(index)
    setEditingTakeawayText(currentTakeaways[index])
  }

  const saveEditTakeaway = () => {
    if (editingTakeawayIndex !== null && editingTakeawayText.trim()) {
      const currentTakeaways = formData.key_takeaways || []
      const updated = [...currentTakeaways]
      updated[editingTakeawayIndex] = editingTakeawayText.trim()
      onChange("key_takeaways", updated)
      setEditingTakeawayIndex(null)
      setEditingTakeawayText("")
    }
  }

  const cancelEditTakeaway = () => {
    setEditingTakeawayIndex(null)
    setEditingTakeawayText("")
  }

  const removeTakeaway = (index: number) => {
    const currentTakeaways = formData.key_takeaways || []
    onChange(
      "key_takeaways",
      currentTakeaways.filter((_, i) => i !== index),
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-bold text-[var(--theme-accent)] flex items-center gap-2">
            {isEditing ? "編輯會議/活動" : "新增會議/活動"}
            <HelpHint
              title="管理端會議編輯"
              description="可建立或更新會議資料、重點摘要與附件，供住戶端查看。"
              workflow={[
                "先填主題、時間、地點等基本資訊。",
                "再補重點摘要、PDF 與備註。",
                "儲存後回列表確認顯示是否正確。",
              ]}
              logic={[
                "此表單同時支援新增與編輯，避免資料維護分散。",
              ]}
            />
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--theme-accent-light)] transition-colors">
            <span className="material-icons text-[var(--theme-text-secondary)]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">會議主題<HelpHint title="管理端會議主題" description="填寫會議名稱，住戶端列表會優先顯示此欄。" workflow={["輸入可辨識的會議主題。","主題建議包含目的或議題關鍵字。","儲存前確認主題與時間一致。"]} logic={["主題是住戶端第一辨識欄位，影響查找效率。"]} align="center" /></label>
            <input
              type="text"
              value={formData.topic || ""}
              onChange={(e) => onChange("topic", e.target.value)}
              placeholder="請輸入會議主題"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">時間<HelpHint title="管理端會議時間" description="設定會議舉辦時間，供住戶安排出席。" workflow={["選擇正確日期與時段。","確認是否需要含分鐘精度。","變更時間後建議同步公告提醒。"]} logic={["時間欄是出席安排核心，錯誤會直接影響到場率。"]} align="center" /></label>
            <input
              type="datetime-local"
              value={formData.time || ""}
              onChange={(e) => onChange("time", e.target.value)}
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">地點<HelpHint title="管理端會議地點" description="填寫明確地點，降低住戶到場錯誤。" workflow={["輸入完整地點資訊（棟別/樓層/會議室）。","必要時補充進場指引於備註。","儲存後在列表確認地點顯示。"]} logic={["地點資訊越明確，越能降低住戶跑錯場地機率。"]} align="center" /></label>
            <input
              type="text"
              value={formData.location || ""}
              onChange={(e) => onChange("location", e.target.value)}
              placeholder="例：A棟 1樓 會議室"
              className="w-full p-3 rounded-xl theme-input outline-none"
            />
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2">
              重點摘要 (3-5 項重要決議事項)
              <span className="inline-flex ml-2 align-middle"><HelpHint title="管理端重點摘要" description="建議整理 3-5 項決議重點，方便住戶快速閱讀。" workflow={["以條列新增每一項重點決議。","可用編輯/刪除按鈕調整順序與文字。","完成後檢查是否涵蓋主要結論。"]} logic={["摘要是住戶端快速閱讀區，應聚焦可執行決議。"]} align="center" /></span>
            </label>
            <div className="space-y-2">
              {(formData.key_takeaways || []).map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-[var(--theme-bg-secondary)] rounded-lg">
                  <span className="text-[var(--theme-accent)] font-bold mt-1">{index + 1}.</span>
                  {editingTakeawayIndex === index ? (
                    <>
                      <input
                        type="text"
                        value={editingTakeawayText}
                        onChange={(e) => setEditingTakeawayText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") saveEditTakeaway()
                          if (e.key === "Escape") cancelEditTakeaway()
                        }}
                        className="flex-1 p-2 rounded theme-input outline-none"
                        autoFocus
                      />
                      <button
                        onClick={saveEditTakeaway}
                        className="p-1 hover:bg-green-500/20 rounded transition-colors"
                        title="儲存"
                      >
                        <span className="material-icons text-sm text-green-500">check</span>
                      </button>
                      <button
                        onClick={cancelEditTakeaway}
                        className="p-1 hover:bg-gray-500/20 rounded transition-colors"
                        title="取消"
                      >
                        <span className="material-icons text-sm text-gray-500">close</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[var(--theme-text-primary)] mt-1">{item}</span>
                      <button
                        onClick={() => startEditTakeaway(index)}
                        className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                        title="編輯"
                      >
                        <span className="material-icons text-sm text-blue-500">edit</span>
                      </button>
                      <button
                        onClick={() => removeTakeaway(index)}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="刪除"
                      >
                        <span className="material-icons text-sm text-red-500">delete</span>
                      </button>
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTakeaway}
                  onChange={(e) => setNewTakeaway(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addTakeaway()}
                  placeholder="輸入新的重點決議後按 Enter 或點擊新增"
                  className="flex-1 p-3 rounded-xl theme-input outline-none"
                />
                <button
                  onClick={addTakeaway}
                  className="px-4 py-3 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all"
                >
                  <span className="material-icons">add</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">完整會議記錄 (PDF)<HelpHint title="管理端會議 PDF" description="可上傳完整簽章版會議記錄，供住戶下載留存。" workflow={["選擇 PDF 檔案後確認檔名已顯示。","儲存時系統會先上傳 PDF 再寫入資料。","若上傳失敗請重新選檔再試。"]} logic={["PDF 屬正式附件，適合留存完整記錄與簽章版本。"]} align="center" /></label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onPDFFileChange(e.target.files?.[0] || null)}
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
            {pdfFile && (
              <div className="text-green-500 text-sm mt-1 flex items-center gap-1">
                <span className="material-icons text-sm">check_circle</span>
                已選擇: {pdfFile.name}
              </div>
            )}
            {formData.pdf_file_url && !pdfFile && (
              <div className="text-[var(--theme-text-secondary)] text-sm mt-1 flex items-center gap-1">
                <span className="material-icons text-sm">description</span>
                目前已有 PDF 檔案
              </div>
            )}
          </div>

          <div>
            <label className="block text-[var(--theme-text-primary)] font-medium mb-2 flex items-center gap-2">備註<HelpHint title="管理端備註" description="補充說明或注意事項，可在住戶端詳情查看。" workflow={["填寫現場限制、補充通知或追蹤事項。","避免重複摘要內容，聚焦補充資訊。","儲存後在詳情頁確認顯示。"]} logic={["備註可承接未列入摘要但對執行有影響的資訊。"]} align="center" /></label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => onChange("notes", e.target.value)}
              placeholder="請輸入備註事項"
              rows={3}
              className="w-full p-3 rounded-xl theme-input outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-[var(--theme-border)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-semibold border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] transition-all"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-3 rounded-xl font-semibold bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] hover:opacity-90 transition-all"
          >
            {isEditing ? "儲存變更" : "新增"}
          </button>
        </div>
      </div>
    </div>
  )
}

// 預覽模式的模擬資料
const PREVIEW_MEETINGS = [
  { id: "preview-1", topic: "年度區分所有權人會議", time: new Date(Date.now() + 7 * 86400000).toISOString(), location: "社區大會議室", notes: "年度重要會議", key_takeaways: ["預算審核", "管委會改選", "公共設施更新案"], pdf_file_url: "" },
  { id: "preview-2", topic: "管委會例會", time: new Date(Date.now() - 7 * 86400000).toISOString(), location: "管理室", notes: "", key_takeaways: ["財務報告", "設備維修進度"], pdf_file_url: "https://example.com/meeting.pdf" },
]

interface MeetingManagementAdminProps {
  isPreviewMode?: boolean
}

export function MeetingManagementAdmin({ isPreviewMode = false }: MeetingManagementAdminProps) {
  const { meetings: realMeetings, loading, addMeeting, editMeeting, removeMeeting, reload } = useMeetings()

  // 預覽模式使用模擬資料
  const meetings = isPreviewMode ? PREVIEW_MEETINGS : realMeetings

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<Omit<Meeting, "id" | "created_at">>({
    topic: "",
    time: "",
    location: "",
    notes: "",
    key_takeaways: [],
    pdf_file_url: undefined,
  })
  const [searchTerm, setSearchTerm] = useState("")

  const filteredMeetings = meetings.filter((meeting) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      meeting.topic?.toLowerCase().includes(term) ||
      false ||
      meeting.location?.toLowerCase().includes(term) ||
      false ||
      (meeting.time && new Date(meeting.time).toLocaleDateString("zh-TW").includes(term))
    )
  })

  const handleAdd = () => {
    setFormData({ topic: "", time: "", location: "", notes: "", key_takeaways: [], pdf_file_url: undefined })
    setEditingId(null)
    setPdfFile(null)
    setIsModalOpen(true)
  }

  const handleEdit = (meeting: Meeting) => {
    setFormData({
      topic: meeting.topic,
      time: meeting.time ? meeting.time.slice(0, 16) : "",
      location: meeting.location,
      notes: meeting.notes || "",
      key_takeaways: meeting.key_takeaways || [],
      pdf_file_url: meeting.pdf_file_url || undefined,
    })
    setEditingId(meeting.id || null)
    setPdfFile(null)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof Meeting, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!formData.topic || !formData.time) {
      alert("請填寫主題和時間")
      return
    }

    try {
      const finalData = { ...formData }

      if (pdfFile) {
        try {
          const pdfUrl = await uploadMeetingPDF(pdfFile)
          finalData.pdf_file_url = pdfUrl
        } catch (uploadError) {
          console.error("Error uploading PDF:", uploadError)
          alert("PDF 上傳失敗，請稍後再試")
          return
        }
      }

      if (editingId) {
        await editMeeting(editingId, finalData)
      } else {
        await addMeeting(finalData)
      }
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error saving meeting:", error)
      alert("儲存失敗，請稍後再試")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("確定要刪除此會議/活動嗎？")) {
      await removeMeeting(id)
    }
  }

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
          <span className="material-icons">event</span>
          會議/活動管理
          <HelpHint
            title="管理端會議/活動管理"
            description="集中管理會議活動內容，包含新增、編輯、刪除與附件維護。"
            workflow={[
              "點新增一筆建立會議資料。",
              "完成表單後儲存，必要時上傳 PDF。",
              "用列表持續編輯、刪除與追蹤會議內容。",
            ]}
            logic={[
              "本模組是會議資料主檔，會同步影響住戶端顯示。",
            ]}
          />
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--theme-text-primary)] text-sm">搜尋</span>
            <HelpHint title="管理端會議搜尋" description="可用主題、地點或日期快速找到會議資料。" workflow={["輸入主題、地點或日期關鍵字。","從結果中選擇目標會議執行編輯。","無結果時清空關鍵字恢復完整列表。"]} logic={["搜尋僅影響列表顯示，不會改動資料。"]} />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
            <Input
              type="text"
              placeholder="搜尋會議主題、地點或日期..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            新增一筆
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] table-fixed border-collapse">
          <thead>
            <tr className="bg-[var(--theme-accent-light)]">
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>主題</span><HelpHint title="主題欄" description="會議主題名稱。" workflow={["先看主題辨識會議內容。","若主題相近再搭配時間欄位判斷。"]} logic={["主題欄是列表識別核心。"]} /></div></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>時間</span><HelpHint title="時間欄" description="會議舉辦時間。" workflow={["核對會議日期與時段是否正確。","時間異動時優先修正此欄對應資料。"]} logic={["時間欄影響行程安排與通知時效。"]} /></div></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>地點</span><HelpHint title="地點欄" description="會議舉辦地點。" workflow={["查看地點是否明確。","若有錯誤請進入編輯修正。"]} logic={["地點欄可避免住戶到錯場地。"]} /></div></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                <div className="inline-flex items-center gap-2 whitespace-nowrap"><span>重點摘要</span><HelpHint title="重點摘要欄" description="顯示重點項目數量。" workflow={["先看項目數判斷摘要完整度。","需要內容時再進詳情頁查看。"]} logic={["此欄顯示數量指標，不直接顯示全文。"]} /></div>
              </th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>PDF</span><HelpHint title="PDF 欄" description="顯示是否已上傳完整會議檔。" workflow={["看圖示確認附件是否齊全。","缺附件時進編輯補上 PDF。"]} logic={["PDF 欄可快速盤點哪些會議仍缺正式附件。"]} /></div></th>
              <th className="p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap"><div className="inline-flex items-center gap-2 whitespace-nowrap"><span>操作</span><HelpHint title="操作欄" description="可編輯或刪除會議資料。" workflow={["點編輯更新會議內容。","確認不再需要時再執行刪除。","操作後回列表確認結果。"]} logic={["刪除屬高風險操作，建議先確認是否需保留歷史紀錄。"]} /></div></th>
            </tr>
          </thead>
          <tbody>
            {filteredMeetings.length > 0 ? (
              filteredMeetings.map((meeting) => (
                <tr key={meeting.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.topic || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.time ? new Date(meeting.time).toLocaleString("zh-TW") : "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.location || "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.key_takeaways && meeting.key_takeaways.length > 0
                      ? `${meeting.key_takeaways.length} 項`
                      : "-"}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                    {meeting.pdf_file_url ? (
                      <span className="material-icons text-green-500">check_circle</span>
                    ) : (
                      <span className="material-icons text-gray-400">cancel</span>
                    )}
                  </td>
                  <td className="p-3 border-b border-[var(--theme-border)]">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(meeting)}
                        className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                        title="編輯"
                      >
                        <span className="material-icons text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(meeting.id!)}
                        className="p-2 rounded-lg border border-[var(--theme-btn-delete-border)] text-[var(--theme-btn-delete-text)] hover:bg-[var(--theme-btn-delete-hover)] transition-all"
                        title="刪除"
                      >
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--theme-text-secondary)]">
                  {searchTerm ? "沒有符合條件的會議/活動" : "目前沒有會議/活動"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MeetingFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onChange={handleFormChange}
        onSave={handleSave}
        isEditing={editingId !== null}
        onPDFFileChange={setPdfFile}
        pdfFile={pdfFile}
      />
    </div>
  )
}
