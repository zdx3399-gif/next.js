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

// AI 回應邏輯 - 呼叫後端 RAG API
export async function getAIResponse(message: string): Promise<{ answer: string; images?: string[] } | string> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error('API 請求失敗');
    }

    const data = await response.json();
    
    // 回傳完整物件，包含 answer 和 images
    return {
      answer: data.answer || '抱歉，我無法回答這個問題。',
      images: data.images || []
    };
  } catch (error) {
    console.error('AI API 錯誤:', error);
    return '抱歉，AI 服務暫時無法使用，請稍後再試。';
  }
}
