
import * as line from '@line/bot-sdk';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url, serviceRoleKey || anonKey);
}

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET");
  }
  return new line.Client({ channelAccessToken, channelSecret });
}

// 從資料庫撈出所有已綁定 LINE 的住戶 ID
async function getAllLineUserIds(supabase) {
  const lineUserIds = new Set();

  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("line_user_id")
      .not("line_user_id", "is", null);
    (profiles || []).forEach((p) => {
      if (p.line_user_id) lineUserIds.add(p.line_user_id);
    });
  } catch (e) {
    console.warn("[Meeting] profiles lookup failed:", e);
  }

  try {
    const { data: lineUsers } = await supabase
      .from("line_users")
      .select("line_user_id")
      .not("line_user_id", "is", null);
    (lineUsers || []).forEach((u) => {
      if (u.line_user_id) lineUserIds.add(u.line_user_id);
    });
  } catch (e) {
    console.warn("[Meeting] line_users lookup failed:", e);
  }

  return [...lineUserIds];
}

export async function POST(req) {
  try {
    const supabase = getSupabase();
    const client = getLineClient();
    
    const data = await req.json();
    const { topic, time, location, key_takeaways, notes, pdf_file_url, created_by } = data;
    if (!topic || !time || !location || !key_takeaways) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 寫入 meetings table
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert([
        {
          topic,
          time,
          location,
          key_takeaways,
          notes: notes || '',
          pdf_file_url: pdf_file_url || '',
          created_by: created_by || null,
        },
      ])
      .select()
      .single();
    if (meetingError) {
      return NextResponse.json({ error: '資料庫寫入失敗', detail: meetingError.message }, { status: 500 });
    }

    // 進一步優化訊息格式
    let message =
      `📢 會議公告\n` +
      `====================\n` +
      `主題：${topic}\n` +
      `🕒 時間：${time}\n` +
      `📍 地點：${location}\n`;

    if (Array.isArray(key_takeaways) && key_takeaways.length > 0) {
      message += `\n--------------------\n📌 重點摘要\n` + key_takeaways.map((t) => `・${t}`).join('\n');
    }
    if (notes) message += `\n--------------------\n📝 備註\n${notes}`;
    if (pdf_file_url) message += `\n--------------------\n📄 PDF下載\n${pdf_file_url}`;

    message += `\n====================`;

    // 取得所有已綁定 LINE 的住戶（同公告的做法）
    let lineUserIds = await getAllLineUserIds(supabase);

    // 備用方案：如果查不到，用已知的 3 個 ID 進行推播
    if (lineUserIds.length === 0) {
      console.warn('[Meeting] 查不到任何 ID，改用備用清單進行推播');
      lineUserIds = [
        "U3708bab580db72e87ac14df8c159249a",  // 鄭得諼
        "U4f1fc1c05859b691ca3a51d2cfe8ff9d",  // 王大明
        "U5dbd8b5fb153630885b656bb5f8ae011"   // 倫
      ];
    }

    if (lineUserIds.length === 0) {
      console.error('[Meeting] 完全查不到，無法推播');
      return NextResponse.json({ message: '會議已建立，但無已綁定 LINE 的住戶可推播', pushed: 0 });
    }

    // 逐個推送給每位住戶
    let totalSent = 0;
    let totalFailed = 0;

    console.log(`[Meeting] 開始推播給 ${lineUserIds.length} 位住戶`);

    for (const lineUserId of lineUserIds) {
      try {
        await client.pushMessage(lineUserId, { type: 'text', text: message });
        totalSent++;
        console.log(`[Meeting] ✅ 推播成功: ${lineUserId}`);
      } catch (e) {
        totalFailed++;
        console.error(`[Meeting] ❌ 推播失敗 ${lineUserId}:`, e?.message);
      }
    }

    console.log(`[Meeting] 推播完成 - 成功: ${totalSent}, 失敗: ${totalFailed}`);
    return NextResponse.json({ message: '會議通知已發送', pushed: totalSent, failed: totalFailed });
  } catch (error) {
    console.error('Error in meeting notify:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
