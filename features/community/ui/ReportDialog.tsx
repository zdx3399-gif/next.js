"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ReportDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (report: {
    reporter_id: string
    target_type: string
    target_id: string
    reason: string
    description?: string
  }) => Promise<any>
  targetType: string
  targetId: string
  reporterId: string
}

export function ReportDialog({ open, onClose, onSubmit, targetType, targetId, reporterId }: ReportDialogProps) {
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState<string>("spam")
  const [description, setDescription] = useState("")

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const result = await onSubmit({
        reporter_id: reporterId,
        target_type: targetType,
        target_id: targetId,
        reason,
        description: description.trim() || undefined,
      })
      if (result) {
        alert("檢舉已送出，管理方將盡快審核")
      }
    } catch (error: any) {
      alert(`檢舉失敗: ${error.message}`)
    } finally {
      setLoading(false)
      setDescription("")
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <span className="material-icons">flag</span>
            檢舉內容
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>檢舉原因</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pii">包含個人資料</SelectItem>
                <SelectItem value="defamation">誹謗中傷</SelectItem>
                <SelectItem value="harassment">騷擾攻擊</SelectItem>
                <SelectItem value="misinformation">不實資訊</SelectItem>
                <SelectItem value="spam">垃圾訊息</SelectItem>
                <SelectItem value="hate_speech">仇恨言論</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>詳細說明（選填）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="請說明檢舉原因..."
              rows={4}
            />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-xs text-yellow-600">檢舉將由管理方審核。濫用檢舉功能可能影響您的信用分。</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "送出中..." : "送出檢舉"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
