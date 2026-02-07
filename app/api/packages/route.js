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

// ✅ LINE client 也延後建立
function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET.");
  }
  return new Client({ channelAccessToken, channelSecret });
}

// 1. ADDING A NEW PACKAGE (POST)
export async function POST(req) {
  try {
    const supabase = getSupabase();
    const client = getLineClient();

    const body = await req.json();
    const { courier, recipient_name, recipient_room, tracking_number, arrived_at, test } = body;

    // Validation
    if (!courier || !recipient_name || !recipient_room || !arrived_at) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (test === true) return Response.json({ message: "Test success" });

    // Find the Unit ID with ENHANCED normalization + fallback strategies
    // 強化房號正規化：移除所有空格、"棟"、"樓"、"F"、"室" 等中文字，轉大寫
    const normalizeRoom = (s) => {
      if (!s) return ""
      return s
        .toString()
        .trim()
        .toUpperCase()
        .replace(/[棟樓室層\s]/g, "") // 移除中文字和空格
        .replace(/F/gi, "") // 移除 F
        .replace(/-/g, "") // 暫時移除連字號以便比對
    }

    const normalized = normalizeRoom(recipient_room)
    let foundUnit = null

    // 策略 1: 直接精確比對（原始格式）
    const { data: exact1 } = await supabase
      .from("units")
      .select("id, unit_code")
      .or(`unit_code.eq.${recipient_room},unit_number.eq.${recipient_room}`)
      .limit(1)
    if (exact1 && exact1.length > 0) {
      foundUnit = exact1[0]
      console.log(`[packages] Found unit by exact match: ${exact1[0].unit_code}`)
    }

    // 策略 2: 查找所有 units，用正規化比對
    if (!foundUnit) {
      const { data: allUnits } = await supabase.from("units").select("id, unit_code, unit_number")
      if (allUnits && allUnits.length > 0) {
        for (const u of allUnits) {
          const normCode = normalizeRoom(u.unit_code)
          const normNum = normalizeRoom(u.unit_number)
          if (normCode === normalized || normNum === normalized) {
            foundUnit = u
            console.log(`[packages] Found unit by normalized match: ${u.unit_code} (input: ${recipient_room})`)
            break
          }
        }
      }
    }

    // 策略 3: 模糊比對（包含關係）
    if (!foundUnit) {
      const { data: likeUnits } = await supabase
        .from("units")
        .select("id, unit_code")
        .ilike("unit_code", `%${recipient_room}%`)
        .limit(1)
      if (likeUnits && likeUnits.length > 0) {
        foundUnit = likeUnits[0]
        console.log(`[packages] Found unit by fuzzy match: ${likeUnits[0].unit_code}`)
      }
    }

    if (!foundUnit) {
      return Response.json({ error: "Room not found in database" }, { status: 404 })
    }

    // Save package
    const { data: insertedPackage, error: insertError } = await supabase
      .from("packages")
      .insert({
        courier,
        recipient_name,
        recipient_room,
        tracking_number: tracking_number || null,
        arrived_at,
        unit_id: foundUnit.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Find LINE User ID with ENHANCED multi-strategy lookup
    let lineUserId = null
    let lineDisplayName = null

    // 策略 1: 從 profiles 表直接查找（根據 unit_id）
    try {
      const { data: directProfiles } = await supabase
        .from("profiles")
        .select("id, line_user_id, line_display_name")
        .eq("unit_id", foundUnit.id)

      if (directProfiles && directProfiles.length > 0) {
        const profileWithLine = directProfiles.find((p) => p.line_user_id)
        if (profileWithLine) {
          lineUserId = profileWithLine.line_user_id
          lineDisplayName = profileWithLine.line_display_name || null
          console.log(`[LINE] Found via profiles.unit_id: ${lineDisplayName || lineUserId}`)
        }
      }
    } catch (e) {
      console.warn("[LINE] profiles by unit_id query failed:", e)
    }

    // 策略 2: 從 household_members → profiles 查找（更全面）
    if (!lineUserId) {
      try {
        const { data: members } = await supabase
          .from("household_members")
          .select("profile_id, name")
          .eq("unit_id", foundUnit.id)

        const profileIds = (members || []).map((m) => m.profile_id).filter(Boolean)
        console.log(`[LINE] Found ${profileIds.length} household members for unit ${foundUnit.id}`)

        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, line_user_id, line_display_name, name")
            .in("id", profileIds)

          const profileWithLine = (profiles || []).find((p) => p.line_user_id)
          if (profileWithLine) {
            lineUserId = profileWithLine.line_user_id
            lineDisplayName = profileWithLine.line_display_name || profileWithLine.name || null
            console.log(
              `[LINE] Found via household_members->profiles: ${lineDisplayName || lineUserId}`,
            )
          } else {
            console.warn(
              `[LINE] Found ${profiles?.length || 0} profiles but none have line_user_id bound`,
            )
          }
        }
      } catch (e) {
        console.warn("[LINE] household_members->profiles query failed:", e)
      }
    }

    // 策略 3: 如果仍找不到，記錄詳細訊息
    if (!lineUserId) {
      console.warn(
        `[LINE] No LINE user found for unit ${foundUnit.id} (${foundUnit.unit_code}). Please bind LINE account first.`,
      )
    }

    // Send LINE notification if found
    if (lineUserId) {
      const time = new Date(arrived_at).toLocaleString("zh-TW", { hour12: false })

      const flexMessage = {
        type: "flex",
        altText: `📦 您有新包裹到達 - ${courier}`,
        contents: {
          type: "bubble",
          hero: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "📦 包裹到達通知",
                weight: "bold",
                size: "xl",
                color: "#ffffff",
              },
            ],
            backgroundColor: "#0084ff",
            paddingAll: "20px",
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: `收件人：${recipient_name}`,
                margin: "md",
                size: "md",
                weight: "bold",
              },
              {
                type: "text",
                text: `房號：${recipient_room}`,
                margin: "sm",
                color: "#666666",
              },
              { type: "separator", margin: "md" },
              {
                type: "text",
                text: `快遞公司：${courier}`,
                margin: "md",
                color: "#333333",
              },
              {
                type: "text",
                text: tracking_number ? `追蹤號：${tracking_number}` : "追蹤號：無",
                margin: "sm",
                color: "#666666",
                size: "sm",
              },
              {
                type: "text",
                text: `到達時間：${time}`,
                margin: "sm",
                color: "#666666",
                size: "sm",
              },
              { type: "separator", margin: "md" },
              {
                type: "text",
                text: "請儘速至管理處領取包裹🎁",
                margin: "md",
                color: "#0084ff",
                weight: "bold",
                align: "center",
              },
            ],
          },
        },
      }

      try {
        await client.pushMessage(lineUserId, flexMessage)
        console.log(`[LINE] Notification sent successfully to ${lineDisplayName || lineUserId}`)
      } catch (e) {
        console.error("[LINE] Failed to push LINE message:", e.message || e)
      }
    } else {
      console.info(`[LINE] No line_user_id found for unit: ${foundUnit.id} (${foundUnit.unit_code})`)
    }

    return Response.json({ success: true, id: insertedPackage?.id });
  } catch (err) {
    console.error("[packages] POST error:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

// 2. MARKING AS PICKED UP (PATCH)
export async function PATCH(req) {
  try {
    const supabase = getSupabase();

    const body = await req.json();
    const { packageId, picked_up_by } = body;

    if (!packageId || !picked_up_by) {
      return Response.json({ error: "Package ID and Picker Name required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("packages")
      .update({
        status: "picked_up",
        picked_up_by,
        picked_up_at: new Date().toISOString(),
      })
      .eq("id", packageId);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error("[packages] PATCH error:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
