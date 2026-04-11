import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"

type NotificationRouting = {
  iotCommand: "E" | "C" | "V" | "P"
  title: string
}

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase env for emergency review API")
  }

  return createClient(url, serviceRoleKey)
}

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const channelSecret = process.env.LINE_CHANNEL_SECRET

  if (!channelAccessToken) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN")
  }

  return new Client({ channelAccessToken, channelSecret: channelSecret || "unused" })
}

async function getLineTargetsByRoles(supabase: any, roles: string[]) {
  const lineUserIds = new Set<string>()
  const { data: roleProfiles } = await supabase
    .from("profiles")
    .select("id, line_user_id")
    .in("role", roles)

  ;(roleProfiles || []).forEach((p: any) => {
    if (p?.line_user_id) {
      lineUserIds.add(p.line_user_id)
    }
  })

  return [...lineUserIds]
}

function resolveNotificationRouting(typeRaw: string, descriptionRaw: string): NotificationRouting {
  const text = `${typeRaw} ${descriptionRaw}`.toLowerCase()

  if (text.includes("訪客") || text.includes("visitor")) {
    return { iotCommand: "V", title: "訪客通知（審核通過）" }
  }
  if (text.includes("包裹") || text.includes("package")) {
    return { iotCommand: "P", title: "包裹通知（審核通過）" }
  }
  if (text.includes("取消") || text.includes("解除") || text.includes("cancel")) {
    return { iotCommand: "C", title: "緊急事件解除（審核通過）" }
  }

  return { iotCommand: "E", title: "緊急事件通知（審核通過）" }
}

async function createNotificationEvent(
  supabase: any,
  incidentId: string,
  title: string,
  message: string,
) {
  await supabase.from("notification_events").insert([
    {
      title,
      message,
      module_key: "emergency",
      action_link: "/admin?section=emergencies",
      payload: {
        emergency_incident_id: incidentId,
        source: "committee_review",
      },
    },
  ])
}

async function logIotCommand(
  supabase: any,
  incidentId: string,
  commandType: "E" | "C" | "V" | "P",
  createdBy: string,
  sendStatus: "sent" | "failed",
  commandPayload: Record<string, unknown>,
  responsePayload: unknown,
) {
  await supabase.from("iot_command_logs").insert([
    {
      command_type: commandType,
      target_device_id: "emergency-broadcast",
      related_type: "emergency",
      related_id: incidentId,
      command_payload: commandPayload,
      send_status: sendStatus,
      response_payload: responsePayload,
      sent_at: new Date().toISOString(),
      created_by: createdBy,
    },
  ])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const incidentId = String(body?.incidentId || "").trim()
    const action = String(body?.action || "").trim().toLowerCase()
    const reviewerId = String(body?.reviewerId || "").trim()

    if (!incidentId || !reviewerId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "incidentId/reviewerId/action 參數不完整" },
        { status: 400 },
      )
    }

    const supabase = getSupabase()

    const { data: reviewer } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", reviewerId)
      .maybeSingle()

    if (!reviewer || !["committee", "admin"].includes(String(reviewer.role || ""))) {
      return NextResponse.json(
        { success: false, error: "只有管委會或管理員可審核" },
        { status: 403 },
      )
    }

    const { data: incident } = await supabase
      .from("emergency_incidents")
      .select(`
        id,
        status,
        event_type,
        location,
        description,
        reporter_profile_id,
        reporter:profiles!emergency_incidents_reporter_profile_id_fkey(name)
      `)
      .eq("id", incidentId)
      .maybeSingle()

    if (!incident) {
      return NextResponse.json({ success: false, error: "找不到事件" }, { status: 404 })
    }

    if (incident.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `目前狀態為 ${incident.status}，不可再審核` },
        { status: 409 },
      )
    }

    const nextStatus = action === "approve" ? "approved" : "rejected"

    const { error: updateError } = await supabase
      .from("emergency_incidents")
      .update({
        status: nextStatus,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", incidentId)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    let iotSent = false
    let iotError = ""
    let lineSent = 0
    let lineFailed = 0
    let lineError = ""

    if (action === "approve") {
      const routing = resolveNotificationRouting(incident.event_type || "", incident.description || "")
      const reporterName = incident?.reporter?.name || "未知"
      const location = incident.location || "未提供"
      const description = incident.description || "（無）"

      try {
        const iotUrl = new URL("/api/iot", req.url)
        const commandPayload = {
          cmd: routing.iotCommand,
          emergencyIncidentId: incident.id,
          location,
        }
        const iotRes = await fetch(iotUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commandPayload),
        })
        const iotData = await iotRes.json().catch(() => null)
        iotSent = !!(iotRes.ok && iotData?.success)
        if (!iotSent) {
          iotError = iotData?.error || `IOT 命令失敗（${iotRes.status}）`
        }

        await logIotCommand(
          supabase,
          incident.id,
          routing.iotCommand,
          reviewerId,
          iotSent ? "sent" : "failed",
          commandPayload,
          iotData,
        )
      } catch (error) {
        iotSent = false
        iotError = error instanceof Error ? error.message : "IOT 連線失敗"
        await logIotCommand(
          supabase,
          incident.id,
          routing.iotCommand,
          reviewerId,
          "failed",
          { cmd: routing.iotCommand, emergencyIncidentId: incident.id, location },
          { error: iotError },
        )
      }

      try {
        const lineClient = getLineClient()
        const lineTargets = await getLineTargetsByRoles(supabase, ["admin", "guard", "committee"])
        const message =
          `🚨 ${routing.title}\n` +
          `類型：${incident.event_type || "未分類"}\n` +
          `發起人：${reporterName}\n` +
          `地點：${location}\n` +
          `時間：${new Date().toLocaleString("zh-TW", { hour12: false })}\n` +
          `內容：${description}`

        for (const to of lineTargets) {
          try {
            await lineClient.pushMessage(to, { type: "text", text: message })
            lineSent++
          } catch {
            lineFailed++
          }
        }

        await createNotificationEvent(supabase, incident.id, routing.title, message)
      } catch (error) {
        lineError = error instanceof Error ? error.message : "LINE 廣播失敗"
      }
    }

    return NextResponse.json({
      success: true,
      incidentId,
      status: nextStatus,
      iotSent,
      iotError: iotError || undefined,
      lineSent,
      lineFailed,
      lineError: lineError || undefined,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "審核失敗",
      },
      { status: 500 },
    )
  }
}
