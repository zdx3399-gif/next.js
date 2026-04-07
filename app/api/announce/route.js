import { createClient } from "@supabase/supabase-js";
import { Client } from "@line/bot-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  
  console.log("[Announce] 🔐 Supabase 初始化:");
  console.log("[Announce]   - URL:", url ? "✅" : "❌");
  console.log("[Announce]   - Service Role Key:", serviceRoleKey ? "✅" : "❌");
  console.log("[Announce]   - Anon Key:", anonKey ? "✅" : "❌");
  console.log("[Announce]   - 使用:", serviceRoleKey ? "Service Role" : "Anon Key");
  
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
  return new Client({ channelAccessToken, channelSecret });
}

// 從資料庫撈出所有已綁定 LINE 的住戶 ID + 統計未綁定人數
async function getAllLineUserIds(supabase) {
  const lineUserIds = new Set();
  let totalProfiles = 0;
  let boundProfiles = 0;

  // 策略 1: profiles 表中有 line_user_id 的帳號
  try {
    console.log("[Announce] 🔍 查詢 profiles 表中的 line_user_id...");
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*");

    if (profilesError) {
      console.warn("[Announce] ❌ profiles 查詢失敗!");
      console.warn("[Announce]    Error message:", profilesError.message);
    } else {
      totalProfiles = profiles?.length || 0;
      console.log(`[Announce] ✅ profiles 找到 ${totalProfiles} 筆帳號`);
      (profiles || []).forEach((p) => {
        if (p.line_user_id) {
          lineUserIds.add(p.line_user_id);
          boundProfiles++;
          console.log(`[Announce]   ✓ ${p.name || p.email} → line_user_id: ${p.line_user_id}`);
        }
      });
    }
  } catch (e) {
    console.warn("[Announce] ❌ profiles lookup 拋出異常:", e?.message);
  }

  // line_users 已整併至 profiles，無需額外查詢
  const result = [...lineUserIds];
  const notBoundCount = totalProfiles - boundProfiles;
  console.log(`[Announce] 📊 查詢完成 - 已綁定: ${result.length}，未綁定: ${notBoundCount}，總計: ${totalProfiles}`);
  
  return { ids: result, bound: result.length, notBound: notBoundCount, total: totalProfiles };
}

export async function POST(req) {
  console.log("🔥 [DEBUG] API /api/announce 被呼叫了！");

  try {
    console.log("[Announce] ⏳ 初始化 Supabase...");
    const supabase = getSupabase();
    console.log("[Announce] ✅ Supabase 初始化成功");

    console.log("[Announce] ⏳ 初始化 LINE Client...");
    const client = getLineClient();
    console.log("[Announce] ✅ LINE Client 初始化成功");

    console.log("[Announce] ⏳ 解析 request body...");
    const body = await req.json();
    const { title, content, image_url, author, test, pushOnly } = body;
    console.log("[Announce] ✅ Request body 解析成功");
    console.log("[Announce]    - title:", title);
    console.log("[Announce]    - content length:", content?.length || 0);
    console.log("[Announce]    - image_url:", image_url ? "provided" : "none");
    console.log("[Announce]    - author:", author);
    console.log("[Announce]    - test:", test);
    console.log("[Announce]    - pushOnly:", pushOnly);

    // Validation
    if (!title || !content) {
      console.error("[Announce] ❌ 缺少必要欄位: title/content");
      return Response.json({ error: "Missing required fields: title/content" }, { status: 400 });
    }

    // pushOnly = true 時只推播，不重複寫入公告資料庫
    if (pushOnly !== true) {
      console.log("[Announce] ⏳ 將公告寫入 Supabase...");
      const { error: insertErr } = await supabase.from("announcements").insert([
        {
          title,
          content,
          image_url: image_url || null,
          status: "published",
        },
      ]);

      if (insertErr) {
        console.error("❌ [ERROR] Supabase 寫入失敗:", insertErr.message);
        return Response.json({ error: insertErr.message }, { status: 500 });
      }
      console.log("[Announce] ✅ 公告寫入成功");
    } else {
      console.log("[Announce] ⏭️  pushOnly=true，跳過資料庫寫入，直接推播");
    }

    // Skip LINE if testing
    if (test === true) {
      console.log("[Announce] 🧪 測試模式，跳過 LINE 推播");
      return Response.json({ message: "測試成功，未推播" });
    }

    // 從資料庫取得所有已綁定 LINE 的住戶（同訪客/包裹做法，不使用 broadcast）
    console.log("[Announce] ⏳ 執行 getAllLineUserIds() 查詢...");
    const { ids: lineUserIds, bound: boundCount, notBound: notBoundCount, total: totalCount } = await getAllLineUserIds(supabase);
    console.log("[Announce] ✅ getAllLineUserIds() 完成，已綁定:", boundCount, "未綁定:", notBoundCount);

    // 備用方案：如果查不到已綁定的，用測試清單（測試用）
    let finalUserIds = lineUserIds;
    let isUsingFallback = false;
    
    if (lineUserIds.length === 0) {
      console.warn("[Announce] ⚠️  查不到任何已綁定用戶，改用備用清單進行推播");
      finalUserIds = [
        "U3708bab580db72e87ac14df8c159249a",  // 鄭得諼
        "U4f1fc1c05859b691ca3a51d2cfe8ff9d",  // 王大明
        "U5dbd8b5fb153630885b656bb5f8ae011"   // 倫
      ];
      isUsingFallback = true;
      console.log("[Announce] 備用清單有", finalUserIds.length, "個 ID");
    }

    if (finalUserIds.length === 0) {
      console.error("[Announce] ❌ 完全查不到，無法推播");
      return Response.json({ 
        success: false, 
        sent: 0, 
        skipped: totalCount, 
        total: totalCount,
        message: "❌ 推播失敗\n無任何已綁定住戶"
      });
    }

    console.log(`📤 [Announce] 準備推播給 ${finalUserIds.length} 位住戶`);

    const hasHttpsImage = typeof image_url === "string" && /^https:\/\//i.test(image_url);

    // LINE Flex Message（只有 https 圖片網址才會帶圖）
    const flexMessage = {
      type: "flex",
      altText: `📢 最新公告：${title}`,
      contents: {
        type: "bubble",
        ...(hasHttpsImage
          ? {
              hero: {
                type: "image",
                url: image_url,
                size: "full",
                aspectRatio: "20:13",
                aspectMode: "cover",
              },
            }
          : {}),
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

    // 使用 pushMessage 逐個推播給每個人（同訪客/包裹的成功做法）
    console.log(`[Announce] 📤 開始逐個推播給 ${finalUserIds.length} 位住戶...`);

    let totalSent = 0;
    let totalFailed = 0;

    for (const lineUserId of finalUserIds) {
      try {
        console.log(`[Announce] 📨 推播給: ${lineUserId}`);
        await client.pushMessage(lineUserId, flexMessage);
        console.log(`[Announce] ✅ 推播成功: ${lineUserId}`);
        totalSent++;
      } catch (e) {
        console.error(`[Announce] ❌ 推播失敗: ${lineUserId}`);
        console.error(`[Announce]    Error: ${e?.message}`);
        totalFailed++;
      }
    }

    console.log(`[Announce] 📊 推播完成 - 成功: ${totalSent}/${finalUserIds.length}, 失敗: ${totalFailed}`);

    // 組织回傳訊息
    const responseMessage = isUsingFallback 
      ? `⚠️ 推播測試模式\n已發送給 ${totalSent} 位用戶（備用清單）`
      : `✅ 推播成功\n已發送給 ${totalSent} 位住戶${notBoundCount > 0 ? `\n（${notBoundCount} 人 LINE 未綁定，已跳過）` : ''}`;

    return Response.json({ 
      success: totalSent > 0, 
      sent: totalSent,
      skipped: notBoundCount,
      total: totalCount,
      message: responseMessage,
      pushOnly: pushOnly === true 
    });
  } catch (err) {
    console.error("💥 [CRITICAL ERROR] Server:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}
