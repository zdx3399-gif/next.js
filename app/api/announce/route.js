import { createClient } from "@supabase/supabase-js";
import { Client } from "@line/bot-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  console.log("🔥 [DEBUG] API /api/announce 被呼叫了！");

  try {
    // --- LINE env ---
    const CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

    if (!CHANNEL_TOKEN || !CHANNEL_SECRET) {
      console.error("❌ [ERROR] LINE 環境變數缺失！");
      return Response.json({ error: "Server Environment Variables Missing (LINE)" }, { status: 500 });
    }

    const client = new Client({
      channelAccessToken: CHANNEL_TOKEN,
      channelSecret: CHANNEL_SECRET,
    });

    // --- Supabase env ---
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("❌ [ERROR] Supabase 環境變數缺失！");
      return Response.json({ error: "Server Environment Variables Missing (Supabase)" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const body = await req.json();
    const { title, content, author, test } = body;

    // Validation
    if (!title || !content) {
      return Response.json({ error: "Missing required fields: title/content" }, { status: 400 });
    }

    // 寫入公告（只寫入存在的欄位）
    const { error: insertErr } = await supabase.from("announcements").insert([
      {
        title,
        content,
        status: "published",
      },
    ]);

    if (insertErr) {
      console.error("❌ [ERROR] Supabase 寫入失敗:", insertErr.message);
      return Response.json({ error: insertErr.message }, { status: 500 });
    }

    // Skip LINE if testing
    if (test === true) {
      return Response.json({ message: "測試成功，未推播" });
    }

    // LINE 推播
    const flexMessage = {
      type: "flex",
      altText: "📢 最新公告",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "📢 最新公告", weight: "bold", size: "lg" },
            { type: "separator", margin: "md" },
            { type: "text", text: `📌 ${title}`, weight: "bold", wrap: true, margin: "md" },
            { type: "text", text: `📝 ${content}`, wrap: true, margin: "sm" },
            {
              type: "text",
              text: `👤 發布者：${author || "管理委員會"}`,
              size: "xs",
              color: "#aaaaaa",
              margin: "md",
            },
          ],
        },
      },
    };

    await client.broadcast(flexMessage);
    console.log("🎉 [SUCCESS] LINE 推播成功！");
    return Response.json({ success: true });
  } catch (err) {
    console.error("💥 [CRITICAL ERROR] Server:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}
