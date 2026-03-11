'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Star, ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react'

interface ChatFeedbackProps {
  chatId: number
  alreadyRated?: boolean
  onFeedbackSubmit?: (chatId: number) => void
}

export function ChatFeedback({ chatId, alreadyRated = false, onFeedbackSubmit }: ChatFeedbackProps) {
  const [rating, setRating] = useState<number>(0)
  const [hoveredRating, setHoveredRating] = useState<number>(0)
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null)
  const [comment, setComment] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [submitted, setSubmitted] = useState(alreadyRated)

  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (submitted || alreadyRated) return
    if (rating === 0) {
      setSubmitError('請選擇評分')
      return
    }
    setSubmitError(null)

    setIsSubmitting(true)
    try {
      const response = await fetch('http://localhost:3001/api/chat/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          rating,
          isHelpful,
          comment: comment.trim() || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitted(true)
        setSubmitError(null)
        setTimeout(() => {
          setIsOpen(false)
          onFeedbackSubmit?.(chatId)
        }, 1500)
      } else if (data.error === 'already_rated') {
        setSubmitted(true)
        setSubmitError(null)
        setIsOpen(false)
        onFeedbackSubmit?.(chatId)
      } else {
        setSubmitError('提交失敗，請稍後再試')
      }
    } catch (error) {
      console.error('提交回饋錯誤:', error)
      setSubmitError('提交失敗，請檢查網路連線')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 👍 快速提交正向回饋（不開 Dialog）
  const handleQuickPositive = async () => {
    if (submitted || alreadyRated || isSubmitting) return
    setIsSubmitting(true)
    try {
      const response = await fetch('http://localhost:3001/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, rating: 5, isHelpful: true, comment: null }),
      })
      const data = await response.json()
      if (data.success || data.error === 'already_rated') {
        setSubmitted(true)
        setRating(5)
        setIsHelpful(true)
        onFeedbackSubmit?.(chatId)
      }
    } catch (error) {
      console.error('快速回饋錯誤:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted || alreadyRated) {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
        <CheckCircle className="h-3.5 w-3.5" />
        <span>已評價{rating > 0 ? ` (${rating}★)` : ''}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      {/* 快速評價按鈕 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">這個回答有幫助嗎？</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleQuickPositive}
          disabled={isSubmitting}
          className="h-7 px-2"
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsHelpful(false)
            setRating(2)
            setIsOpen(true)
          }}
          disabled={isSubmitting}
          className="h-7 px-2"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>

      {/* 詳細回饋對話框 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            詳細評價
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>回饋評價</DialogTitle>
            <DialogDescription>
              您的回饋將幫助我們改進 AI 助理的回答品質
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="text-center py-8">
              <div className="text-green-500 text-5xl mb-4">✓</div>
              <p className="text-lg font-medium">感謝您的回饋！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 星級評分 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  整體評分 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= (hoveredRating || rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {rating === 0 && '請點選星星評分'}
                  {rating === 1 && '非常不滿意'}
                  {rating === 2 && '不滿意'}
                  {rating === 3 && '普通'}
                  {rating === 4 && '滿意'}
                  {rating === 5 && '非常滿意'}
                </p>
              </div>

              {/* 是否有幫助 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  這個回答有幫助嗎？
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={isHelpful === true ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsHelpful(true)}
                    className="flex-1"
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    有幫助
                  </Button>
                  <Button
                    type="button"
                    variant={isHelpful === false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsHelpful(false)}
                    className="flex-1"
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    沒幫助
                  </Button>
                </div>
              </div>

              {/* 文字評論 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  其他意見（選填）
                </label>
                <Textarea
                  placeholder="例如：回答不夠詳細、圖片沒有顯示、找不到我要的資訊..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {comment.length}/500
                </p>
              </div>

              {/* 錯誤訊息 */}
              {submitError && (
                <p className="text-sm text-red-500 text-center">{submitError}</p>
              )}

              {/* 提交按鈕 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setIsOpen(false); setSubmitError(null) }}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1"
                  disabled={isSubmitting || rating === 0}
                >
                  {isSubmitting ? '提交中...' : '提交回饋'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
