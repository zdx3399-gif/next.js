export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  console.log("🧪 [TEST] 簡單推播測試端點被呼叫");
  
  // 硬編碼的 3 個用戶
  const lineUserIds = [
    "U3708bab580db72e87ac14df8c159249a",
    "U4f1fc1c05859b691ca3a51d2cfe8ff9d",
    "U5dbd8b5fb153630885b656bb5f8ae011"
  ];

  console.log(`[TEST] 準備推播給 ${lineUserIds.length} 位用戶`);

  // 創建測試訊息
  const testMessage = {
    type: "text",
    text: "🧪 這是簡單測試訊息，時間：" + new Date().toLocaleString("zh-TW")
  };

  try {
    const { Client } = await import("@line/bot-sdk");
    
    const client = new Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
    });

    let sent = 0;
    for (const userId of lineUserIds) {
      try {
        console.log(`[TEST] 推播給：${userId}`);
        await client.pushMessage(userId, testMessage);
        sent++;
        console.log(`[TEST] ✅ 成功`);
      } catch (e) {
        console.error(`[TEST] ❌ 失敗：${e?.message}`);
      }
    }

    return Response.json({ success: true, sent, total: lineUserIds.length });
  } catch (err) {
    console.error("[TEST] 初始化失敗:", err);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
