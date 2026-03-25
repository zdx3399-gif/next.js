import { createClient } from "@supabase/supabase-js";
import { Client } from "@line/bot-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ 延後到 request 才建立，避免 build 階段就因 env 缺而爆
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("supabaseUrl is required. Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }
  return createClient(url, anonKey);
}

// ✅ LINE client 也改成延後建立（同樣避免 env 缺直接炸）
function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET.");
  }

  return new Client({ channelAccessToken, channelSecret });
}

export async function POST(req) {
  try {
    const supabase = getSupabase();
    const client = getLineClient();

    const body = await req.json();
    console.log("📥 收到 POST 請求:", JSON.stringify(body, null, 2));

    // -----------------------------
    // ✅ 使用者投票處理
    // -----------------------------
    if (body.vote_message && typeof body.vote_message === "string") {
      console.log("🗳️ 進入投票處理流程");

      const line_user_id = body.line_user_id;
      const replyToken = body.replyToken; // 你目前沒用到，但保留

      const parts = body.vote_message.split(":");
      if (parts.length < 3) {
        return Response.json({ error: "投票訊息格式錯誤" }, { status: 400 });
      }

      const voteIdFromMsg = parts[1].trim();
      const option_selected = parts[2].replace("🗳️", "").trim();

      // 確認 vote_id 在 votes 表中存在
      const { data: voteExists, error: voteExistsErr } = await supabase
        .from("votes")
        .select("id")
        .eq("id", voteIdFromMsg)
        .single();

      if (voteExistsErr || !voteExists) {
        return Response.json(
          { error: "投票已過期或不存在，請點擊最新投票訊息" },
          { status: 400 }
        );
      }

      const vote_id = voteExists.id;

      // 查詢使用者 profile_id
      const { data: userProfile, error: userError } = await supabase
        .from("line_users")
        .select("display_name, profile_id")
        .eq("line_user_id", line_user_id)
        .single();

      if (userError || !userProfile) {
        console.error("查詢 line_users 失敗:", userError);
        return Response.json({ error: "找不到住戶資料" }, { status: 400 });
      }

      if (!userProfile.profile_id) {
        console.error("profile_id 為空:", line_user_id);
        return Response.json({ error: "profile_id 未設定，請聯絡管理員" }, { status: 400 });
      }

      const user_id = userProfile.profile_id;
      const user_name = userProfile.display_name;

      // 確認 profile_id 在 profiles 表中存在
      const { data: profileExists, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user_id)
        .single();

      if (profileError || !profileExists) {
        console.error("profiles 表中找不到 user_id:", user_id, profileError);
        return Response.json({ error: "profile_id 無效，請聯絡管理員" }, { status: 400 });
      }

      // 防止重複投票
      const { data: existingVote, error: existingVoteErr } = await supabase
        .from("vote_records")
        .select("id")
        .eq("vote_id", vote_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (existingVoteErr) {
        console.error("查詢 vote_records 失敗:", existingVoteErr);
        return Response.json({ error: "系統錯誤，請稍後再試" }, { status: 500 });
      }

      if (existingVote) {
        return Response.json({ error: "您已經投過票，不能重複投票" }, { status: 400 });
      }

      // 寫入 vote_records
      const voteRecord = {
        vote_id,
        user_id,
        user_name,
        option_selected,
        voted_at: new Date().toISOString(),
      };

      console.log("💾 準備寫入 vote_records:", voteRecord);
      const { error: recordError } = await supabase.from("vote_records").insert([voteRecord]);

      if (recordError) {
        console.error("❌ 投票寫入失敗:", recordError.message, recordError);
        return Response.json({ error: "投票失敗", details: recordError.message }, { status: 500 });
      }

      console.log("✅ 投票成功:", voteRecord);

      // 你目前只回傳文字給呼叫端（webhook 那邊回覆 LINE）
      const replyText = `確認，您的投票結果為「${option_selected}」`;
      return Response.json({ success: true, message: replyText });
    }

    // -----------------------------
    // ✅ 管理者發布新問卷（純文字推播）
    // -----------------------------
    const { title, description, author, ends_at, form_url, vote_url, options, test } = body;

    // form_url or vote_url can be used (frontend sends vote_url)
    const finalUrl = form_url || vote_url || "";

    if (!title || !ends_at) {
      return Response.json({ error: "title, ends_at 為必填" }, { status: 400 });
    }

    if (test === true) {
      return Response.json({ message: "問卷測試成功，未推播" });
    }

    // 儲存問卷
    const { error: insertError } = await supabase.from("votes").insert([
      {
        title,
        description: description || "",
        ends_at,
        form_url: finalUrl,
        vote_url: finalUrl,
        options: options || [],
        created_at: new Date().toISOString(),
        status: "active",
      },
    ]);

    if (insertError) {
      console.error("❌ 投票儲存失敗:", insertError);
      return Response.json({ error: "投票儲存失敗", details: insertError.message }, { status: 500 });
    }

    // 組合純文字訊息
    const text = finalUrl
      ? `📢 新問卷通知\n` +
        `標題：${title}\n` +
        `截止時間：${ends_at}\n` +
        `請點擊下方連結填寫問卷：\n${finalUrl}`
      : `📢 新投票通知\n` +
        `標題：${title}\n` +
        `截止時間：${ends_at}\n` +
        `${description || "請打開 LINE 進行投票"}`;

    // 推播給所有用戶
    await client.broadcast({ type: "text", text });

    return Response.json({ success: true });
  } catch (err) {
    console.error("votes POST 錯誤:", err);
    return Response.json(
      { error: "Internal Server Error", details: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
