import { createClient } from "@supabase/supabase-js";
import { Client } from "@line/bot-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ 延後到 request 才建立，避免 build 階段就因 env 缺而爆
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error("supabaseUrl is required. Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }
  // 使用 service role key（如果有）以繞過 RLS；否則用 anon key
  return createClient(url, serviceRoleKey || anonKey);
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

async function findLineUserByUnit(supabase, unitId) {
  let lineUserId = null;
  let lineDisplayName = null;

  // Strategy 1: profiles by unit_id
  try {
    const { data: directProfiles, error: directError } = await supabase
      .from("profiles")
      .select("id, line_user_id, line_display_name, name")
      .eq("unit_id", unitId);

    if (directError) throw directError;

    if (directProfiles && directProfiles.length > 0) {
      const profileWithLine = directProfiles.find((p) => p.line_user_id);
      if (profileWithLine) {
        return {
          lineUserId: profileWithLine.line_user_id,
          lineDisplayName: profileWithLine.line_display_name || profileWithLine.name || null,
        };
      }

    }
  } catch (e) {
    console.warn("[LINE] profiles lookup failed:", e);
  }

  // Strategy 2: household_members -> profiles
  try {
    const { data: members, error: membersError } = await supabase
      .from("household_members")
      .select("profile_id, name")
      .eq("unit_id", unitId);

    if (membersError) throw membersError;

    const profileIds = (members || []).map((m) => m.profile_id).filter(Boolean);
    console.log(`[LINE] Found ${profileIds.length} household members for unit ${unitId}`);

    if (profileIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, line_user_id, line_display_name, name")
        .in("id", profileIds);

      if (profilesError) throw profilesError;

      const profileWithLine = (profiles || []).find((p) => p.line_user_id);
      if (profileWithLine) {
        return {
          lineUserId: profileWithLine.line_user_id,
          lineDisplayName: profileWithLine.line_display_name || profileWithLine.name || null,
        };
      }

    }
  } catch (e) {
    console.warn("[LINE] household_members lookup failed:", e);
  }

  return { lineUserId, lineDisplayName };
}

function normalizeRoom(room) {
  if (!room) return "";
  return room
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[棟樓室層\s]/g, "")
    .replace(/F/gi, "")
    .replace(/-/g, "");
}

async function resolveUnitByRoom(supabase, recipientRoom) {
  const normalized = normalizeRoom(recipientRoom);

  let foundUnit = null;

  const { data: exact1 } = await supabase
    .from("units")
    .select("id, unit_code")
    .or(`unit_code.eq.${recipientRoom},unit_number.eq.${recipientRoom}`)
    .limit(1);

  if (exact1 && exact1.length > 0) {
    foundUnit = exact1[0];
  }

  if (!foundUnit) {
    const { data: allUnits } = await supabase.from("units").select("id, unit_code, unit_number");
    if (allUnits && allUnits.length > 0) {
      for (const u of allUnits) {
        const normCode = normalizeRoom(u.unit_code);
        const normNum = normalizeRoom(u.unit_number);
        if (normCode === normalized || normNum === normalized) {
          foundUnit = u;
          break;
        }
      }
    }
  }

  if (!foundUnit) {
    const { data: likeUnits } = await supabase
      .from("units")
      .select("id, unit_code")
      .ilike("unit_code", `%${recipientRoom}%`)
      .limit(1);
    if (likeUnits && likeUnits.length > 0) {
      foundUnit = likeUnits[0];
    }
  }

  return foundUnit;
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

    const foundUnit = await resolveUnitByRoom(supabase, recipient_room)

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

    // Find LINE User ID with multi-strategy lookup (profiles + line_users)
    const { lineUserId, lineDisplayName } = await findLineUserByUnit(supabase, foundUnit.id)

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
        console.log(`[LINE] Attempting to send notification to ${lineDisplayName || lineUserId}`)
        console.log(`[LINE] Message preview: 收件人=${recipient_name}, 房號=${recipient_room}, 快遞=${courier}`)
        
        await client.pushMessage(lineUserId, flexMessage)
        console.log(`[LINE] ✅ Notification sent successfully to ${lineDisplayName || lineUserId}`)
      } catch (e) {
        console.error("[LINE] ❌ Failed to push LINE message:")
        console.error("[LINE] Error type:", e.constructor.name)
        console.error("[LINE] Error message:", e.message || e)
        console.error("[LINE] Full error:", JSON.stringify(e, null, 2))
        
        // 不因 LINE 發送失敗而中斷包裹儲存
        // 包裹已經成功儲存，只記錄 LINE 錯誤
      }
    } else {
      console.warn(`[LINE] ⚠️ No line_user_id found for unit: ${foundUnit.id} (${foundUnit.unit_code})`)
      console.warn(`[LINE] Please ask the resident to bind LINE account via /bind-line page`)
    }

    return Response.json({ 
      success: true, 
      id: insertedPackage?.id,
      message: "✅ 包裹建立成功"
    });
  } catch (err) {
    console.error("[packages] POST error:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

// 3. EDIT PACKAGE (PUT)
export async function PUT(req) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const { id, courier, recipient_name, recipient_room, tracking_number, arrived_at } = body;

    if (!id || !courier || !recipient_name || !recipient_room || !arrived_at) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("packages")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (existingError || !existing) {
      return Response.json({ error: "Package not found" }, { status: 404 });
    }

    if (existing.status === "picked_up") {
      return Response.json({ error: "已領取包裹不可編輯" }, { status: 400 });
    }

    const foundUnit = await resolveUnitByRoom(supabase, recipient_room);
    if (!foundUnit) {
      return Response.json({ error: "Room not found in database" }, { status: 404 });
    }

    const { error } = await supabase
      .from("packages")
      .update({
        courier,
        recipient_name,
        recipient_room,
        tracking_number: tracking_number || null,
        arrived_at,
        unit_id: foundUnit.id,
      })
      .eq("id", id);

    if (error) throw error;

    return Response.json({ 
      success: true,
      message: "✅ 包裹已更新"
    });
  } catch (err) {
    console.error("[packages] PUT error:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

// 4. DELETE PACKAGE (DELETE)
export async function DELETE(req) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Package ID required" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("packages")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (existingError || !existing) {
      return Response.json({ error: "Package not found" }, { status: 404 });
    }

    if (existing.status === "picked_up") {
      return Response.json({ error: "已領取包裹不可刪除" }, { status: 400 });
    }

    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) throw error;

    return Response.json({ 
      success: true,
      message: "✅ 包裹已刪除"
    });
  } catch (err) {
    console.error("[packages] DELETE error:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

// 2. MARKING AS PICKED UP (PATCH)
export async function PATCH(req) {
  try {
    const supabase = getSupabase();
    const client = getLineClient();

    const body = await req.json();
    const { packageId, picked_up_by } = body;

    if (!packageId || !picked_up_by) {
      return Response.json({ error: "Package ID and Picker Name required" }, { status: 400 });
    }

    // 先查詢包裹資訊（需要通知用）
    const { data: packageData, error: fetchError } = await supabase
      .from("packages")
      .select("id, courier, recipient_name, recipient_room, tracking_number, unit_id, arrived_at")
      .eq("id", packageId)
      .single();

    if (fetchError || !packageData) {
      console.error("[PATCH] Package not found:", fetchError);
      return Response.json({ error: "Package not found" }, { status: 404 });
    }

    // 更新包裹狀態
    const { error } = await supabase
      .from("packages")
      .update({
        status: "picked_up",
        picked_up_by,
        picked_up_at: new Date().toISOString(),
      })
      .eq("id", packageId);

    if (error) throw error;

    // 發送「已領取」LINE 通知
    if (packageData.unit_id) {
      const { lineUserId, lineDisplayName } = await findLineUserByUnit(
        supabase,
        packageData.unit_id,
      )

      if (lineUserId) {
        const pickupTime = new Date().toLocaleString("zh-TW", { hour12: false });

        const flexMessage = {
          type: "flex",
          altText: `✅ 包裹已被領取 - ${packageData.courier}`,
          contents: {
            type: "bubble",
            hero: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "✅ 包裹已領取通知",
                  weight: "bold",
                  size: "xl",
                  color: "#ffffff",
                },
              ],
              backgroundColor: "#06c755",
              paddingAll: "20px",
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: `收件人：${packageData.recipient_name}`,
                  margin: "md",
                  size: "md",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `房號：${packageData.recipient_room}`,
                  margin: "sm",
                  color: "#666666",
                },
                { type: "separator", margin: "md" },
                {
                  type: "text",
                  text: `快遞公司：${packageData.courier}`,
                  margin: "md",
                  color: "#333333",
                },
                {
                  type: "text",
                  text: packageData.tracking_number
                    ? `追蹤號：${packageData.tracking_number}`
                    : "追蹤號：無",
                  margin: "sm",
                  color: "#666666",
                  size: "sm",
                },
                { type: "separator", margin: "md" },
                {
                  type: "text",
                  text: `領取人：${picked_up_by}`,
                  margin: "md",
                  color: "#06c755",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `領取時間：${pickupTime}`,
                  margin: "sm",
                  color: "#666666",
                  size: "sm",
                },
              ],
            },
          },
        };

        try {
          await client.pushMessage(lineUserId, flexMessage);
          console.log(`[PATCH LINE] Pickup notification sent to ${lineDisplayName || lineUserId}`);
        } catch (e) {
          console.error("[PATCH LINE] Failed to send notification:", e.message || e);
        }
      } else {
        console.warn(`[PATCH LINE] No LINE user found for unit ${packageData.unit_id}`);
      }
    }

    return Response.json({ 
      success: true,
      message: "✅ 包裹已領取"
    });
  } catch (err) {
    console.error("[packages] PATCH error:", err);
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
