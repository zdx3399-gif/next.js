import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"
import { writeServerAuditLog } from "@/lib/audit-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type NotificationCategory = "emergency" | "visitor" | "package"

interface NotificationRouting {
  category: NotificationCategory
  eventType: "emergency" | "visitor" | "package"
  iotCommand: "E" | "C" | "V" | "P"
  title: string
}

function composeIncidentDescription(note: string, description: string) {
  const sections = []

  if (note) {
    sections.push(`現場備註：${note}`)
  }

  if (description && description !== note) {
    sections.push(`事件描述：${description}`)
  }

  return sections.join("\n") || description || note || "緊急事件通報"
}

async function createNotificationEvent(
  supabase: any,
  routing: NotificationRouting,
  incidentId: string | undefined,
  location: string,
  description: string,
  reportedByName: string,
) {
  const message = `${routing.title}｜${reportedByName}\n地點：${location}\n事件：${description}`

  await supabase.from("notification_events").insert([
    {
      title: routing.title,
      message,
      module_key: "emergency",
      action_link: "/admin?section=emergencies",
      payload: {
        emergency_incident_id: incidentId,
        category: routing.category,
        event_type: routing.eventType,
      },
    },
  ])
}

async function logIotCommand(
  supabase: any,
  incidentId: string | undefined,
  commandType: "E" | "C" | "V" | "P",
  createdBy: string | null,
  targetDeviceId: string,
  sendStatus: "pending" | "sent" | "failed" | "timeout",
  commandPayload: Record<string, unknown>,
  responsePayload: unknown,
) {
  await supabase.from("iot_command_logs").insert([
    {
      command_type: commandType,
      target_device_id: targetDeviceId,
      related_type: "emergency",
      related_id: incidentId || null,
      command_payload: commandPayload,
      send_status: sendStatus,
      response_payload: responsePayload,
      sent_at: new Date().toISOString(),
      created_by: createdBy || null,
    },
  ])
}

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const dbKey = serviceRoleKey || anonKey

  if (!url || !dbKey) {
    throw new Error(
      "Missing Supabase env. Require NEXT_PUBLIC_TENANT_A_SUPABASE_URL/NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY or SUPABASE_URL/SUPABASE_ANON_KEY and service/anon key"
    )
  }

  return createClient(url, dbKey)
}

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const channelSecret = process.env.LINE_CHANNEL_SECRET

  if (!channelAccessToken) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN")
  }

  return new Client({ channelAccessToken, channelSecret: channelSecret || "unused" })
}

async function getEmergencyLineTargets(supabase: any) {
  return getLineTargetsByRoles(supabase, ["admin", "guard", "committee"])
}

async function getLineTargetsByRoles(supabase: any, roles: string[]) {
  const lineUserIds = new Set<string>()
  let totalTargets = 0
  let boundTargets = 0

  const { data: roleProfiles } = await supabase
    .from("profiles")
    .select("id, line_user_id")
    .in("role", roles)

  totalTargets = (roleProfiles || []).length
  ;(roleProfiles || []).forEach((p: any) => {
    if (p?.line_user_id) {
      lineUserIds.add(p.line_user_id)
      boundTargets++
    }
  })

  return { ids: [...lineUserIds], bound: boundTargets, total: totalTargets }
}

function resolveNotificationRouting(typeRaw: string, noteRaw: string): NotificationRouting {
  const text = `${typeRaw} ${noteRaw}`.toLowerCase()

  if (text.includes("訪客") || text.includes("visitor")) {
    return {
      category: "visitor",
      eventType: "visitor",
      iotCommand: "V",
      title: "訪客通知",
    }
  }

  if (text.includes("包裹") || text.includes("package")) {
    return {
      category: "package",
      eventType: "package",
      iotCommand: "P",
      title: "包裹通知",
    }
  }

  if (text.includes("取消") || text.includes("解除") || text.includes("cancel")) {
    return {
      category: "emergency",
      eventType: "emergency",
      iotCommand: "C",
      title: "緊急事件解除",
    }
  }

  return {
    category: "emergency",
    eventType: "emergency",
    iotCommand: "E",
    title: "緊急事件通知",
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()

    const type = String(body?.type || "").trim()
    const note = String(body?.note || "").trim()
    const rawLocation = String(body?.location || "").trim()
    const rawDescription = String(body?.description || "").trim()
    const iotDeviceId = String(body?.iot_device_id || "emergency-broadcast").trim() || "emergency-broadcast"
    const reportedByIdRaw = body?.reported_by_id ? String(body.reported_by_id).trim() : null
    const reportedByName = String(body?.reported_by_name || "未知").trim()
    const routing = resolveNotificationRouting(type, note)

    if (routing.category === "emergency" && (!rawLocation || !rawDescription)) {
      await writeServerAuditLog({
        supabase,
        operatorId: reportedByIdRaw || undefined,
        operatorRole: "unknown",
        actionType: "create_emergency",
        targetType: "emergency",
        targetId: "unknown",
        reason: "缺少 location 或 description",
        module: "emergency",
        status: "blocked",
        errorCode: "missing_location_or_description",
      })
      return NextResponse.json({ success: false, error: "請填寫地點與事件描述" }, { status: 400 })
    }

    const location = rawLocation || "管理室/社區入口"
    const description = rawDescription || note || `${routing.title}（快速通報）`
    const incidentDescription = composeIncidentDescription(note, description)

    if (!type) {
      await writeServerAuditLog({
        supabase,
        operatorId: reportedByIdRaw || undefined,
        operatorRole: "unknown",
        actionType: "create_emergency",
        targetType: "emergency",
        targetId: "unknown",
        reason: "缺少 type",
        module: "emergency",
        status: "blocked",
        errorCode: "missing_type",
      })
      return NextResponse.json({ success: false, error: "缺少 type" }, { status: 400 })
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    let reportedById = reportedByIdRaw && uuidRegex.test(reportedByIdRaw) ? reportedByIdRaw : null
    let resolvedReportedByName = reportedByName

    if (!reportedById && reportedByName && reportedByName !== "未知") {
      const { data: byNameProfiles } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("name", reportedByName)
        .limit(1)

      if (byNameProfiles && byNameProfiles.length > 0) {
        reportedById = byNameProfiles[0].id
        resolvedReportedByName = byNameProfiles[0].name || reportedByName
      }
    }

    let reporterRole = "unknown"
    if (reportedById) {
      const { data: reporterProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", reportedById)
        .maybeSingle()
      reporterRole = reporterProfile?.role || "unknown"
    }

    const requiresCommitteeReview = reporterRole === "resident"
    const incidentStatus = requiresCommitteeReview ? "pending" : "submitted"

    const nowIso = new Date().toISOString()

    const insertPayload: Record<string, unknown> = {
      source: "system",
      reporter_profile_id: reportedById,
      event_type: type,
      location,
      description: incidentDescription,
      status: incidentStatus,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { data: insertedEmergency, error: insertError } = await supabase
      .from("emergency_incidents")
      .insert([insertPayload])
      .select("id, event_type, location, description, status, created_at")
      .single()

    if (insertError) {
      await writeServerAuditLog({
        supabase,
        operatorId: reportedById || undefined,
        operatorRole: "unknown",
        actionType: "create_emergency",
        targetType: "emergency",
        targetId: "unknown",
        reason: insertError.message,
        module: "emergency",
        status: "failed",
        errorCode: insertError.message,
      })
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    let notificationEventError = ""
    try {
      await createNotificationEvent(
        supabase,
        routing,
        insertedEmergency?.id,
        location,
        description,
        resolvedReportedByName || "未知",
      )
    } catch (err: unknown) {
      notificationEventError = err instanceof Error ? err.message : "notification event insert failed"
    }

    let iotSent = false
    let iotError = ""

    try {
      const iotUrl = new URL("/api/iot", req.url)
      const commandPayload = { cmd: routing.iotCommand, emergencyIncidentId: insertedEmergency?.id, location }
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
        insertedEmergency?.id,
        routing.iotCommand,
        reportedById,
        iotDeviceId,
        iotSent ? "sent" : "failed",
        commandPayload,
        iotData,
      )
    } catch (err: unknown) {
      iotSent = false
      iotError = err instanceof Error ? err.message : "IOT 連線失敗"

      await logIotCommand(
        supabase,
        insertedEmergency?.id,
        routing.iotCommand,
        reportedById,
        iotDeviceId,
        "failed",
        { cmd: routing.iotCommand, emergencyIncidentId: insertedEmergency?.id, location },
        { error: iotError },
      )
    }

    let lineSent = 0
    let lineFailed = 0
    let lineError = ""
    let lineTargetCount = 0

    try {
      const lineClient = getLineClient()
      const { ids: lineTargets } = requiresCommitteeReview
        ? await getLineTargetsByRoles(supabase, ["committee"])
        : await getEmergencyLineTargets(supabase)
      lineTargetCount = lineTargets.length

      const message = requiresCommitteeReview
        ? `📝 住戶緊急通報待管委會驗證\n` +
          `類型：${type}\n` +
          `發起人：${resolvedReportedByName || "未知"}\n` +
          `地點：${location}\n` +
          `時間：${new Date(nowIso).toLocaleString("zh-TW", { hour12: false })}\n` +
          `內容：${incidentDescription || "（無）"}\n\n` +
          `請至後台緊急事件管理進行審核。`
        : `${routing.category === "emergency" ? "🚨" : routing.category === "package" ? "📦" : "👤"} ${routing.title}\n` +
          `類型：${type}\n` +
          `發起人：${resolvedReportedByName || "未知"}\n` +
          `地點：${location}\n` +
          `時間：${new Date(nowIso).toLocaleString("zh-TW", { hour12: false })}\n` +
          `備註：${incidentDescription || "（無）"}`

      for (const to of lineTargets) {
        try {
          await lineClient.pushMessage(to, { type: "text", text: message })
          lineSent++
        } catch {
          lineFailed++
        }
      }
    } catch (err: unknown) {
      lineError = err instanceof Error ? err.message : "LINE 通知失敗"
    }

    const lineDeliveryOk = !lineError && (lineTargetCount === 0 || lineSent > 0)
    const overallSuccess = lineDeliveryOk || iotSent
    const responseStatus = overallSuccess ? 200 : 502
    const lineNotBound = lineTargetCount - lineSent

    await writeServerAuditLog({
      supabase,
      operatorId: reportedById || undefined,
      operatorRole: "unknown",
      actionType: "create_emergency",
      targetType: "emergency",
      targetId: insertedEmergency?.id || "unknown",
      reason: type,
      module: "emergency",
      status: overallSuccess ? "success" : "failed",
      beforeState: null,
      afterState: { type, note, iotSent, lineSent, lineFailed },
      additionalData: {
        reported_by_name: resolvedReportedByName || "未知",
        location,
        description,
        reporter_role: reporterRole,
        requires_committee_review: requiresCommitteeReview,
        incident_status: incidentStatus,
        notification_category: routing.category,
        iot_command: routing.iotCommand,
        line_error: lineError || undefined,
        iot_error: iotError || undefined,
        notification_event_error: notificationEventError || undefined,
      },
      errorCode: overallSuccess ? undefined : lineError || iotError || "notification_failed",
    })

    return NextResponse.json(
      {
        success: overallSuccess,
        category: routing.category,
        iotCommand: routing.iotCommand,
        emergencyId: insertedEmergency?.id,
        incidentId: insertedEmergency?.id,
        reportedById: reportedById || undefined,
        reportedByName: resolvedReportedByName || "未知",
        reporterRole,
        requiresCommitteeReview,
        incidentStatus,
        iotSent,
        iotError: iotError || undefined,
        lineSent,
        lineSkipped: lineNotBound,
        lineFailed,
        lineMessage: lineDeliveryOk && lineSent > 0
          ? `✅ ${routing.title}已推播\n已發送給 ${lineSent} 位管理員${lineNotBound > 0 ? `\n（${lineNotBound} 人 LINE 未綁定，已跳過）` : ""}`
          : `⚠️ LINE 推播未完成\n${lineError || "無可推播對象"}`,
      },
      { status: responseStatus },
    )
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "緊急事件處理失敗",
      },
      { status: 500 },
    )
  }
}
