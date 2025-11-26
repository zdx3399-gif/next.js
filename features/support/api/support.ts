// Support API - 客服相關的 API 操作
// 目前 AI 客服使用本地邏輯回應，未來可擴展為：
// 1. 儲存對話紀錄到資料庫
// 2. 連接真實 AI 服務 (OpenAI, etc.)
// 3. 管理員查看客服對話紀錄

import { getSupabaseClient } from "@/lib/supabase"

export interface ChatMessage {
  id?: string
  user_id: string
  user_name: string
  message: string
  response: string
  created_at?: string
}

// 儲存對話紀錄（可選功能）
export async function saveChatHistory(chat: Omit<ChatMessage, "id" | "created_at">): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("chat_history").insert([chat])

  if (error) {
    console.error("Error saving chat history:", error)
    return false
  }

  return true
}

// 獲取使用者對話紀錄
export async function fetchUserChatHistory(userId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("chat_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Error fetching chat history:", error)
    return []
  }

  return data || []
}

// AI 回應邏輯（本地處理）
export function getAIResponse(message: string): string {
  const msg = message.toLowerCase()

  if (msg.includes("公告")) {
    return "您可以在「公告」頁面查看最新公告。公告會以輪播方式顯示在首頁。"
  }
  if (msg.includes("投票")) {
    return "您可以在「投票」頁面查看所有投票並參與投票。每個投票都會顯示即時統計結果。"
  }
  if (msg.includes("維修") || msg.includes("報修")) {
    return "您可以在「設備/維護」頁面提交維修申請，包括設備名稱、問題描述和照片。提交後可以在「我的維修申請」中查看處理狀態。"
  }
  if (msg.includes("包裹") || msg.includes("快遞")) {
    return "您可以在「我的包裹」頁面查看包裹領取狀況，包括快遞公司、追蹤號碼和到達時間。"
  }
  if (msg.includes("管理費") || msg.includes("繳費")) {
    return "您可以在「管理費/收支」頁面查看繳費狀況。如有問題請聯繫管委會。"
  }
  if (msg.includes("個人") || msg.includes("資料") || msg.includes("密碼")) {
    return "您可以在「個人資料」頁面修改姓名、房號、電話、Email 和密碼。"
  }
  if (msg.includes("設施") || msg.includes("預約")) {
    return "您可以在「設施預約」頁面預約健身房、會議室等公共設施。"
  }
  if (msg.includes("訪客")) {
    return "您可以在「訪客」頁面預約訪客來訪，並查看訪客紀錄。"
  }
  if (msg.includes("會議") || msg.includes("活動")) {
    return "您可以在「會議/活動」頁面查看即將舉行的社區會議和活動。"
  }
  if (msg.includes("緊急") || msg.includes("報警") || msg.includes("救護")) {
    return "緊急事件請使用首頁或「緊急事件」頁面的緊急按鈕。包括：救護車119、報警110、AED、可疑人員通報。"
  }

  return "抱歉，我還在學習中。您可以詢問關於公告、維修、繳費、包裹、設施預約、訪客、會議活動等問題，或使用「常用功能」快速導航。"
}
