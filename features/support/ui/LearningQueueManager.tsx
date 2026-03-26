'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  MessageSquare,
} from 'lucide-react'

interface QueueItem {
  id: number
  created_at: string
  question: string
  answer: string
  similarity: number
  search_method: string
  match_count: number
  issue_type: string
  priority: number
  review_status: string
  admin_notes: string | null
  rating: number | null
  feedback: string | null
  needs_review: boolean
}

export function LearningQueueManager() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [filter, setFilter] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')

  useEffect(() => {
    fetchQueue()
  }, [filter])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `http://localhost:3001/api/learning-queue?status=${filter}&limit=50`
      )
      const data = await response.json()
      if (data.success) {
        setQueue(data.data)
      }
    } catch (error) {
      console.error('載入佇列失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (
    id: number,
    newStatus: string,
    resolutionType?: string
  ) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/learning-queue/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            adminNotes: resolutionNotes || null,
          }),
        }
      )

      const data = await response.json()
      if (data.success) {
        fetchQueue()
        setSelectedItem(null)
        setResolutionNotes('')
      }
    } catch (error) {
      console.error('更新狀態失敗:', error)
    }
  }

  const getIssueTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      low_similarity: '低相似度',
      no_match: '無匹配',
      fallback: 'API 失敗',
      low_rating: '低評分',
      user_report: '用戶回報',
    }
    return labels[type] || type
  }

  const getIssueTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      low_similarity: 'bg-yellow-100 text-yellow-800',
      no_match: 'bg-red-100 text-red-800',
      fallback: 'bg-orange-100 text-orange-800',
      low_rating: 'bg-purple-100 text-purple-800',
      user_report: 'bg-blue-100 text-blue-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'text-red-600 font-bold'
    if (priority <= 5) return 'text-yellow-600 font-medium'
    return 'text-gray-500'
  }

  return (
    <div className="space-y-4">
      {/* 標題和篩選 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">智能學習佇列</h2>
          <p className="text-sm text-gray-500">
            自動識別需要改進的問題，優化 AI 回答品質
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">待處理</SelectItem>
            <SelectItem value="in_progress">處理中</SelectItem>
            <SelectItem value="resolved">已解決</SelectItem>
            <SelectItem value="dismissed">已忽略</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 佇列列表 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">載入中...</div>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>目前沒有{filter === 'pending' ? '待處理的' : ''}項目</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedItem(item)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getIssueTypeColor(item.issue_type)}>
                        {getIssueTypeLabel(item.issue_type)}
                      </Badge>
                      <span className={`text-sm ${getPriorityColor(item.priority)}`}>
                        優先級: {item.priority}
                      </span>
                      {item.rating && (
                        <Badge variant="outline">
                          ⭐ {item.rating} 星
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-medium mb-1">{item.question}</h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {item.answer}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleString('zh-TW')}
                      </span>
                      <span>
                        相似度: {(item.similarity * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 展開詳細資訊 */}
                {selectedItem?.id === item.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        原始問題：
                      </label>
                      <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                        {item.question}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        AI 回答：
                      </label>
                      <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                        {item.answer}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        處理說明：
                      </label>
                      <Textarea
                        placeholder="記錄處理方式、新增的知識、改進建議等..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateStatus(item.id, 'in_progress')
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        處理中
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateStatus(item.id, 'resolved', 'add_knowledge')
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        已解決
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateStatus(item.id, 'dismissed')
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        忽略
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
