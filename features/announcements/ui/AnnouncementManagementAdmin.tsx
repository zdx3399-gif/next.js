"use client"

import { useState, useEffect } from "react"
import type { Announcement } from "../api/announcements"
import {
  fetchAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadAnnouncementImage,
} from "../api/announcements"
import { HelpHint } from "@/components/ui/help-hint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Plus, Search } from "lucide-react"

interface AnnouncementFormModalProps {
  isOpen: boolean
  onClose: () => void
  formData: Partial<Announcement>
  onChange: (field: keyof Announcement, value: string) => void
  onSave: () => void
  isEdit: boolean
  onImageFileChange: (file: File | null) => void
  imageFile: File | null
  isSaving?: boolean
}

function AnnouncementFormModal({
  isOpen,
  onClose,
  formData,
  onChange,
  onSave,
  isEdit,
  onImageFileChange,
  imageFile,
  isSaving = false,
}: AnnouncementFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h3 className="text-lg font-semibold text-[var(--theme-accent)]">{isEdit ? "編輯公告" : "新增公告"}</h3>
          <button
            onClick={onClose}
            className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">標題</label>
              <HelpHint
                title="標題"
                description="公告的主題名稱，會出現在公告列表與首頁輪播。建議在 20 字內說清楚『事件 + 重點』，例如：2/28 停水通知。"
                workflow={[
                  "先輸入事件主題與時間重點（例如停水、施工、活動）。",
                  "確認標題可單獨被理解，再進行內容撰寫。",
                  "送出前檢查是否與既有公告重複。",
                ]}
                logic={[
                  "標題會直接影響住戶端列表辨識與點擊率。",
                  "標題過長或不明確會增加住戶誤解風險。",
                ]}
              />
            </div>
            <input
              type="text"
              value={formData.title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="請輸入公告標題"
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">內容</label>
              <HelpHint
                title="內容"
                description="公告完整內容區，建議包含：發生時間、地點/棟別、影響範圍、住戶需配合事項、聯絡窗口。這欄位會直接顯示給住戶閱讀。"
                workflow={[
                  "依序填寫時間、地點、影響範圍與住戶需配合事項。",
                  "補上聯絡窗口與處理時段，避免住戶無法追問。",
                  "發布前再校對一次內容是否可直接執行。",
                ]}
                logic={[
                  "內容為住戶主要依據，資訊不完整會造成後續詢問量上升。",
                  "清楚條列可降低現場執行誤差。",
                ]}
              />
            </div>
            <textarea
              value={formData.content || ""}
              onChange={(e) => onChange("content", e.target.value)}
              placeholder="請輸入公告內容"
              rows={4}
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)] resize-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">圖片</label>
              <HelpHint
                title="圖片"
                description="可上傳公告配圖（例如施工區域示意、活動海報）。有圖片時住戶更容易理解重點；未上傳也可以正常儲存與發布。"
                workflow={[
                  "點選檔案上傳圖片，確認檔名已顯示。",
                  "若要沿用既有圖片可不重新上傳。",
                  "儲存時系統會先處理圖片再寫入公告資料。",
                ]}
                logic={[
                  "圖片上傳失敗時不會進入儲存流程，避免公告資料不完整。",
                  "圖片屬輔助資訊，無圖片也可發布公告。",
                ]}
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onImageFileChange(e.target.files?.[0] || null)}
              className="w-full p-3 rounded-xl theme-input outline-none focus:border-[var(--theme-accent)]"
            />
            {imageFile && <div className="text-green-500 text-sm mt-1">已選擇: {imageFile.name}</div>}
            {formData.image_url && !imageFile && (
              <div className="text-[var(--theme-text-secondary)] text-sm mt-1 truncate">
                目前: {formData.image_url.substring(0, 50)}...
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">作者</label>
              <HelpHint
                title="作者"
                description="顯示公告發布者名稱，用於住戶辨識資訊來源。此欄位目前為系統帶入（唯讀），避免手動修改造成來源混淆。"
                workflow={[
                  "建立公告時先確認作者欄位是否正確顯示。",
                  "作者欄位為唯讀，不需手動修改。",
                  "若來源錯誤，請改由帳號權限或登入者設定修正。",
                ]}
                logic={[
                  "作者資訊用於責任追溯與住戶信任建立。",
                  "禁止手動改作者可避免冒名或來源混淆。",
                ]}
              />
            </div>
            <input
              type="text"
              value={formData.author_name || "管理員"}
              readOnly
              className="w-full p-3 rounded-xl theme-input outline-none bg-[var(--theme-bg-secondary)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[var(--theme-text-primary)] font-medium">狀態</label>
              <HelpHint
                title="狀態"
                description="草稿：僅管理端可見，適合先編輯與校稿。已發布：住戶端可見，會進入公告列表與相關展示區。發布前請再確認內容正確。"
                workflow={[
                  "初次建立建議先選草稿，完成校稿後再改為已發布。",
                  "確認內容與圖片無誤後切換為已發布。",
                  "發布後若需修正，可編輯後再次儲存。",
                ]}
                logic={[
                  "狀態會決定住戶端是否可見。",
                  "草稿可降低誤發風險，適合多人協作審閱。",
                ]}
              />
            </div>
            <select
              value={formData.status || "draft"}
              onChange={(e) => onChange("status", e.target.value)}
              className="w-full p-3 rounded-xl theme-select outline-none cursor-pointer"
            >
              <option value="draft">草稿</option>
              <option value="published">已發布</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex-1 py-3 bg-[var(--theme-accent)] text-[var(--theme-bg-primary)] rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  推播中...
                </>
              ) : (
                isEdit ? "儲存變更" : "新增公告"
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 border border-[var(--theme-border)] text-[var(--theme-text-primary)] rounded-xl font-semibold hover:bg-[var(--theme-bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 預覽模式的模擬資料
const PREVIEW_ANNOUNCEMENTS = [
  { id: "preview-1", title: "測試資料", content: "測試資料", author_name: "測試資料", status: "published", created_at: new Date().toISOString(), image_url: "" },
  { id: "preview-2", title: "測試資料", content: "測試資料", author_name: "測試資料", status: "published", created_at: new Date(Date.now() - 86400000).toISOString(), image_url: "" },
  { id: "preview-3", title: "測試資料", content: "測試資料", author_name: "測試資料", status: "draft", created_at: new Date(Date.now() - 2 * 86400000).toISOString(), image_url: "" },
]

interface AnnouncementManagementAdminProps {
  isPreviewMode?: boolean
}

export function AnnouncementManagementAdmin({ isPreviewMode = false }: AnnouncementManagementAdminProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState<Partial<Announcement>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const loadAnnouncements = async () => {
    setLoading(true)
    const { data, error } = await fetchAllAnnouncements()
    if (!error && data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isPreviewMode) {
      setAnnouncements(PREVIEW_ANNOUNCEMENTS as Announcement[])
      setLoading(false)
    } else {
      loadAnnouncements()
    }
  }, [isPreviewMode])

  const handleAdd = () => {
    setEditingAnnouncement(null)
    setFormData({ status: "published" })
    setImageFile(null)
    setIsModalOpen(true)
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setFormData(announcement)
    setImageFile(null)
    setIsModalOpen(true)
  }

  const handleFormChange = (field: keyof Announcement, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    console.log("[UI] 🔥 handleSave 被呼叫了");
    console.log("[UI] 📊 formData:", formData);
    console.log("[UI] 📝 editingAnnouncement:", !!editingAnnouncement);

    setIsSaving(true)
    try {
      const finalData = { ...formData }
      console.log("[UI] ✅ finalData 初始化:", finalData);

      if (imageFile) {
        try {
          console.log("[UI] ⏳ 上傳圖片...");
          const imageUrl = await uploadAnnouncementImage(imageFile)
          finalData.image_url = imageUrl
          console.log("[UI] ✅ 圖片上傳完成");
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError)
          alert("圖片上傳失敗，請稍後再試")
          setIsSaving(false)
          return
        }
      }

      if (editingAnnouncement) {
        console.log("[UI] 📝 編輯模式 - 呼叫 updateAnnouncement");
        const { error } = await updateAnnouncement(editingAnnouncement.id, finalData)
        if (error) {
          console.error("[UI] ❌ updateAnnouncement 失敗:", error)
          alert(`更新失敗: ${error.message || "未知錯誤"}`)
          setIsSaving(false)
          return
        }
        console.log("[UI] ✅ updateAnnouncement 成功");
        alert("公告已更新")
      } else {
        console.log("[UI] ➕ 新增模式 - 直接呼叫 /api/announce");
        console.log("[UI] 📤 finalData:", JSON.stringify(finalData));
        try {
          const res = await fetch("/api/announce", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: finalData.title,
              content: finalData.content,
              image_url: finalData.image_url,
              author: finalData.author_name || "管理委員會",
              pushOnly: false,
              test: false,
            }),
          })
          const payload = await res.json().catch(() => ({}))
          console.log("[UI] 📥 /api/announce 回應:", res.status, JSON.stringify(payload));
          if (!res.ok) {
            alert(`新增失敗: ${payload?.error || "未知錯誤"}`)
            setIsSaving(false)
            return
          }
          
          // 顯示統計推播結果
          const message = payload?.message || `已推播給 ${payload?.sent || 0} 人`
          console.log("[UI] ✅ 公告新增+推播成功，統計:", { sent: payload?.sent, skipped: payload?.skipped })
          alert(`公告已新增\n\n${message}`)
        } catch (fetchErr: any) {
          console.error("[UI] 💥 fetch /api/announce 失敗:", fetchErr);
          alert(`新增失敗: ${fetchErr?.message || "網路錯誤"}`)
          setIsSaving(false)
          return
        }
      }

      console.log("[UI] ✅ 儲存完成，刷新清單");
      setIsModalOpen(false)
      loadAnnouncements()
    } catch (error) {
      console.error("[UI] 💥 handleSave 拋出未捕捉的異常:", error)
      alert("儲存失敗，請稍後再試")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("確定要刪除此公告嗎？")) {
      await deleteAnnouncement(id)
      loadAnnouncements()
    }
  }

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      announcement.title?.toLowerCase().includes(term) ||
      announcement.content?.toLowerCase().includes(term) ||
      announcement.author_name?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex items-center gap-2 text-[var(--theme-accent)] text-xl">
          <span className="material-icons">campaign</span>
          公告管理
          <HelpHint
            title="公告管理"
            description="這裡是公告後台：可新增、編輯、刪除公告，並切換草稿/已發布。建議流程為『先草稿校對 → 確認內容無誤 → 改為已發布』，可降低誤發風險。"
            workflow={[
              "點「新增一筆」建立公告並先存成草稿。",
              "完成標題、內容、圖片與狀態設定後儲存。",
              "確認公告可對外後改為已發布；後續可再編輯或刪除。",
            ]}
            logic={[
              "管理端是公告生命週期中心：建立、修訂、發布、下線。",
              "發布狀態會直接影響住戶端可見內容。",
            ]}
          />
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[var(--theme-text-primary)] font-medium">搜尋</label>
            <HelpHint
              title="搜尋"
              description="可用關鍵字搜尋標題、內容、作者。適合快速找到舊公告，例如輸入『停水』『電梯』『活動』等字詞。"
              workflow={[
                "輸入關鍵字篩選公告資料。",
                "從結果中點選欲編輯或檢查的公告。",
                "查無結果時清空關鍵字回到完整清單。",
              ]}
              logic={[
                "搜尋僅影響列表顯示，不會修改公告資料。",
                "適合大量公告下快速定位目標。",
              ]}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-secondary)]" />
            <Input
              type="text"
              placeholder="搜尋標題、內容或作者..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={loadAnnouncements} disabled={loading || isPreviewMode}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            新增一筆
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[var(--theme-text-secondary)] py-12">載入中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
            <thead>
              <tr className="bg-[var(--theme-accent-light)]">
                <th className="w-[30%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>標題</span>
                    <HelpHint
                      title="標題欄"
                      description="顯示公告主題，用來快速辨識每筆公告。標題清楚時，管理者在大量資料中也能快速定位目標。"
                      workflow={[
                        "先看標題辨識公告主題。",
                        "搭配搜尋結果快速確認目標公告。",
                        "若標題不清楚，建議進入編輯補強。",
                      ]}
                      logic={[
                        "標題欄是列表的第一層辨識資訊。",
                        "良好命名可降低誤編輯機率。",
                      ]}
                    />
                  </div>
                </th>
                <th className="w-[25%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>內容</span>
                    <HelpHint
                      title="內容欄"
                      description="顯示公告內容摘要（列表會截斷）。若要檢視或調整完整內容，請使用右側編輯按鈕進入表單。"
                      workflow={[
                        "在列表先看摘要確認主題是否正確。",
                        "需要完整檢查時點編輯進入表單。",
                        "調整後儲存並回列表複核摘要。",
                      ]}
                      logic={[
                        "摘要為截斷顯示，不等同完整內容。",
                        "完整內容校正需透過編輯流程進行。",
                      ]}
                    />
                  </div>
                </th>
                <th className="w-[10%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>作者</span>
                    <HelpHint
                      title="作者欄"
                      description="顯示發布者名稱，方便追蹤公告來源與責任歸屬。住戶若有疑問，也可依此辨識聯繫對象。"
                      workflow={[
                        "檢查作者欄確認公告來源。",
                        "若來源異常，回到編輯或帳號設定檢查。",
                        "對外溝通時可依作者判斷窗口。",
                      ]}
                      logic={[
                        "作者欄是稽核與責任歸屬關鍵資料。",
                        "來源一致性有助於住戶建立信任。",
                      ]}
                    />
                  </div>
                </th>
                <th className="w-[10%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>狀態</span>
                    <HelpHint
                      title="狀態欄"
                      description="顯示公告目前狀態：草稿（僅管理端可見）或已發布（住戶可見）。可用來快速檢查哪些公告尚未對外發布。"
                      workflow={[
                        "先看狀態確認公告是否對住戶可見。",
                        "草稿需編輯完成後再改為已發布。",
                        "若需撤回公開內容，可改回草稿後儲存。",
                      ]}
                      logic={[
                        "狀態決定住戶端展示範圍。",
                        "列表檢查狀態可快速掌握發布進度。",
                      ]}
                    />
                  </div>
                </th>
                <th className="w-[12%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>建立日期</span>
                    <HelpHint
                      title="建立日期欄"
                      description="顯示公告建立日期，協助判斷資訊新舊與發布時序，避免誤用過期公告內容。"
                      workflow={[
                        "查看日期判斷公告新舊與時效性。",
                        "處理舊公告前先確認是否仍適用。",
                        "必要時更新內容或調整狀態。",
                      ]}
                      logic={[
                        "日期是判斷公告時效的重要依據。",
                        "可避免舊資訊持續誤導住戶。",
                      ]}
                    />
                  </div>
                </th>
                <th className="w-[13%] p-3 text-left text-[var(--theme-accent)] border-b border-[var(--theme-border)] whitespace-nowrap">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>操作</span>
                    <HelpHint
                      title="操作欄"
                      description="可對單筆公告執行編輯或刪除。建議刪除前先確認該公告是否仍需留存作為歷史紀錄。"
                      workflow={[
                        "點鉛筆按鈕進入編輯，修正後儲存。",
                        "點垃圾桶前先確認公告是否可刪除。",
                        "刪除後回列表確認資料已移除。",
                      ]}
                      logic={[
                        "編輯適合內容更新；刪除適合誤建或確定不保留資料。",
                        "刪除是高風險操作，建議保留必要歷史紀錄。",
                      ]}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAnnouncements.length > 0 ? (
                filteredAnnouncements.map((announcement) => (
                  <tr key={announcement.id} className="hover:bg-[var(--theme-accent-light)] transition-colors">
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      <div className="truncate" title={announcement.title}>{announcement.title}</div>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      <div className="line-clamp-2">{announcement.content}</div>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)]">
                      <div className="truncate" title={announcement.author_name || "管理員"}>{announcement.author_name || "管理員"}</div>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)]">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          announcement.status === "published"
                            ? "bg-green-500/20 text-green-500"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {announcement.status === "published" ? "已發布" : "草稿"}
                      </span>
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] whitespace-nowrap">
                      {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                    </td>
                    <td className="p-3 border-b border-[var(--theme-border)] whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="p-2 rounded-lg border border-[var(--theme-btn-save-border)] text-[var(--theme-btn-save-text)] hover:bg-[var(--theme-btn-save-hover)] transition-all"
                          title="編輯"
                        >
                          <span className="material-icons text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
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
                    {searchTerm ? "沒有符合條件的公告資料" : "目前沒有公告資料"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnnouncementFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onChange={handleFormChange}
        onSave={handleSave}
        isEdit={!!editingAnnouncement}
        onImageFileChange={setImageFile}
        imageFile={imageFile}
        isSaving={isSaving}
      />
    </div>
  )
}
