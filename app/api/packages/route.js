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

    // Find the Unit ID
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("id")
      .or(`unit_code.eq.${recipient_room},unit_number.eq.${recipient_room}`)
      .single();

    if (unitError || !unit) {
      return Response.json({ error: "Room not found in database" }, { status: 404 });
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
        unit_id: unit.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Find LINE User ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("line_user_id")
      .eq("unit_id", unit.id)
      .single();

    // Send LINE Notification
    if (!profileError && profile?.line_user_id) {
      const time = new Date(arrived_at).toLocaleString("zh-TW", { hour12: false });

      const flexMessage = {
        type: "flex",
        altText: "📦 Package Notification",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "📦 Package Notification", weight: "bold", size: "lg" },
              { type: "separator", margin: "md" },
              { type: "text", text: `Recipient: ${recipient_name}`, margin: "md" },
              { type: "text", text: `Room: ${recipient_room}`, margin: "sm" },
              { type: "text", text: `Courier: ${courier}`, margin: "sm" },
              { type: "text", text: `Time: ${time}`, margin: "sm" },
            ],
          },
        },
      };

      await client.pushMessage(profile.line_user_id, flexMessage);
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
