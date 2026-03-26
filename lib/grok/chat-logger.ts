// chat-logger.ts - 對話記錄 + 自動學習佇列

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface ChatData {
  question: string;
  question_embedding: number[] | null;
  answer: string;
  sources: any[] | null;
  images: string[];
  search_method: string;
  similarity: number;
  match_count: number;
  response_ms: number;
  api_used: { cohere: boolean; groq: boolean };
}

function calculatePriority(chatData: ChatData): number {
  let priority = 5;
  if (chatData.similarity < 0.2) priority -= 2;
  else if (chatData.similarity < 0.3) priority -= 1;
  if (chatData.search_method === 'fallback') priority -= 1;
  if (chatData.match_count === 0) priority -= 2;
  return Math.max(1, Math.min(10, priority));
}

function checkNeedsReview(chatData: ChatData): { type: string; description: string } | null {
  if (chatData.similarity < 0.55) {
    return { type: 'low_similarity', description: `相似度僅 ${(chatData.similarity * 100).toFixed(1)}%` };
  }
  if (chatData.match_count === 0) {
    return { type: 'no_match', description: '找不到任何相關資料' };
  }
  if (chatData.search_method === 'fallback') {
    return { type: 'fallback', description: 'Embedding API 失敗，使用關鍵字降級搜尋' };
  }
  return null;
}

export async function saveChatWithLearning(chatData: ChatData) {
  try {
    const issue = checkNeedsReview(chatData);
    const priority = issue ? calculatePriority(chatData) : 5;

    const { data, error } = await supabase
      .from('chat_history')
      .insert({
        question: chatData.question,
        embedding: chatData.question_embedding,
        answer: chatData.answer,
        sources: chatData.sources || null,
        images: chatData.images || [],
        search_method: chatData.search_method,
        similarity: chatData.similarity,
        match_count: chatData.match_count,
        response_ms: chatData.response_ms,
        api_used: chatData.api_used,
        needs_review: !!issue,
        issue_type: issue?.type || null,
        priority,
        review_status: issue ? 'pending' : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ChatLogger] 儲存失敗:', error.message);
      return { success: false, chatId: null };
    }

    console.log(`[ChatLogger] 對話已記錄 (ID: ${data.id})${issue ? ` ⚠️ 需審核: ${issue.type}` : ''}`);
    return { success: true, chatId: data.id };
  } catch (err: any) {
    console.error('[ChatLogger] 例外錯誤:', err.message);
    return { success: false, chatId: null };
  }
}

export async function saveFeedback(chatId: number, rating: number, isHelpful: boolean | null = null, comment: string | null = null) {
  try {
    const { data: existing, error: checkError } = await supabase
      .from('chat_history')
      .select('rating')
      .eq('id', chatId)
      .single();

    if (checkError) throw checkError;

    if (existing?.rating !== null && existing?.rating !== undefined) {
      return { success: false, reason: 'already_rated' };
    }

    const updateData: any = { rating, is_helpful: isHelpful, feedback: comment };
    if (rating <= 2) {
      updateData.needs_review = true;
      updateData.issue_type = 'low_rating';
      updateData.priority = 2;
      updateData.review_status = 'pending';
    }

    const { error } = await supabase.from('chat_history').update(updateData).eq('id', chatId);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('[Feedback] 儲存失敗:', err.message);
    return { success: false, reason: 'error' };
  }
}

export async function getLearningQueue(status = 'pending', limit = 50) {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('id, question, answer, similarity, search_method, match_count, issue_type, priority, review_status, admin_notes, rating, feedback, created_at')
      .eq('needs_review', true)
      .eq('review_status', status)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('[LearningQueue] 查詢失敗:', err.message);
    return [];
  }
}

export async function updateLearningQueueStatus(chatId: number, status: string, adminNotes: string | null = null) {
  try {
    const { error } = await supabase
      .from('chat_history')
      .update({ review_status: status, admin_notes: adminNotes })
      .eq('id', chatId);

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error('[LearningQueue] 更新失敗:', err.message);
    return false;
  }
}

export async function getPerformanceMetrics() {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('similarity, response_ms, search_method, needs_review, api_used, match_count');

    if (error) throw error;

    const total = data.length;
    if (total === 0) return { total_chats: 0 };

    const avgSimilarity = data.reduce((sum, d) => sum + (d.similarity || 0), 0) / total;
    const avgResponseTime = data.reduce((sum, d) => sum + (d.response_ms || 0), 0) / total;
    const needsReviewCount = data.filter(d => d.needs_review).length;
    const fallbackCount = data.filter(d => d.search_method === 'fallback').length;
    const avgMatchCount = data.reduce((sum, d) => sum + (d.match_count || 0), 0) / total;

    return {
      total_chats: total,
      avg_similarity: avgSimilarity,
      avg_response_time_ms: avgResponseTime,
      needs_review_count: needsReviewCount,
      needs_review_percentage: (needsReviewCount / total * 100).toFixed(1),
      fallback_count: fallbackCount,
      avg_match_count: avgMatchCount,
    };
  } catch (err: any) {
    console.error('[Metrics] 查詢失敗:', err.message);
    return null;
  }
}
