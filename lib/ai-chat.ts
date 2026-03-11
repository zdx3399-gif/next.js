const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface ChatResult {
  answer: string;
  normalized_question?: string;
  intent?: string;
  intent_confidence?: number;
  answered?: boolean;
  metadata?: Record<string, any>;
}

export async function chat(query: string): Promise<ChatResult> {
  if (!query || query.trim().length === 0) {
    return {
      answer: "請提供有效的問題。",
      answered: false,
    };
  }

  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not configured");
    return {
      answer: "系統尚未配置 AI 模型。",
      answered: false,
    };
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: query,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error:", errorData);
      return {
        answer: "無法取得 AI 回應，請稍後重試。",
        answered: false,
      };
    }

    const data = await response.json();

    // Extract answer from Gemini response
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "無法生成回應。";

    return {
      answer,
      normalized_question: query,
      intent: "query",
      intent_confidence: 0.95,
      answered: answer && answer.length > 0,
      metadata: {
        model: "gemini-pro",
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      answer: "發生錯誤，無法生成回應。",
      answered: false,
    };
  }
}

// Alias for backward compatibility
export async function generateAnswer(query: string): Promise<string> {
  const result = await chat(query);
  return result.answer;
}
