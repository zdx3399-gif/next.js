import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY")
  }
  return createClient(url, serviceRoleKey || anonKey)
}

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const channelSecret = process.env.LINE_CHANNEL_SECRET

  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET")
  }
  return new Client({ channelAccessToken, channelSecret })
}

async function findLineUserByUnit(supabase, unitId) {
  let lineUserId = null
  let lineDisplayName = null

  try {
    const { data: directProfiles } = await supabase
      .from("profiles")
      .select("id, line_user_id, line_display_name, name")
      .eq("unit_id", unitId)

    if (directProfiles && directProfiles.length > 0) {
      const profileWithLine = directProfiles.find((p) => p.line_user_id)
      if (profileWithLine) {
        return {
          lineUserId: profileWithLine.line_user_id,
          lineDisplayName: profileWithLine.line_display_name || profileWithLine.name,
        }
      }

      const profileIds = directProfiles.map((p) => p.id).filter(Boolean)
      if (profileIds.length > 0) {
        const { data: lineUsers } = await supabase
          .from("line_users")
          .select("line_user_id, display_name, profile_id")
          .in("profile_id", profileIds)

        const lineUser = (lineUsers || []).find((u) => u.line_user_id)
        if (lineUser) {
          return {
            lineUserId: lineUser.line_user_id,
            lineDisplayName: lineUser.display_name,
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Visitor LINE] profiles lookup failed:", e)
  }

  try {
    const { data: members } = await supabase
      .from("household_members")
      .select("profile_id, name")
      .eq("unit_id", unitId)

    const profileIds = (members || []).map((m) => m.profile_id).filter(Boolean)

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, line_user_id, line_display_name, name")
        .in("id", profileIds)

      const profileWithLine = (profiles || []).find((p) => p.line_user_id)
      if (profileWithLine) {
        return {
          lineUserId: profileWithLine.line_user_id,
          lineDisplayName: profileWithLine.line_display_name || profileWithLine.name,
        }
      }

      const { data: lineUsers } = await supabase
        .from("line_users")
        .select("line_user_id, display_name, profile_id")
        .in("profile_id", profileIds)

      const lineUser = (lineUsers || []).find((u) => u.line_user_id)
      if (lineUser) {
        return {
          lineUserId: lineUser.line_user_id,
          lineDisplayName: lineUser.display_name,
        }
      }
    }
  } catch (e) {
    console.warn("[Visitor LINE] household_members lookup failed:", e)
  }

  return { lineUserId, lineDisplayName }
}

// POST: 新增訪客預約
export async function POST(req) {
  try {
    const supabase = getSupabase()
    const client = getLineClient()

    const body = await req.json()
    const { name, phone, purpose, reservation_time, unit_id, reserved_by, reserved_by_id } = body

    if (!name || !phone || !reservation_time) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    const insertData = {
      name,
      phone,
      purpose: purpose || null,
      reservation_time,
      status: "reserved",
    }

    if (unit_id) {
      insertData.unit_id = unit_id
    }
    if (reserved_by_id) {
      insertData.reserved_by_id = reserved_by_id
    }

    const { data: visitor, error } = await supabase.from("visitors").insert([insertData]).select().single()

    if (error) {
      console.error("[visitor] POST error:", error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    // 發送 LINE 通知
    if (unit_id) {
      const { lineUserId, lineDisplayName } = await findLineUserByUnit(supabase, unit_id)

      if (lineUserId) {
        const flexMessage = {
          type: "flex",
          altText: `👤 訪客預約通知 - ${name}`,
          contents: {
            type: "bubble",
            hero: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "👤 訪客預約通知",
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
                  text: `訪客：${name}`,
                  margin: "md",
                  size: "md",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `電話：${phone}`,
                  margin: "sm",
                  color: "#666666",
                },
                { type: "separator", margin: "md" },
                {
                  type: "text",
                  text: `到訪目的：${purpose || "未指定"}`,
                  margin: "md",
                  color: "#333333",
                },
                {
                  type: "text",
                  text: `預約時間：${new Date(reservation_time).toLocaleString("zh-TW", { hour12: false })}`,
                  margin: "sm",
                  color: "#666666",
                  size: "sm",
                },
                { type: "separator", margin: "md" },
                {
                  type: "text",
                  text: "訪客將在此時間到達管理室簽到",
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
          console.log(`[Visitor LINE] Reservation notification sent to ${lineDisplayName || lineUserId}`)
        } catch (e) {
          console.error("[Visitor LINE] Failed to send reservation notification:", e)
        }
      }
    }

    return Response.json({ success: true, id: visitor.id })
  } catch (err) {
    console.error("[visitor] POST error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

// PATCH: 簽到或簽退訪客
export async function PATCH(req) {
  try {
    const supabase = getSupabase()
    const client = getLineClient()

    const body = await req.json()
    const { visitor_id, action } = body

    if (!visitor_id || !action) {
      return Response.json({ error: "Missing visitor_id or action" }, { status: 400 })
    }

    const { data: visitor, error: fetchError } = await supabase
      .from("visitors")
      .select("id, name, unit_id")
      .eq("id", visitor_id)
      .single()

    if (fetchError || !visitor) {
      return Response.json({ error: "Visitor not found" }, { status: 404 })
    }

    const updateData = {}

    if (action === "check_in") {
      updateData.status = "checked_in"
      updateData.checked_in_at = new Date().toISOString()
    } else if (action === "check_out") {
      updateData.status = "checked_out"
      updateData.checked_out_at = new Date().toISOString()
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 })
    }

    const { error } = await supabase.from("visitors").update(updateData).eq("id", visitor_id)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // 發送 LINE 通知
    if (visitor.unit_id) {
      const { lineUserId, lineDisplayName } = await findLineUserByUnit(supabase, visitor.unit_id)

      if (lineUserId) {
        const actionText = action === "check_in" ? "已簽到" : "已簽退"
        const bgColor = action === "check_in" ? "#0084ff" : "#06c755"
        const emoji = action === "check_in" ? "🔔" : "✅"

        const flexMessage = {
          type: "flex",
          altText: `${emoji} 訪客${actionText} - ${visitor.name}`,
          contents: {
            type: "bubble",
            hero: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: `${emoji} 訪客${actionText}`,
                  weight: "bold",
                  size: "xl",
                  color: "#ffffff",
                },
              ],
              backgroundColor: bgColor,
              paddingAll: "20px",
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: `訪客：${visitor.name}`,
                  margin: "md",
                  size: "md",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `時間：${new Date().toLocaleString("zh-TW", { hour12: false })}`,
                  margin: "sm",
                  color: "#666666",
                },
              ],
            },
          },
        }

        try {
          await client.pushMessage(lineUserId, flexMessage)
          console.log(`[Visitor LINE] ${actionText} notification sent to ${lineDisplayName || lineUserId}`)
        } catch (e) {
          console.error(`[Visitor LINE] Failed to send ${actionText} notification:`, e)
        }
      }
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error("[visitor] PATCH error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}
