import { generateGeminiContent } from "@/lib/gemini-client";

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
    const payload = {
      contents: [
        {
          parts: [
            {
              text: query,
            },
          ],
        },
      ],
    };

    const { data, model } = await generateGeminiContent({
      apiKey: GEMINI_API_KEY,
      payload,
      debugLabel: "ai-chat",
    });

    // Extract answer from Gemini response
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "無法生成回應。";

    return {
      answer,
      normalized_question: query,
      intent: "query",
      intent_confidence: 0.95,
      answered: answer && answer.length > 0,
      metadata: {
        model,
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
