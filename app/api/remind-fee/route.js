import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// --- Supabase ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { room, amount, due, unit_id } = body;

    // --- Validation ---
    if (!room || !amount || !due) {
      return NextResponse.json(
        { error: 'room, amount, due 為必填' },
        { status: 400 }
      );
    }

    let unitId = unit_id;

    // If no unit_id provided, look it up by room number
    if (!unitId) {
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('id')
        .or(`unit_code.eq.${room},unit_number.eq.${room}`)
        .single();

      if (unitError || !unitData) {
        console.error('查詢 units 表失敗:', unitError);
        return NextResponse.json(
          { error: '查無對應單位編號，請確認輸入是否正確' },
          { status: 404 }
        );
      }
      unitId = unitData.id;
    }

    // Find LINE user ID from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('line_user_id, name')
      .eq('unit_id', unitId)
      .single();

    if (profileError) {
      console.error('查詢 profiles 表失敗:', profileError);
      return NextResponse.json(
        { error: '查詢住戶資料失敗' },
        { status: 500 }
      );
    }

    if (!profile?.line_user_id) {
      console.warn('該住戶尚未綁定 LINE 帳號:', unitId);
      return NextResponse.json(
        { error: '該住戶尚未綁定 LINE 帳號，無法發送通知' },
        { status: 400 }
      );
    }

    // Format the due date
    const dueDate = new Date(due).toLocaleDateString('zh-TW');

    // --- Send LINE Push Message ---
    const flexMessage = {
      type: 'flex',
      altText: '💰 管理費催繳通知',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { 
              type: 'text', 
              text: '💰 管理費催繳通知', 
              weight: 'bold', 
              size: 'lg',
              color: '#FF6B6B'
            },
            { type: 'separator', margin: 'md' },
            { 
              type: 'text', 
              text: `房號：${room}`, 
              margin: 'md',
              size: 'md'
            },
            { 
              type: 'text', 
              text: `應繳金額：NT$ ${Number(amount).toLocaleString()}`, 
              margin: 'sm',
              size: 'md',
              weight: 'bold'
            },
            { 
              type: 'text', 
              text: `繳費期限：${dueDate}`, 
              margin: 'sm',
              size: 'md',
              color: '#FF6B6B'
            },
            { type: 'separator', margin: 'lg' },
            { 
              type: 'text', 
              text: '請儘速至管理室繳納，謝謝！', 
              margin: 'md',
              size: 'sm',
              color: '#888888',
              wrap: true
            }
          ]
        }
      }
    };

    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: profile.line_user_id,
        messages: [flexMessage],
      }),
    });

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      console.error('LINE 推播失敗:', errText);
      return NextResponse.json(
        { error: 'LINE 推播失敗：' + errText },
        { status: 500 }
      );
    }

    console.log('催繳通知已成功發送給:', profile.line_user_id);

    return NextResponse.json({ 
      success: true, 
      message: '催繳通知已發送',
      recipient: profile.name || room
    });

  } catch (err) {
    console.error('remind-fee POST 錯誤:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  );
}
