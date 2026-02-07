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

    // Find the Unit ID with normalization + fallback strategies
    const normalize = (s) => (s || "").toString().trim()
    const tryVariants = [
      normalize(recipient_room),
      normalize(recipient_room).replace(/\s+/g, ""),
      normalize(recipient_room).replace(/\s+/g, "-"),
    ]

    let foundUnit = null
    for (const v of tryVariants) {
      if (!v) continue
      // exact match unit_code
      const { data: exact1 } = await supabase.from("units").select("id").eq("unit_code", v).limit(1)
      if (exact1 && exact1.length > 0) {
        foundUnit = exact1[0]
        break
      }
      // exact match unit_number
      const { data: exact2 } = await supabase.from("units").select("id").eq("unit_number", v).limit(1)
      if (exact2 && exact2.length > 0) {
        foundUnit = exact2[0]
        break
      }
      // fuzzy match on unit_code
      const { data: like } = await supabase.from("units").select("id").ilike("unit_code", `%${v}%`).limit(1)
      if (like && like.length > 0) {
        foundUnit = like[0]
        break
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

    // Find LINE User ID: first try profiles.unit_id, otherwise fallback to household_members -> profiles
    let lineUserId = null

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, line_user_id")
        .eq("unit_id", foundUnit.id)
        .limit(1)

      if (!profileError && profile && profile.length > 0 && profile[0].line_user_id) {
        lineUserId = profile[0].line_user_id
      }
    } catch (e) {
      console.warn("profiles by unit_id query failed:", e)
    }

    // fallback: find household_members with profile_id, then lookup profiles for line_user_id
    if (!lineUserId) {
      try {
        const { data: members } = await supabase
          .from("household_members")
          .select("profile_id")
          .eq("unit_id", foundUnit.id)
          .limit(10)

        const profileIds = (members || []).map((m) => m.profile_id).filter(Boolean)
        if (profileIds.length > 0) {
          const { data: profiles2 } = await supabase.from("profiles").select("id, line_user_id").in("id", profileIds)
          const found = (profiles2 || []).find((p) => p.line_user_id)
          if (found) lineUserId = found.line_user_id
        }
      } catch (e) {
        console.warn("fallback household_members->profiles query failed:", e)
      }
    }

    if (lineUserId) {
      const time = new Date(arrived_at).toLocaleString("zh-TW", { hour12: false })

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
      }

      try {
        await client.pushMessage(lineUserId, flexMessage)
      } catch (e) {
        console.error("Failed to push LINE message:", e)
      }
    } else {
      console.info("No line_user_id found for unit:", foundUnit.id)
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
