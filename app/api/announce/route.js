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
    // 我們只從前端接收這些資料
    const { title, content, author, test } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // ✅ 修正：只寫入你截圖中真正存在的欄位 (title, content, status)
    // 我們不再寫入 'author', 'time', 'reads'，因為資料庫沒有這些欄位
    const { error } = await supabase
      .from('announcements')
      .insert([
        { 
          title: title, 
          content: content, 
          status: 'published' 
          // created_at 會由 Supabase 自動產生，不需要這裡寫
        }
      ]);

    if (error) {
      console.error("❌ [ERROR] Supabase 寫入失敗:", error.message);
      return Response.json({ error }, { status: 500 });
    }

    // Skip LINE if testing
    if (test === true) {
      return Response.json({ message: '測試成功，未推播' });
    }

    // ✅ LINE 推播：這裡我們仍然可以使用 'author' 變數顯示給住戶看
    // 雖然沒有存進資料庫，但 LINE 訊息還是可以顯示 "發布者：管理委員會"
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
            { type: 'text', text: `📝 ${content}`, wrap: true, margin: 'sm' },
            { type: 'text', text: `👤 發布者：${author || '管理委員會'}`, size: 'xs', color: '#aaaaaa', margin: 'md' }
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