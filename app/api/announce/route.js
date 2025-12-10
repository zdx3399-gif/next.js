// Paste this into: app/api/announce/route.js
import { createClient } from '@supabase/supabase-js';
import { Client } from '@line/bot-sdk';

export const runtime = 'nodejs';

export async function POST(req) {
  console.log("🔥 [DEBUG] API /api/announce 被呼叫了！"); 

  try {
    const CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

    if (!CHANNEL_TOKEN || !CHANNEL_SECRET) {
      console.error("❌ [ERROR] LINE 環境變數缺失！");
      return Response.json({ error: 'Server Environment Variables Missing' }, { status: 500 });
    }

    const client = new Client({
      channelAccessToken: CHANNEL_TOKEN,
      channelSecret: CHANNEL_SECRET,
    });

    const body = await req.json();
    const { title, content, author, test } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Save to DB
    const { error } = await supabase
      .from('announcements')
      .insert([{ title, content, time: new Date().toLocaleString(), author, reads: 0, status: 'published' }]);

    if (error) {
      console.error("❌ [ERROR] Supabase 寫入失敗:", error.message);
      return Response.json({ error }, { status: 500 });
    }

    // Skip LINE if testing
    if (test === true) {
      return Response.json({ message: '測試成功，未推播' });
    }

    // Send LINE
    const flexMessage = {
      type: 'flex',
      altText: '📢 最新公告',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '📢 最新公告', weight: 'bold', size: 'lg' },
            { type: 'separator', margin: 'md' },
            { type: 'text', text: `📌 ${title}`, weight: 'bold', wrap: true, margin: 'md' },
            { type: 'text', text: `📝 ${content}`, wrap: true, margin: 'sm' }
          ],
        },
      },
    };

    await client.broadcast(flexMessage);
    console.log("🎉 [SUCCESS] LINE 推播成功！");
    return Response.json({ success: true });

  } catch (err) {
    console.error('💥 [CRITICAL ERROR] Server:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}