"use client"

import { useCallback, useEffect, useState } from "react"
import { Search, Plus, RefreshCw, Pencil, Trash2, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { User } from "@/features/profile/api/profile"
import { HelpHint } from "@/components/ui/help-hint"
import {
  createHandoverCard,
  deleteHandoverCard,
  getHandoverCards,
  type HandoverKnowledgeCard,
  updateHandoverCard,
} from "../api/handover"

interface HandoverKnowledgeAdminProps {
  currentUser: User | null
  isPreviewMode?: boolean
}

const CATEGORY_OPTIONS = [
  { value: "all", label: "全部分類" },
  { value: "rules", label: "行政/法規" },
  { value: "fee", label: "財務" },
  { value: "repair", label: "維修/廠商" },
  { value: "visitor", label: "人員與進出" },
  { value: "facility", label: "設施" },
  { value: "package", label: "包裹" },
  { value: "emergency", label: "危機應變" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "全部狀態" },
  { value: "active", label: "已發布" },
  { value: "archived", label: "已封存" },
  { value: "unverified", label: "待驗證" },
]

const statusLabelMap: Record<string, string> = {
  active: "已發布",
  archived: "已封存",
  unverified: "待驗證",
  removed: "已移除",
}

const categoryBadgeClassMap: Record<string, string> = {
  rules: "bg-blue-500/20 text-blue-500 border-blue-500/50",
  fee: "bg-emerald-500/20 text-emerald-500 border-emerald-500/50",
  repair: "bg-amber-500/20 text-amber-500 border-amber-500/50",
  visitor: "bg-cyan-500/20 text-cyan-500 border-cyan-500/50",
  facility: "bg-violet-500/20 text-violet-500 border-violet-500/50",
  package: "bg-indigo-500/20 text-indigo-500 border-indigo-500/50",
  emergency: "bg-red-500/20 text-red-500 border-red-500/50",
}

const PREVIEW_HANDOVER_CARDS: HandoverKnowledgeCard[] = [
  {
    id: "preview-handover-1",
    title: "測試資料",
    summary: "測試資料",
    category: "visitor",
    status: "active",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    view_count: 86,
    helpful_count: 18,
    not_helpful_count: 1,
  },
  {
    id: "preview-handover-2",
    title: "測試資料",
    summary: "測試資料",
    category: "fee",
    status: "unverified",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    view_count: 54,
    helpful_count: 10,
    not_helpful_count: 0,
  },
]

export function HandoverKnowledgeAdmin({ currentUser, isPreviewMode = false }: HandoverKnowledgeAdminProps) {
  const [cards, setCards] = useState<HandoverKnowledgeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCard, setSelectedCard] = useState<HandoverKnowledgeCard | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    category: "rules",
  })

  const loadCards = useCallback(async () => {
    setLoading(true)
    if (isPreviewMode) {
      const filtered = PREVIEW_HANDOVER_CARDS.filter((card) => {
        const matchCategory = category === "all" || card.category === category
        const matchStatus = status === "all" || card.status === status
        const matchSearch =
          !search.trim() ||
          card.title.toLowerCase().includes(search.trim().toLowerCase()) ||
          card.summary.toLowerCase().includes(search.trim().toLowerCase())
        return matchCategory && matchStatus && matchSearch
      })
      setCards(filtered)
      setLoading(false)
      return
    }

    try {
      const data = await getHandoverCards({ category, status, search: search.trim() || undefined })
      setCards(data)
    } catch (error) {
      console.error("[handover] load cards failed", error)
      alert("載入交接知識庫失敗")
    } finally {
      setLoading(false)
    }
  }, [category, isPreviewMode, search, status])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  const handleCreateCard = async () => {
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!currentUser) return
    if (!formData.title.trim() || !formData.summary.trim()) {
      alert("請填寫標題與摘要")
      return
    }

    setSubmitting(true)
    try {
      await createHandoverCard({
        title: formData.title.trim(),
        summary: formData.summary.trim(),
        category: formData.category,
        createdBy: currentUser.id,
      })

      setShowCreateDialog(false)
      setFormData({ title: "", summary: "", category: "rules" })
      await loadCards()
      alert("交接知識已新增至資料庫")
    } catch (error: any) {
      alert(`新增失敗：${error?.message || "未知錯誤"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (card: HandoverKnowledgeCard) => {
    setSelectedCard(card)
    setFormData({
      title: card.title,
      summary: card.summary,
      category: card.category,
    })
    setShowEditDialog(true)
  }

  const handleEditCard = async () => {
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!selectedCard) return
    if (!formData.title.trim() || !formData.summary.trim()) {
      alert("請填寫標題與摘要")
      return
    }

    setSubmitting(true)
    try {
      await updateHandoverCard(selectedCard.id, {
        title: formData.title.trim(),
        summary: formData.summary.trim(),
        category: formData.category,
      })
      setShowEditDialog(false)
      setSelectedCard(null)
      setFormData({ title: "", summary: "", category: "rules" })
      await loadCards()
      alert("交接知識已更新")
    } catch (error: any) {
      alert(`更新失敗：${error?.message || "未知錯誤"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (card: HandoverKnowledgeCard) => {
    setSelectedCard(card)
    setShowDeleteDialog(true)
  }

  const handleDeleteCard = async () => {
    if (isPreviewMode) {
      alert("預覽模式僅供檢視，不會寫入資料庫")
      return
    }
    if (!selectedCard) return

    setSubmitting(true)
    try {
      await deleteHandoverCard(selectedCard.id)
      setShowDeleteDialog(false)
      setSelectedCard(null)
      await loadCards()
      alert("交接知識已刪除")
    } catch (error: any) {
      alert(`刪除失敗：${error?.message || "未知錯誤"}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">搜尋交接知識</span>
            <HelpHint
              title="交接知識管理"
              description="交接知識庫為獨立後台頁，內容會寫入資料庫並可持續查詢與維護。"
              workflow={[
                "輸入標題或摘要關鍵字快速定位資料。",
                "以分類與狀態篩選縮小範圍後再編輯或刪除。",
                "新增條目後可隨時回來維護更新。",
              ]}
              logic={[
                "每筆交接知識都會綁定分類與狀態，便於交接時快速盤點。",
                "編輯會更新原資料；刪除會直接移除該筆資料。",
              ]}
              align="center"
            />
          </div>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋交接知識..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadCards} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} disabled={!currentUser || isPreviewMode}>
            <Plus className="w-4 h-4 mr-2" />
            新增交接知識
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">分類篩選</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={category === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(option.value)}
            className={category === option.value ? "bg-primary text-primary-foreground" : ""}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-sm text-muted-foreground">狀態：</span>
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={status === option.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">載入中...</div>
        ) : cards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">目前沒有交接知識資料</div>
        ) : (
          <>
            {cards.map((card) => (
              <div key={card.id} className="bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={categoryBadgeClassMap[card.category] || "bg-gray-500/20 text-gray-500 border-gray-500/50"}
                      >
                        {CATEGORY_OPTIONS.find((option) => option.value === card.category)?.label || card.category}
                      </Badge>
                      <Badge variant="outline">{statusLabelMap[card.status] || card.status}</Badge>
                    </div>
                    <h4 className="font-semibold text-foreground">{card.title}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{card.summary}</p>
                    <div className="text-xs text-muted-foreground mt-2">
                      建立時間：{new Date(card.created_at).toLocaleString("zh-TW")}
                    </div>
                  </div>

                  {!isPreviewMode && currentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(card)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          編輯
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(card)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              新增交接知識
              <HelpHint
                title="新增交接知識"
                description="建立可供管理端交接使用的標準化內容。"
                workflow={["填寫標題、摘要與分類。", "確認內容可直接執行後送出。"]}
                logic={["新增後會直接寫入資料庫，供後續查詢與維護。"]}
                align="center"
              />
            </DialogTitle>
            <DialogDescription>建立新的交接知識卡</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>標題</Label>
              <Input
                value={formData.title}
                onChange={(event) => setFormData((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="例如：管理費催繳三階段"
              />
            </div>
            <div>
              <Label>分類</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((previous) => ({ ...previous, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>摘要 / 流程內容</Label>
              <Textarea
                rows={8}
                value={formData.summary}
                onChange={(event) => setFormData((previous) => ({ ...previous, summary: event.target.value }))}
                placeholder="請輸入交接流程內容"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleCreateCard} disabled={submitting}>
              {submitting ? "新增中..." : "確認新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              編輯交接知識
              <HelpHint
                title="編輯交接知識"
                description="更新交接內容後，系統會直接覆蓋該筆資料。"
                workflow={["修改標題、摘要或分類。", "儲存後回列表確認內容更新。"]}
                logic={["請維持內容可執行與可交接，避免僅描述背景。"]}
                align="center"
              />
            </DialogTitle>
            <DialogDescription>修改既有交接知識內容</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>標題</Label>
              <Input
                value={formData.title}
                onChange={(event) => setFormData((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="請輸入標題"
              />
            </div>
            <div>
              <Label>分類</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((previous) => ({ ...previous, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>摘要 / 流程內容</Label>
              <Textarea
                rows={8}
                value={formData.summary}
                onChange={(event) => setFormData((previous) => ({ ...previous, summary: event.target.value }))}
                placeholder="請輸入交接流程內容"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleEditCard} disabled={submitting}>
              {submitting ? "更新中..." : "確認更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除交接知識</DialogTitle>
            <DialogDescription>
              確定要刪除「{selectedCard?.title || "此筆資料"}」嗎？刪除後無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={submitting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteCard} disabled={submitting}>
              {submitting ? "刪除中..." : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
