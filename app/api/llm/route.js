import { chat } from '@/lib/ai-chat';
import { createClient } from '@supabase/supabase-js';
import { writeServerAuditLog } from '@/lib/audit-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey);
}

export async function POST(req) {
  try {
    const supabase = getSupabase();
    const { query, userId, eventId } = await req.json();
    if (!query) {
      await writeServerAuditLog({
        supabase,
        operatorId: userId || null,
        operatorRole: 'resident',
        actionType: 'system_action',
        targetType: 'system',
        targetId: eventId || 'llm',
        reason: '缺少 query 參數',
        module: 'llm',
        status: 'blocked',
        errorCode: 'missing_query',
      });
      return new Response(JSON.stringify({ error: '缺少 query 參數' }), { status: 400 });
    }
    
    // 防重複：檢查此 eventId 是否已處理過
    if (eventId) {
      const { data: existingLog } = await supabase
          .from('chat_events')
          .select('id, raw_question')
          .eq('source', 'chat_log')
      if (existingLog) {
        console.log('[防重複] eventId 已存在，跳過寫入:', eventId);
        return new Response(JSON.stringify({ 
          answer: '(快取回應)',
          chatLogId: existingLog.id,
          cached: true 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // 呼叫 chat 取得回答與相關資訊
    const result = await chat(query);

    // 準備要寫入 chat_events 的欄位
    // 假設 result 會回傳 normalized_question、intent、intent_confidence、answered
    // 若沒有，這裡可根據你的 chat 回傳內容調整
    const logData = {
      source: 'chat_log',
      source_pk: `llm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      raw_question: query,
      question: result.normalized_question || query,
      normalized_question: result.normalized_question || query, // 若無正規化則用原文
      intent: result.intent || null,
      intent_confidence: typeof result.intent_confidence === 'number' ? result.intent_confidence : null,
      answered: typeof result.answered === 'boolean' ? result.answered : (result.answer ? true : false),
      user_id: userId || null,
      event_id: eventId || null, // 記錄 LINE eventId
      created_at: new Date().toISOString(),
    };


    // 寫入 Supabase chat_events，並檢查回傳 error
    const { error: insertError, data: insertData } = await supabase.from('chat_events').insert([logData]).select();
    if (insertError) {
      console.error('[Supabase Insert Error]', insertError);
      await writeServerAuditLog({
        supabase,
        operatorId: userId || null,
        operatorRole: 'resident',
        actionType: 'system_action',
        targetType: 'system',
        targetId: eventId || 'llm',
        reason: insertError.message,
        module: 'llm',
        status: 'failed',
        errorCode: insertError.message,
      });
      return new Response(JSON.stringify({ ...result, supabase_error: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 取得新插入的 chat_events id
    const chatLogId = insertData?.[0]?.id;

    await writeServerAuditLog({
      supabase,
      operatorId: userId || null,
      operatorRole: 'resident',
      actionType: 'system_action',
      targetType: 'system',
      targetId: String(chatLogId || eventId || 'llm'),
      reason: 'LLM 對話寫入 chat_events',
      afterState: { event_id: eventId || null, answered: logData.answered },
      module: 'llm',
      status: 'success',
    });

    return new Response(JSON.stringify({ ...result, chatLogId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
