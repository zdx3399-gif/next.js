import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"
import { writeServerAuditLog } from "@/lib/audit-server"

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

    }
  } catch (e) {
    console.warn("[Visitor LINE] household_members lookup failed:", e)
  }

  return { lineUserId, lineDisplayName }
}

function getVisitorOperator(payload = {}) {
  return {
    id: payload.actor_id || payload.reserved_by_id || payload.operatorId || undefined,
    role: payload.actor_role || payload.operatorRole || "unknown",
  }
}

async function sendIotCommand(req, cmd) {
  try {
    const iotUrl = new URL("/api/iot", req.url)
    const res = await fetch(iotUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd }),
    })

    const payload = await res.json().catch(() => null)
    const success = !!(res.ok && payload?.success)
    return {
      success,
      error: success ? undefined : payload?.error || `IOT 命令失敗（${res.status}）`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "IOT 連線失敗",
    }
  }
}

// POST: 新增訪客預約
export async function POST(req) {
  try {
    const supabase = getSupabase()
    const client = getLineClient()

    const body = await req.json()
    const { name, phone, purpose, reservation_time, unit_id, reserved_by, reserved_by_id } = body
    const operator = getVisitorOperator(body)

    if (!name || !phone || !reservation_time) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_visitor",
        targetType: "system",
        targetId: "unknown",
        reason: "Missing required fields",
        module: "visitor",
        status: "blocked",
        errorCode: "missing_required_fields",
      })
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
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "create_visitor",
        targetType: "system",
        targetId: "unknown",
        reason: error.message,
        module: "visitor",
        status: "failed",
        errorCode: error.message,
      })
      return Response.json({ error: error.message }, { status: 500 })
    }

    await writeServerAuditLog({
      supabase,
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "create_visitor",
      targetType: "system",
      targetId: visitor.id,
      reason: reserved_by || name,
      module: "visitor",
      status: "success",
      afterState: { status: "reserved", reservation_time, unit_id: unit_id || null },
    })

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

    const iotResult = await sendIotCommand(req, "V")

    return Response.json({ 
      success: true, 
      id: visitor.id,
      message: iotResult.success ? "✅ 訪客預約成功（IOT 已通知）" : "✅ 訪客預約成功（IOT 通知失敗）",
      iotSent: iotResult.success,
      iotError: iotResult.error,
    })
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
    const operator = getVisitorOperator(body)

    if (!visitor_id || !action) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: action === "check_out" ? "check_out_visitor" : "check_in_visitor",
        targetType: "system",
        targetId: visitor_id || "unknown",
        reason: "Missing visitor_id or action",
        module: "visitor",
        status: "blocked",
        errorCode: "missing_required_fields",
      })
      return Response.json({ error: "Missing visitor_id or action" }, { status: 400 })
    }

    const { data: visitor, error: fetchError } = await supabase
      .from("visitors")
      .select("id, name, unit_id")
      .eq("id", visitor_id)
      .single()

    if (fetchError || !visitor) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: action === "check_out" ? "check_out_visitor" : "check_in_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "Visitor not found",
        module: "visitor",
        status: "blocked",
        errorCode: "visitor_not_found",
      })
      return Response.json({ error: "Visitor not found" }, { status: 404 })
    }

    const updateData = {}
    let actionText = ""

    if (action === "check_in") {
      updateData.status = "checked_in"
      updateData.checked_in_at = new Date().toISOString()
      actionText = "已簽到"
    } else if (action === "check_out") {
      updateData.status = "checked_out"
      updateData.checked_out_at = new Date().toISOString()
      actionText = "已簽退"
    } else {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "Invalid action",
        module: "visitor",
        status: "blocked",
        errorCode: "invalid_action",
      })
      return Response.json({ error: "Invalid action" }, { status: 400 })
    }

    const { error } = await supabase.from("visitors").update(updateData).eq("id", visitor_id)

    if (error) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: action === "check_out" ? "check_out_visitor" : "check_in_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: error.message,
        module: "visitor",
        status: "failed",
        errorCode: error.message,
      })
      return Response.json({ error: error.message }, { status: 500 })
    }

    await writeServerAuditLog({
      supabase,
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: action === "check_out" ? "check_out_visitor" : "check_in_visitor",
      targetType: "system",
      targetId: visitor_id,
      reason: visitor.name,
      module: "visitor",
      status: "success",
      afterState: updateData,
    })

    // 發送 LINE 通知
    if (visitor.unit_id) {
      const { lineUserId, lineDisplayName } = await findLineUserByUnit(supabase, visitor.unit_id)

      if (lineUserId) {
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

    const iotResult = await sendIotCommand(req, "V")

    return Response.json({ 
      success: true,
      message: iotResult.success
        ? `✅ 訪客${actionText}成功（IOT 已通知）`
        : `✅ 訪客${actionText}成功（IOT 通知失敗）`,
      iotSent: iotResult.success,
      iotError: iotResult.error,
    })
  } catch (err) {
    console.error("[visitor] PATCH error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

// PUT: 住戶修改預約訪客（僅 reserved 狀態）
export async function PUT(req) {
  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { visitor_id, name, phone, purpose, reservation_time, actor_id, actor_role } = body
    const operator = getVisitorOperator(body)

    if (!visitor_id || !name || !phone || !reservation_time) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_visitor",
        targetType: "system",
        targetId: visitor_id || "unknown",
        reason: "Missing required fields",
        module: "visitor",
        status: "blocked",
        errorCode: "missing_required_fields",
      })
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (actor_role === "guard") {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "警衛不可修改預約訪客",
        module: "visitor",
        status: "blocked",
        errorCode: "forbidden",
      })
      return Response.json({ error: "警衛不可修改預約訪客" }, { status: 403 })
    }

    const { data: visitor, error: fetchError } = await supabase
      .from("visitors")
      .select("id, status, reserved_by_id")
      .eq("id", visitor_id)
      .maybeSingle()

    if (fetchError || !visitor) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "Visitor not found",
        module: "visitor",
        status: "blocked",
        errorCode: "visitor_not_found",
      })
      return Response.json({ error: "Visitor not found" }, { status: 404 })
    }

    if (visitor.status !== "reserved") {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "僅可修改尚未簽到的預約訪客",
        module: "visitor",
        status: "blocked",
        errorCode: "invalid_status",
      })
      return Response.json({ error: "僅可修改尚未簽到的預約訪客" }, { status: 400 })
    }

    const isPrivileged = actor_role === "admin" || actor_role === "committee"
    if (!isPrivileged && visitor.reserved_by_id && visitor.reserved_by_id !== actor_id) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "僅可修改自己預約的訪客",
        module: "visitor",
        status: "blocked",
        errorCode: "forbidden",
      })
      return Response.json({ error: "僅可修改自己預約的訪客" }, { status: 403 })
    }

    const { error } = await supabase
      .from("visitors")
      .update({
        name,
        phone,
        purpose: purpose || null,
        reservation_time,
      })
      .eq("id", visitor_id)

    if (error) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "update_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: error.message,
        module: "visitor",
        status: "failed",
        errorCode: error.message,
      })
      return Response.json({ error: error.message }, { status: 500 })
    }

    await writeServerAuditLog({
      supabase,
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "update_visitor",
      targetType: "system",
      targetId: visitor_id,
      reason: name,
      module: "visitor",
      status: "success",
      afterState: { name, phone, purpose: purpose || null, reservation_time },
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error("[visitor] PUT error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

// DELETE: 住戶刪除預約訪客（僅 reserved 狀態）
export async function DELETE(req) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)

    const visitor_id = searchParams.get("visitor_id")
    const actor_id = searchParams.get("actor_id")
    const actor_role = searchParams.get("actor_role")
    const operator = getVisitorOperator({ actor_id, actor_role })

    if (!visitor_id) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_visitor",
        targetType: "system",
        targetId: "unknown",
        reason: "Missing visitor_id",
        module: "visitor",
        status: "blocked",
        errorCode: "missing_visitor_id",
      })
      return Response.json({ error: "Missing visitor_id" }, { status: 400 })
    }

    if (actor_role === "guard") {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "警衛不可刪除預約訪客",
        module: "visitor",
        status: "blocked",
        errorCode: "forbidden",
      })
      return Response.json({ error: "警衛不可刪除預約訪客" }, { status: 403 })
    }

    const { data: visitor, error: fetchError } = await supabase
      .from("visitors")
      .select("id, status, reserved_by_id")
      .eq("id", visitor_id)
      .maybeSingle()

    if (fetchError || !visitor) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "Visitor not found",
        module: "visitor",
        status: "blocked",
        errorCode: "visitor_not_found",
      })
      return Response.json({ error: "Visitor not found" }, { status: 404 })
    }

    if (visitor.status !== "reserved") {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "僅可刪除尚未簽到的預約訪客",
        module: "visitor",
        status: "blocked",
        errorCode: "invalid_status",
      })
      return Response.json({ error: "僅可刪除尚未簽到的預約訪客" }, { status: 400 })
    }

    const isPrivileged = actor_role === "admin" || actor_role === "committee"
    if (!isPrivileged && visitor.reserved_by_id && visitor.reserved_by_id !== actor_id) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: "僅可刪除自己預約的訪客",
        module: "visitor",
        status: "blocked",
        errorCode: "forbidden",
      })
      return Response.json({ error: "僅可刪除自己預約的訪客" }, { status: 403 })
    }

    const { error } = await supabase.from("visitors").delete().eq("id", visitor_id)
    if (error) {
      await writeServerAuditLog({
        supabase,
        operatorId: operator.id,
        operatorRole: operator.role,
        actionType: "delete_visitor",
        targetType: "system",
        targetId: visitor_id,
        reason: error.message,
        module: "visitor",
        status: "failed",
        errorCode: error.message,
      })
      return Response.json({ error: error.message }, { status: 500 })
    }

    await writeServerAuditLog({
      supabase,
      operatorId: operator.id,
      operatorRole: operator.role,
      actionType: "delete_visitor",
      targetType: "system",
      targetId: visitor_id,
      reason: "刪除訪客預約",
      module: "visitor",
      status: "success",
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error("[visitor] DELETE error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}
