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
  if (!supabase) {
    console.error("Supabase client not available")
    return false
  }
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
  if (!supabase) {
    console.error("Supabase client not available")
    return []
  }
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
export async function getAIResponse(message: string): Promise<{ answer: string; images?: string[]; chatId?: number | null } | string> {
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
    
    // 回傳完整物件，包含 answer、images 和 chatId
    return {
      answer: data.answer || '抱歉，我無法回答這個問題。',
      images: data.images || [],
      chatId: data.chatId || null
    };
  } catch (error) {
    console.error('AI API 錯誤:', error);
    return '抱歉，AI 服務暫時無法使用，請稍後再試。';
  }
}

// AI 串流回應（含思考狀態更新）
export async function getAIResponseStream(
  message: string,
  onStatus: (status: string) => void
): Promise<{ answer: string; images?: string[]; chatId?: number | null } | string> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:3001';

    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error('API 請求失敗');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('無法讀取串流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 格式的行
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成的最後一行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const payload = JSON.parse(trimmed.slice(6));

          if (payload.type === 'status') {
            onStatus(payload.status);
          } else if (payload.type === 'result') {
            return {
              answer: payload.answer || '抱歉，我無法回答這個問題。',
              images: payload.images || [],
              chatId: payload.chatId || null,
            };
          } else if (payload.type === 'error') {
            throw new Error(payload.error);
          }
        } catch (parseErr) {
          // 忽略解析失敗的行
        }
      }
    }

    return '抱歉，回應中斷，請稍後再試。';
  } catch (error) {
    console.error('AI Stream API 錯誤:', error);
    return '抱歉，AI 服務暫時無法使用，請稍後再試。';
  }
}
