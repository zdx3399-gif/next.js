import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"
import { writeServerAuditLog } from "@/lib/audit-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60 // Vercel Pro: 最長 60s；Hobby 上限仍為 10s

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

/** 由 LINE_BOT_NOTIFICATION_MODE 環境變數决定用哪支 BOT：
 *  - 'test'     → BOT2
 *  - 'official' → BOT1
 *  - 未設定    → 預設 BOT2（測試環境安全倶倣）
 */
function getEffectiveMode(): "test" | "official" {
  const env = (process.env.LINE_BOT_NOTIFICATION_MODE || "").toLowerCase()
  return env === "official" ? "official" : "test"
}

function getLineClientForMode() {
  const mode = getEffectiveMode()
  console.log(`[emergency-notify] 有效通知通道: ${mode === "test" ? "BOT2" : "BOT1"} (LINE_BOT_NOTIFICATION_MODE=${process.env.LINE_BOT_NOTIFICATION_MODE || '未設定'})`)
  if (mode === "test") {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN_BOT2 || process.env.LINE_CHANNEL_ACCESS_TOKEN
    const secret = process.env.LINE_CHANNEL_SECRET_BOT2 || process.env.LINE_CHANNEL_SECRET
    if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN_BOT2")
    return new Client({ channelAccessToken: token, channelSecret: secret || "unused" })
  }
  return getLineClient()
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
    const sendMode = (String(body?.sendMode || "official").trim() === "test" ? "test" : "official") as "test" | "official"
    const imageUrl = body?.image_url ? String(body.image_url).trim() : null
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

    // 測試模式：status=draft，正式模式：pending
    // 統一用 effectiveMode（由 LINE_BOT_NOTIFICATION_MODE env var 决定）而不是前端傳入的 sendMode
    const incidentStatus = getEffectiveMode() === "test" ? "draft" : "pending"

    const nowIso = new Date().toISOString()

    const insertPayload: Record<string, unknown> = {
      source: "system",
      reporter_profile_id: reportedById,
      event_type: type,
      location,
      description: incidentDescription,
      image_url: imageUrl || null,
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

    // IoT 延遲到審核通過後再發送
    const iotSent = false
    const iotError = ""

    let lineSent = 0
    let lineFailed = 0
    let lineError = ""
    let lineTargetCount = 0

    try {
      const effectiveMode = getEffectiveMode()
      const lineClient = getLineClientForMode()
      // effectiveMode='test': 通知 admin+committee；effectiveMode='official': 僅通知管委會
      const { ids: lineTargets } = effectiveMode === "test"
        ? await getLineTargetsByRoles(supabase, ["admin", "committee"])
        : await getLineTargetsByRoles(supabase, ["committee"])
      lineTargetCount = lineTargets.length
      console.log(`[emergency-notify] 目標管委數量: ${lineTargetCount}，effectiveMode=${effectiveMode}`)

      const timeStr = new Date(nowIso).toLocaleString("zh-TW", { hour12: false })
      const isTest = effectiveMode === "test"
      const headerText = isTest ? "🧪 緊急事件（測試）" : "⚠️ 緊急事件待審核"
      const footerText = isTest
        ? "測試模式：確認後僅廣播給管理員 + 管委會"
        : "請確認是否發布通知"

      // Flex Message 卡片（postback 按鈕，透過 LINE Webhook 觸發審核）
      const incidentId = insertedEmergency?.id || ""

      const buildFlexCard = (): any => ({
        type: "flex",
        altText: `${isTest ? "[測試] " : ""}緊急事件通報：${type}`,
        contents: {
          type: "bubble",
          ...(imageUrl ? {
            hero: {
              type: "image",
              url: imageUrl,
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover",
            },
          } : {}),
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: headerText,
                weight: "bold",
                size: "lg",
                color: isTest ? "#1565C0" : "#B71C1C",
              },
              { type: "separator" },
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                margin: "md",
                contents: [
                  { type: "text", text: `類型：${type}`, size: "sm", color: "#333333" },
                  { type: "text", text: `地點：${location || "未提供"}`, size: "sm", color: "#333333" },
                  { type: "text", text: `描述：${incidentDescription || "（無）"}`, size: "sm", color: "#333333", wrap: true },
                  { type: "text", text: `附圖：${imageUrl ? "有" : "無"}`, size: "sm", color: "#666666" },
                  { type: "text", text: `發報人：${resolvedReportedByName || "未知"}`, size: "sm", color: "#666666" },
                ],
              },
              { type: "separator" },
              { type: "text", text: footerText, size: "xs", color: "#888888" },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: isTest ? "#1565C0" : "#B71C1C",
                action: {
                  type: "postback",
                  label: "✅ 確認發布",
                  data: `action=approve&event_id=${incidentId}`,
                  displayText: `確認發布事件 ${incidentId}`,
                },
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "❌ 駁回",
                  data: `action=reject&event_id=${incidentId}`,
                  displayText: `駁回事件 ${incidentId}`,
                },
              },
            ],
          },
        },
      })

      for (const to of lineTargets) {
        try {
          await lineClient.pushMessage(to, buildFlexCard())
          lineSent++
          console.log(`[emergency-notify] pushMessage 成功: ${to}`)
        } catch (pushErr: unknown) {
          lineFailed++
          const msg = pushErr instanceof Error ? pushErr.message : String(pushErr)
          console.error(`[emergency-notify] pushMessage 失敗 to=${to}:`, msg)
        }
      }
    } catch (err: unknown) {
      lineError = err instanceof Error ? err.message : "LINE 通知失敗"
    }

    // 事件建立成功即為 200，LINE 失敗只是警告不影響主流程
    const overallSuccess = true
    const responseStatus = 200
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
        requires_committee_review: true,
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
        requiresCommitteeReview: true,
        incidentStatus,
        iotSent,
        iotError: iotError || undefined,
        lineSent,
        lineSkipped: lineNotBound,
        lineFailed,
        lineMessage: lineSent > 0
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
