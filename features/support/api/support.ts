// Support API - 客服相關的 API 操作
// 目前 AI 客服使用本地邏輯回應，未來可擴展為：
// 1. 儲存對話紀錄到資料庫
// 2. 連接真實 AI 服務 (OpenAI, etc.)
// 3. 管理員查看客服對話紀錄

import { getSupabaseClient } from "@/lib/supabase"
import { createAuditLog } from "@/lib/audit"

export interface ChatMessage {
  id?: string
  user_id: string
  user_name: string
  message: string
  response: string
  created_at?: string
}

function getCurrentOperator() {
  if (typeof window === "undefined") return { id: "", role: "unknown" }

  try {
    const raw = localStorage.getItem("currentUser")
    if (!raw) return { id: "", role: "unknown" }
    const parsed = JSON.parse(raw)
    return { id: parsed?.id || "", role: parsed?.role || "unknown" }
  } catch {
    return { id: "", role: "unknown" }
  }
}

// 儲存對話紀錄（可選功能）
export async function saveChatHistory(chat: Omit<ChatMessage, "id" | "created_at">): Promise<boolean> {
  const supabase = getSupabaseClient()
  const operator = getCurrentOperator()
  if (!supabase) {
    console.error("Supabase client not available")
    return false
  }
  const eventLog = {
    source: 'support_chat',
    source_pk: `support_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: chat.user_id,
    question: chat.message,
    answer: chat.response
  }
  const { error } = await supabase.from("chat_events").insert([eventLog])

  if (error) {
    console.error("Error saving chat history:", error)
    if (operator.id) {
      await createAuditLog({
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "system_action",
        targetType: "system",
        targetId: chat.user_id,
        reason: error.message,
        afterState: chat,
        additionalData: { module: "support", status: "failed", error_code: error.message, action: "save_chat_history" },
      })
    }
    return false
  }

  if (operator.id) {
    await createAuditLog({
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "system_action",
      targetType: "system",
      targetId: chat.user_id,
      reason: "儲存客服對話",
      afterState: { user_name: chat.user_name },
      additionalData: { module: "support", status: "success", action: "save_chat_history" },
    })
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
    .from("chat_events")
    .select("id, user_id, question, answer, created_at")
    .eq("source", "support_chat")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Error fetching chat history:", error)
    return []
  }

  return (data || []).map(d => ({
    id: d.id,
    user_id: d.user_id,
    user_name: '使用者',
    message: d.question,
    response: d.answer,
    created_at: d.created_at
  }));
}

// AI 回應邏輯 - 呼叫後端 RAG API
export async function getAIResponse(message: string): Promise<{ answer: string; images?: string[]; chatId?: number | null } | string> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || '';
    
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
    const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || '';

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
