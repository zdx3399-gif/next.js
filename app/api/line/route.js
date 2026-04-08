import { Client, validateSignature } from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';
import { chat } from '@/lib/ai-chat';
import { facilityCarousel, createClarificationQuickReply, createMessageWithFeedback } from '@/utils/lineMessage';
import { writeServerAuditLog } from '@/lib/audit-server';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export const runtime = 'nodejs';

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(lineConfig);// LINE Bot SDK 客戶端

// 移除圖片關鍵字攔截，讓所有查詢都進入 AI 處理
// const IMAGE_KEYWORDS = ['圖片', '設施', '游泳池', '健身房', '大廳'];
// 處理 LINE Webhook 請求
export async function POST(req) {
  try {
    const rawBody = await req.text();// 取得原始請求體
    if (!rawBody) return new Response('Bad Request: Empty body', { status: 400 });

    // 驗證 LINE signature（使用官方 SDK）
    const signature = req.headers.get('x-line-signature');
    console.log('[Debug] Channel Secret exists:', !!lineConfig.channelSecret);
    console.log('[Debug] Signature exists:', !!signature);
    console.log('[Debug] Body length:', rawBody.length);
    
    if (!signature) {
      console.error('[Signature Error] No signature header');
      return new Response('Unauthorized', { status: 401 });
    }
    
    const isValid = validateSignature(rawBody, lineConfig.channelSecret, signature);
    console.log('[Debug] Signature valid:', isValid);
    
    if (!isValid) {
      console.error('[Signature Error] Invalid signature');
      return new Response('Unauthorized', { status: 401 });
    }

    let events;// 儲存事件陣列
    try {
      events = JSON.parse(rawBody).events;// 解析事件陣列
    } catch {
      return new Response('Bad Request: Invalid JSON', { status: 400 });
    }

    for (const event of events) {// 逐一處理每個事件
      const userId = event.source?.userId;
      if (!userId) continue;

      // 嘗試抓 LINE Profile
      let profile = { displayName: '', pictureUrl: '', statusMessage: '' };
      try {
        profile = await client.getProfile(userId);// 抓取使用者個人資料
      } catch (err) {
        console.warn('⚠️ 無法抓到 profile，只存 userId。', err);
      }

      // --- 1. 檢查使用者是否已存在 profiles ---
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, line_user_id, line_display_name, line_avatar_url, line_status_message')
        .eq('line_user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Supabase 檢查錯誤:', checkError);
      }

      const profileChanged =
        !existingProfile ||
        existingProfile.line_display_name !== (profile.displayName || '') ||
        existingProfile.line_avatar_url !== (profile.pictureUrl || '') ||
        existingProfile.line_status_message !== (profile.statusMessage || '');

      // follow 事件或 profile 變動才 upsert
      if (event.type === 'follow' || profileChanged) {
        const upsertProfile = {
          line_user_id: userId,
          line_display_name: profile.displayName || '',
          line_avatar_url: profile.pictureUrl || '',
          line_status_message: profile.statusMessage || '',
          updated_at: new Date().toISOString(),
        };
        if (existingProfile?.id) upsertProfile.id = existingProfile.id;
        const { error: upsertError } = await supabase.from('profiles').upsert([
          upsertProfile
        ], { onConflict: 'line_user_id' });

        if (upsertError) console.error('❌ Supabase upsert 錯誤:', upsertError);
      }

      // --- 2. 處理文字訊息 ---
      if (event.type === 'message' && event.message.type === 'text') {
        const userText = event.message.text.trim();
        const replyToken = event.replyToken;
        console.log('📩 使用者輸入:', userText);

        // 0️⃣ 投票訊息
        if (userText.includes('vote:')) {
          try {
            const parts = userText.split(':');
            if (parts.length < 3) {
              await client.replyMessage(replyToken, { type: 'text', text: '投票訊息格式錯誤' });
              continue;
            }

            const voteIdFromMsg = parts[1].trim();
            const option_selected = parts[2].replace('🗳️', '').trim();

            const { data: voteExists } = await supabase
              .from('votes')
              .select('id')
              .eq('id', voteIdFromMsg)
              .maybeSingle();

            if (!voteExists) {
              await client.replyMessage(replyToken, { type: 'text', text: '投票已過期或不存在' });
              continue;
            }

            const vote_id = voteExists.id;
            const user_id = existingProfile?.id;
            const user_name = existingProfile?.line_display_name;

            if (!user_id) {
              await writeServerAuditLog({
                supabase,
                operatorId: null,
                operatorRole: 'resident',
                actionType: 'submit_vote',
                targetType: 'vote',
                targetId: vote_id,
                reason: '找不到住戶資料',
                module: 'line-webhook',
                status: 'blocked',
                errorCode: 'profile_not_found',
              });
              await client.replyMessage(replyToken, { type: 'text', text: '找不到住戶資料' });
              continue;
            }

            // 防止重複投票
            const { data: existingVote } = await supabase
              .from('vote_records')
              .select('id')
              .eq('vote_id', vote_id)
              .eq('user_id', user_id)
              .maybeSingle();

            if (existingVote) {
              await writeServerAuditLog({
                supabase,
                operatorId: user_id,
                operatorRole: 'resident',
                actionType: 'submit_vote',
                targetType: 'vote',
                targetId: vote_id,
                reason: '您已經投過票',
                module: 'line-webhook',
                status: 'blocked',
                errorCode: 'already_voted',
              });
              await client.replyMessage(replyToken, { type: 'text', text: '您已經投過票' });
              continue;
            }

            const { error: voteError } = await supabase.from('vote_records').insert([{
              vote_id,
              user_id,
              user_name,
              option_selected,
              voted_at: new Date().toISOString()
            }]);

            if (voteError) {
              console.error('❌ 投票寫入失敗:', voteError);
              await writeServerAuditLog({
                supabase,
                operatorId: user_id,
                operatorRole: 'resident',
                actionType: 'submit_vote',
                targetType: 'vote',
                targetId: vote_id,
                reason: voteError.message,
                module: 'line-webhook',
                status: 'failed',
                errorCode: voteError.message,
              });
              await client.replyMessage(replyToken, { type: 'text', text: '投票失敗' });
              continue;
            }

            await writeServerAuditLog({
              supabase,
              operatorId: user_id,
              operatorRole: 'resident',
              actionType: 'submit_vote',
              targetType: 'vote',
              targetId: vote_id,
              reason: 'LINE 投票成功',
              afterState: { option_selected: option_selected },
              module: 'line-webhook',
              status: 'success',
            });

            await client.replyMessage(replyToken, { type: 'text', text: `確認，您的投票結果為「${option_selected}」` });
          } catch (err) {
            console.error('❌ 投票處理失敗:', err);
          }
          continue;
        }

        // 1️⃣ 公共設施
        if (userText.includes('公共設施')) {
          await client.replyMessage(replyToken, facilityCarousel());
          continue;
        }

        // 2️⃣ 其他問題 → 直接呼叫 chat 函數進行 AI 查詢
        try {
          // LINE webhook event 的唯一 ID（有些版本欄位名稱不同）
          const eventId = event.webhookEventId || event.id || `${userId}_${Date.now()}`;
          console.log('[DEBUG] Event ID:', eventId);
          console.log('[DEBUG] Event 完整資料:', JSON.stringify(event, null, 2));
          
          // 防重複：檢查此 eventId 是否已處理過
          let chatLogId = null;
          if (eventId) {
            const { data: existingLog } = await supabase
              .from('chat_events')
              .select('id')
              .eq('source', 'chat_log')
              .eq('event_id', eventId)
              .maybeSingle();
            
            if (existingLog) {
              console.log('[防重複] eventId 已存在，跳過處理:', eventId);
              continue;
            }
          }
          
          const result = await chat(userText);
          
          // ===== 處理追問澄清機制 =====
          if (result.needsClarification) {
            console.log('[追問] 觸發澄清機制');
            
            // 寫入 chat_log (需要追問的記錄)
            const logData = {
              source: 'chat_log',
              source_pk: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              raw_question: userText,
              normalized_question: result.normalized_question || userText,
              question: result.normalized_question || userText,
              intent: result.intent || null,
              intent_confidence: typeof result.intent_confidence === 'number' ? result.intent_confidence : null,
              answered: false,
              needs_clarification: true,
              user_id: userId || null,
              event_id: eventId || null,
              created_at: new Date().toISOString(),
            };
            const { data: insertData, error: insertError } = await supabase
              .from('chat_events')
              .insert([logData])
              .select();
            if (!insertError && insertData?.[0]) {
              chatLogId = insertData[0].id;
              console.log('[追問] chatLogId 已記錄:', chatLogId);
              // 記錄澄清選項到 clarification_options 表
              const clarificationRecords = result.clarificationOptions.map((opt, index) => ({
                chat_log_id: chatLogId,
                option_label: opt.label,
                option_value: opt.value,
                display_order: index
              }));
              await supabase
                .from('clarification_options')
                .insert(clarificationRecords);
              await writeServerAuditLog({
                supabase,
                operatorId: existingProfile?.id || null,
                operatorRole: 'resident',
                actionType: 'system_action',
                targetType: 'system',
                targetId: String(chatLogId),
                reason: '建立追問 chat_event',
                afterState: { needs_clarification: true },
                module: 'line-webhook',
                status: 'success',
              });
            } else if (insertError) {
              await writeServerAuditLog({
                supabase,
                operatorId: existingProfile?.id || null,
                operatorRole: 'resident',
                actionType: 'system_action',
                targetType: 'system',
                targetId: eventId || 'chat_event',
                reason: insertError.message,
                module: 'line-webhook',
                status: 'failed',
                errorCode: insertError.message,
              });
            }
            
            // 建立 Quick Reply 訊息
            const clarificationMessage = {
              type: 'text',
              text: result.clarificationMessage,
              quickReply: createClarificationQuickReply(chatLogId, result.clarificationOptions)
            };
            
            await client.replyMessage(replyToken, clarificationMessage);
            continue;
          }
          
          // ===== 正常回答流程 =====
          const answer = result?.answer || '目前沒有找到相關資訊，請查看社區公告。';
          
          // 檢查是否為追問回應 (訊息以 clarify: 開頭)
          let clarificationParentId = null;
          if (userText.startsWith('clarify:')) {
            // 查找最近一次 needs_clarification = true 的記錄
            const { data: parentLog } = await supabase
              .from('chat_events')
              .select('id')
              .eq('source', 'chat_log')
              .eq('user_id', userId)
              .eq('needs_clarification', true)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (parentLog) {
              clarificationParentId = parentLog.id;
              console.log('[追問] 這是澄清回應，parent_id:', clarificationParentId);
              
              // 更新 clarification_options，標記使用者選擇的選項
              await supabase
                .from('clarification_options')
                .update({ selected: true, selected_at: new Date().toISOString() })
                .eq('chat_log_id', clarificationParentId)
                .eq('option_value', userText);
            }
          }

          
          // 寫入 chat_log
          const logData = {
            raw_question: userText,
            normalized_question: result.normalized_question || userText,
            intent: result.intent || null,
            intent_confidence: typeof result.intent_confidence === 'number' ? result.intent_confidence : null,
            answered: typeof result.answered === 'boolean' ? result.answered : (result.answer ? true : false),
            needs_clarification: false,
            clarification_parent_id: clarificationParentId,
            user_id: userId || null,
            event_id: eventId || null,
            created_at: new Date().toISOString(),
          };

          
          const eventLogData = {
            source: 'chat_log',
            source_pk: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            question: result.normalized_question || userText,
            ...logData,
          };

          const { data: insertData, error: insertError } = await supabase
            .from('chat_events')
            .insert([eventLogData])
            .select();
          
          console.log('[DEBUG] Insert result:', insertData);
          console.log('[DEBUG] Insert error:', insertError);
          
          if (!insertError && insertData?.[0]) {
            chatLogId = insertData[0].id;
            console.log('[DEBUG] chatLogId 已取得:', chatLogId);
            await writeServerAuditLog({
              supabase,
              operatorId: existingProfile?.id || null,
              operatorRole: 'resident',
              actionType: 'system_action',
              targetType: 'system',
              targetId: String(chatLogId),
              reason: '建立 chat_event',
              afterState: { needs_clarification: false },
              module: 'line-webhook',
              status: 'success',
            });
          } else {
            console.error('[ERROR] 無法取得 chatLogId, insertError:', insertError);
            if (insertError) {
              await writeServerAuditLog({
                supabase,
                operatorId: existingProfile?.id || null,
                operatorRole: 'resident',
                actionType: 'system_action',
                targetType: 'system',
                targetId: eventId || 'chat_event',
                reason: insertError.message,
                module: 'line-webhook',
                status: 'failed',
                errorCode: insertError.message,
              });
            }
          }
          
          // 只有在有 chatLogId 時才建立回饋按鈕
          let replyMessage;
          if (chatLogId) {
            replyMessage = createMessageWithFeedback(answer.trim(), chatLogId);
          } else {
            // 沒有 chatLogId，只回覆純文字
            console.warn('[WARNING] 沒有 chatLogId，只回覆純文字');
            replyMessage = {
              type: 'text',
              text: answer.trim()
            };
          }
          
          await client.replyMessage(replyToken, replyMessage);
        } catch (err) {
          console.error('查詢 LLM API 失敗:', err);
          // 只在 replyToken 尚未使用時才回覆
          try {
            await client.replyMessage(replyToken, { type: 'text', text: '查詢失敗，請稍後再試。' });
          } catch (replyErr) {
            console.error('回覆錯誤訊息失敗 (可能 token 已使用):', replyErr.message);
          }
        }
      }
      
      // --- 3. 處理 postback 事件（回饋按鈕 + 澄清選項） ---
      if (event.type === 'postback') {
        const data = event.postback.data;
        const replyToken = event.replyToken;
        
        console.log('[DEBUG Postback] 原始 data:', data);
        
        // 解析 postback data
        const params = new URLSearchParams(data);
        const action = params.get('action');
        
        console.log('[DEBUG Postback] action:', action);
        
        // ===== 處理澄清選項 =====
        if (action === 'clarify') {
          const clarifyValue = params.get('choice') || params.get('value'); // 兼容舊格式
          console.log('[DEBUG Postback] clarifyValue:', clarifyValue);
          
          try {
            // 直接呼叫 chat 函數處理澄清選項
            const result = await chat(clarifyValue);
            
            // 根據結果建立回覆訊息（帶回饋按鈕）
            let replyMessage;
            if (result.answer) {
              replyMessage = {
                type: 'text',
                text: result.answer.trim()
              };
            } else {
              replyMessage = {
                type: 'text',
                text: '抱歉，目前找不到相關資訊。'
              };
            }
            
            await client.replyMessage(replyToken, replyMessage);
            continue;
          } catch (err) {
            console.error('[Postback Clarify Error]', err);
            await client.replyMessage(replyToken, { 
              type: 'text', 
              text: '查詢失敗，請稍後再試。' 
            });
            continue;
          }
        }
        
        // ===== 處理回饋按鈕 =====
        const chatLogId = params.get('chatLogId');
        const feedbackType = params.get('type');
        
        console.log('[DEBUG Postback] chatLogId:', chatLogId, 'type:', typeof chatLogId);
        console.log('[DEBUG Postback] feedbackType:', feedbackType);
        
        if (action === 'feedback' && chatLogId) {
          const chatLogIdInt = parseInt(chatLogId);
          console.log('[DEBUG Postback] chatLogIdInt:', chatLogIdInt);
          
          try {
            // 記錄回饋到 chat_feedback
            // 讀取 chat_events 目前 feedback_events
            const { data: chatLog, error: chatLogError } = await supabase
              .from('chat_events')
              .select('id, feedback, success_count, unclear_count, fail_count, feedback_events')
              .eq('id', chatLogId)
              .eq('source', 'chat_log')
              .single();
            if (chatLogError) {
              console.error('[Chat Log Query Error]', chatLogError);
            }
            const feedbackField = feedbackType === 'helpful' ? 'success_count' :
                                 feedbackType === 'unclear' ? 'unclear_count' : 'fail_count';
            const feedbackEvents = Array.isArray(chatLog?.feedback_events) ? chatLog.feedback_events : [];
            const feedbackRecord = {
              id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              user_id: userId || null,
              feedback_type: feedbackType,
              clarification_choice: null,
              comment: null,
              created_at: new Date().toISOString(),
            };
            const updateData = {
              feedback: feedbackType,
              [feedbackField]: (chatLog?.[feedbackField] || 0) + 1,
              feedback_events: [...feedbackEvents, feedbackRecord],
            };
            if (feedbackType === 'not_helpful') {
              updateData.answered = false;
            }
            const { error: feedbackUpdateError } = await supabase
              .from('chat_events')
              .update(updateData)
              .eq('id', chatLogId)
              .eq('source', 'chat_log');

            if (feedbackUpdateError) {
              await writeServerAuditLog({
                supabase,
                operatorId: existingProfile?.id || null,
                operatorRole: 'resident',
                actionType: 'system_action',
                targetType: 'system',
                targetId: chatLogId,
                reason: feedbackUpdateError.message,
                module: 'line-webhook',
                status: 'failed',
                errorCode: feedbackUpdateError.message,
              });
            } else {
              await writeServerAuditLog({
                supabase,
                operatorId: existingProfile?.id || null,
                operatorRole: 'resident',
                actionType: 'system_action',
                targetType: 'system',
                targetId: chatLogId,
                reason: '更新 LINE 回饋狀態',
                afterState: { feedbackType },
                module: 'line-webhook',
                status: 'success',
              });
            }
            
            // 回覆訊息
            let responseText = '';
            if (feedbackType === 'helpful') {
              responseText = '感謝你的回饋！很高興能幫助到你 😊';
            } else if (feedbackType === 'unclear') {
              responseText = '好，我懂～讓我提供更多資訊給你。';
            } else if (feedbackType === 'not_helpful') {
              responseText = '了解，這題目前資料可能不完整 🙏\n我會回報給管理單位補齊資料。';
            }
            
            await client.replyMessage(replyToken, { type: 'text', text: responseText });
          } catch (err) {
            console.error('[Postback Error]', err);
          }
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function GET() {
  return new Response('Method Not Allowed', { status: 405 });
}
