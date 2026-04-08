"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { User } from "@/features/profile/api/profile"
import { HelpHint } from "@/components/ui/help-hint"

interface CreatePostDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (post: {
    author_id: string
    category: string
    display_mode: string
    title: string
    content: string
    structured_data?: any
  }) => Promise<any>
  currentUser: User
}

export function CreatePostDialog({ open, onClose, onSubmit, currentUser }: CreatePostDialogProps) {
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>("case")
  const [displayMode, setDisplayMode] = useState<string>("semi_anonymous")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert("請填寫標題和內容")
      return
    }

    setLoading(true)
    try {
      const result = await onSubmit({
        author_id: currentUser.id,
        category,
        display_mode: displayMode,
        title: title.trim(),
        content: content.trim(),
      })
      setTitle("")
      setContent("")
      onClose()
    } catch (error: any) {
      alert(`發文失敗: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <span className="material-icons">edit_note</span>
            發表新貼文
            <HelpHint title="住戶端發文" description="請先選擇分類與顯示方式，再輸入標題與內容。" workflow={["先選分類與顯示方式。","再填標題與內容後送出。"]} logic={["完整欄位可提高審核效率與可讀性。"]} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="flex items-center gap-2">分類<HelpHint title="住戶端分類" description="分類會影響其他住戶瀏覽與搜尋。" workflow={["依內容主題選擇分類。"]} logic={["案例：分享事件經過與解法。","教學：提供可重複的操作步驟。","意見：提出看法與討論建議。","警示：提醒風險與重要異常。"]} align="center" /></Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="case">案例分享 - 分享問題解決經驗</SelectItem>
                <SelectItem value="howto">解法教學 - 提供操作步驟</SelectItem>
                <SelectItem value="opinion">意見討論 - 交流想法與建議</SelectItem>
                <SelectItem value="alert">警示爆料 - 重要事件提醒</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="flex items-center gap-2">顯示方式<HelpHint title="住戶端顯示方式" description="可選半匿名、完全匿名或實名；系統皆可追溯身份。" workflow={["選擇實名或匿名顯示模式。","確認可見身份再發文。"]} logic={["半匿名：顯示住戶#編號，兼顧辨識與隱私。","完全匿名：前台不顯示身份資訊。","實名：顯示名稱，利於公開討論。","三種模式都可由後台依規範追溯。"]} align="center" /></Label>
            <Select value={displayMode} onValueChange={setDisplayMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semi_anonymous">匿名（住戶#編號）- 推薦</SelectItem>
                <SelectItem value="anonymous">完全匿名</SelectItem>
                <SelectItem value="real_name">實名顯示</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">系統內部可追溯身份，僅對外顯示方式不同</p>
          </div>

          <div>
            <Label className="flex items-center gap-2">標題<HelpHint title="住戶端標題" description="建議用一句話清楚描述主題。" workflow={["用一句話描述核心重點。"]} logic={["清晰標題有助其他住戶快速判讀。"]} align="center" /></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="請輸入標題..."
              maxLength={100}
            />
          </div>

          <div>
            <Label className="flex items-center gap-2">內容<HelpHint title="住戶端內容" description="請避免個資與人身攻擊，必要時先做資訊遮蔽。" workflow={["先完成內容描述。","送出前檢查是否包含敏感資訊。"]} logic={["內容合規可降低被檢舉與下架風險。"]} align="center" /></Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="請輸入內容...&#10;&#10;注意事項：&#10;- 請勿包含完整個資（姓名、電話、地址、車牌）&#10;- 避免指名道姓或戶號&#10;- 圖片請遮蔽敏感資訊"
              rows={8}
              className="resize-none"
            />
          </div>

          {category === "alert" && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              <p className="text-sm text-orange-600 flex gap-2 items-start">
                <span className="material-icons text-sm">warning</span>
                <span>警示類貼文將優先進入人工審核，確保內容合規。請確實遮蔽個資，避免指名道姓。</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "發佈中..." : "發佈"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreatePostDialog
