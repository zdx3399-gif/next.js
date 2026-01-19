"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { User } from "@/features/profile/api/profile"

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
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>分類</Label>
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
            <Label>顯示方式</Label>
            <Select value={displayMode} onValueChange={setDisplayMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semi_anonymous">��匿名（住戶#編號）- 推薦</SelectItem>
                <SelectItem value="anonymous">完全匿名</SelectItem>
                <SelectItem value="real_name">實名顯示</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">系統內部可追溯身份，僅對外顯示方式不同</p>
          </div>

          <div>
            <Label>標題</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="請輸入標題..."
              maxLength={100}
            />
          </div>

          <div>
            <Label>內容</Label>
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
