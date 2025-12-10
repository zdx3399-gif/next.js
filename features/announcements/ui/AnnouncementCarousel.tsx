"use client"

import { useState, useEffect } from "react"
import type { Announcement } from "../api/announcements"

interface AnnouncementCarouselProps {
  announcements: Announcement[]
  onSelect?: (announcementId: string) => void
  onLike?: (announcementId: string) => void
  likes?: any[]
  currentUserId?: string
  loading?: boolean
}

export function AnnouncementCarousel({
  announcements,
  onSelect,
  onLike,
  likes = [],
  currentUserId,
  loading = false,
}: AnnouncementCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (announcements.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % announcements.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [announcements.length])

  if (loading) {
    return (
      <section className="mb-6 sm:mb-8">
        <div className="relative w-full h-[350px] sm:h-[600px] overflow-hidden rounded-2xl shadow-2xl flex items-center justify-center bg-[var(--theme-bg-card)]">
          <div className="text-[var(--theme-accent)] text-lg">載入中...</div>
        </div>
      </section>
    )
  }

  if (announcements.length === 0) return null

  return (
    <section className="mb-6 sm:mb-8">
      <div className="relative w-full h-[350px] sm:h-[600px] overflow-hidden rounded-2xl shadow-2xl group">
        {announcements.map((announcement, idx) => {
          const announcementLikesArray = likes.filter((like) => like.announcement_id === announcement.id)
          const likesCount = announcementLikesArray.length
          const hasLiked = currentUserId ? announcementLikesArray.some((like) => like.user_id === currentUserId) : false

          return (
            <div
              key={announcement.id}
              className={`absolute w-full h-full transition-opacity duration-700 bg-cover bg-center flex items-end ${
                idx === currentSlide ? "opacity-100" : "opacity-0"
              }`}
              style={{ backgroundImage: `url('${announcement.image_url}')` }}
            >
              <div className="bg-black/40 backdrop-blur-md p-4 sm:p-6 md:p-8 rounded-xl w-full">
                <div
                  className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--theme-accent)] mb-2 sm:mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onSelect?.(announcement.id)}
                >
                  {announcement.title}
                </div>
                <div className="text-white text-sm sm:text-base md:text-lg mb-2 sm:mb-4 leading-relaxed line-clamp-2 sm:line-clamp-3 whitespace-pre-wrap">
                  {announcement.content.slice(0, 200).split("\\n").join("\n")}
                  {announcement.content.length > 200 ? "..." : ""}
                </div>
                <div className="text-[var(--theme-text-muted)] text-xs sm:text-sm mb-3 sm:mb-4">
                  發布者: {announcement.author_name || "管理員"} |{" "}
                  {new Date(announcement.created_at).toLocaleDateString("zh-TW")}
                </div>
                {onLike && (
                  <button
                    onClick={() => onLike(announcement.id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm transition-all ${
                      hasLiked
                        ? "bg-[var(--theme-accent)] text-[var(--theme-bg-primary)]"
                        : "bg-white/20 text-[var(--theme-accent)] hover:bg-white/30"
                    }`}
                  >
                    <span className="material-icons text-base">favorite</span>
                    <span>{likesCount}</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {announcements.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 sm:h-3 rounded-full cursor-pointer transition-all ${
                idx === currentSlide
                  ? "w-6 sm:w-8 bg-[var(--theme-accent)]"
                  : "w-2 sm:w-3 bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
