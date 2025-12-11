"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"

interface AiChatButtonProps {
  onClick: () => void
  isOpen: boolean
  position: { x: number; y: number }
  onDrag: (position: { x: number; y: number }) => void
}

export function AiChatButton({ onClick, isOpen, position, onDrag }: AiChatButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hasMoved, setHasMoved] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // 限制在視窗範圍內
      const maxX = window.innerWidth - 70
      const maxY = window.innerHeight - 70

      const boundedX = Math.max(0, Math.min(newX, maxX))
      const boundedY = Math.max(0, Math.min(newY, maxY))

      if (
        Math.abs(e.clientX - (dragStart.x + position.x)) > 5 ||
        Math.abs(e.clientY - (dragStart.y + position.y)) > 5
      ) {
        setHasMoved(true)
      }

      onDrag({ x: boundedX, y: boundedY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return
      const touch = e.touches[0]

      const newX = touch.clientX - dragStart.x
      const newY = touch.clientY - dragStart.y

      const maxX = window.innerWidth - 70
      const maxY = window.innerHeight - 70

      const boundedX = Math.max(0, Math.min(newX, maxX))
      const boundedY = Math.max(0, Math.min(newY, maxY))

      if (
        Math.abs(touch.clientX - (dragStart.x + position.x)) > 5 ||
        Math.abs(touch.clientY - (dragStart.y + position.y)) > 5
      ) {
        setHasMoved(true)
      }

      onDrag({ x: boundedX, y: boundedY })
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      window.addEventListener("touchmove", handleTouchMove)
      window.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, dragStart, onDrag, position])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setHasMoved(false)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setIsDragging(true)
    setHasMoved(false)
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
  }

  const handleClick = () => {
    if (!hasMoved) {
      onClick()
    }
  }

  if (isOpen) return null

  return (
    <div
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      className="w-[70px] h-[70px] rounded-2xl bg-[var(--theme-accent)] border-[3px] border-[var(--theme-bg-primary)] flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:scale-110 hover:shadow-[0_6px_30px_var(--theme-accent-glow)] transition-transform z-[1000] select-none"
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 pointer-events-none">
        <rect x="7" y="5" width="10" height="12" rx="2" fill="var(--theme-bg-primary)" />
        <circle cx="10" cy="8" r="1" fill="var(--theme-accent)" />
        <circle cx="14" cy="8" r="1" fill="var(--theme-accent)" />
        <path
          d="M12 17C13.1046 17 14 17.8954 14 19C14 20.1046 13.1046 21 12 21C10.8954 21 10 20.1046 10 19C10 17.8954 10.8954 17 12 17Z"
          fill="var(--theme-accent)"
        />
      </svg>
    </div>
  )
}
