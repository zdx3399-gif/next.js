"use client"

interface AiChatButtonProps {
  onClick: () => void
  isOpen: boolean
}

export function AiChatButton({ onClick, isOpen }: AiChatButtonProps) {
  if (isOpen) return null

  return (
    <div
      onClick={onClick}
      className="fixed bottom-8 right-8 w-[70px] h-[70px] rounded-2xl bg-[var(--theme-accent)] border-[3px] border-[var(--theme-bg-primary)] cursor-pointer flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:scale-110 hover:shadow-[0_6px_30px_var(--theme-accent-glow)] transition-all z-[1000]"
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
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
