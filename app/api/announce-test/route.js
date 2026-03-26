import { createClient } from "@supabase/supabase-js";
import { Client } from "@line/bot-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return new Client({ channelAccessToken, channelSecret });
}

export async function GET(req) {
  console.log("🧪 [TEST] 測試 multicast 推播");

  try {
    const supabase = getSupabase();
    const client = getLineClient();

    console.log("[TEST] 📋 查詢已綁定的 LINE 用戶...");
    
    // 直接查詢硬編碼的 IDs（從診斷結果）
    const testUserIds = [
      "U3708bab580db72e87ac14df8c159249a",
      "U4f1fc1c05859b691ca3a51d2cfe8ff9d",
      "U5dbd8b5fb153630885b656bb5f8ae011"
    ];

    console.log(`[TEST] ✅ 取得測試用戶: ${testUserIds.length} 人`);
    console.log(`[TEST]    IDs: ${testUserIds.join(", ")}`);

    // 簡單的測試訊息
    const testMessage = {
      type: "flex",
      altText: "📢 測試推播",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "📢 測試推播", weight: "bold", size: "lg" },
            { type: "separator", margin: "md" },
            { type: "text", text: "這是測試訊息", wrap: true, margin: "md" },
            { type: "text", text: new Date().toISOString(), size: "xs", color: "#999999" },
          ],
        },
      },
    };

    console.log("[TEST] 📨 準備 pushMessage 到第一個用戶進行測試...");
    
    try {
      const firstUser = testUserIds[0];
      console.log(`[TEST]    目標: ${firstUser}`);
      console.log(`[TEST]    訊息類型: ${testMessage.type}`);
      
      const pushResponse = await client.pushMessage(firstUser, testMessage);
      console.log("[TEST] ✅ pushMessage 成功！");
      console.log(`[TEST]    Response:`, JSON.stringify(pushResponse, null, 2));
      
      return Response.json({
        success: true,
        method: "pushMessage (single)",
        target_user: firstUser,
        response: pushResponse,
      });
    } catch (pushErr) {
      console.error("[TEST] ❌ pushMessage 失敗");
      console.error("[TEST]    Error type:", pushErr?.constructor?.name);
      console.error("[TEST]    Error message:", pushErr?.message);
      console.error("[TEST]    Error statusCode:", pushErr?.statusCode);
      console.error("[TEST]    Error details:", JSON.stringify(pushErr, null, 2));
      
      // 如果 pushMessage 失敗，嘗試 multicast
      console.log("[TEST] 🔄 嘗試改用 multicast...");
      try {
        const multicastResponse = await client.multicast(testUserIds, testMessage);
        console.log("[TEST] ✅ multicast 成功！");
        console.log(`[TEST]    Response:`, JSON.stringify(multicastResponse, null, 2));
        
        return Response.json({
          success: true,
          method: "multicast (fallback)",
          target_users: testUserIds,
          response: multicastResponse,
        });
      } catch (multicastErr) {
        console.error("[TEST] ❌ multicast 也失敗！");
        console.error("[TEST]    Error type:", multicastErr?.constructor?.name);
        console.error("[TEST]    Error message:", multicastErr?.message);
        console.error("[TEST]    Error statusCode:", multicastErr?.statusCode);
        console.error("[TEST]    Error details:", JSON.stringify(multicastErr, null, 2));
        
        return Response.json(
          {
            success: false,
            error: "Both pushMessage and multicast failed",
            pushMessage_error: {
              type: pushErr?.constructor?.name,
              message: pushErr?.message,
              statusCode: pushErr?.statusCode,
            },
            multicast_error: {
              type: multicastErr?.constructor?.name,
              message: multicastErr?.message,
              statusCode: multicastErr?.statusCode,
            },
          },
          { status: 500 }
        );
      }
    }
  } catch (err) {
    console.error("[TEST] 💥 初始化失敗:", err);
    return Response.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
