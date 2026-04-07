import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const dbKey = serviceRoleKey || anonKey

  if (!url || !dbKey) {
    throw new Error("Missing Supabase env. Require SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and service/anon key")
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
  const lineUserIds = new Set<string>()

  const { data: roleProfiles } = await supabase
    .from("profiles")
    .select("id, line_user_id")
    .in("role", ["admin", "guard", "committee"])

  const roleProfileIds = (roleProfiles || []).map((p: any) => p.id).filter(Boolean)
  ;(roleProfiles || []).forEach((p: any) => {
    if (p?.line_user_id) lineUserIds.add(p.line_user_id)
  })

  if (roleProfileIds.length > 0) {
    const { data: linkedLineUsers } = await supabase
      .from("line_users")
      .select("line_user_id, profile_id")
      .in("profile_id", roleProfileIds)

    ;(linkedLineUsers || []).forEach((u: any) => {
      if (u?.line_user_id) lineUserIds.add(u.line_user_id)
    })
  }

  if (lineUserIds.size === 0) {
    const { data: fallbackAllLineUsers } = await supabase
      .from("line_users")
      .select("line_user_id")
      .not("line_user_id", "is", null)
      .limit(20)

    ;(fallbackAllLineUsers || []).forEach((u: any) => {
      if (u?.line_user_id) lineUserIds.add(u.line_user_id)
    })
  }

  return [...lineUserIds]
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()

    const type = String(body?.type || "").trim()
    const note = String(body?.note || "").trim()
    const reportedByIdRaw = body?.reported_by_id ? String(body.reported_by_id).trim() : null
    const reportedByName = String(body?.reported_by_name || "未知").trim()

    if (!type) {
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

    const nowIso = new Date().toISOString()

    const insertPayload: Record<string, unknown> = {
      type,
      note,
      time: nowIso,
    }

    if (reportedById) {
      insertPayload.reported_by_id = reportedById
      insertPayload.created_by = reportedById
    }

    const { data: insertedEmergency, error: insertError } = await supabase
      .from("emergencies")
      .insert([insertPayload])
      .select("id, type, note, time")
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    let iotSent = false
    let iotError = ""

    try {
      const iotUrl = new URL("/api/iot", req.url)
      const iotRes = await fetch(iotUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "E" }),
      })
      const iotData = await iotRes.json().catch(() => null)
      iotSent = !!(iotRes.ok && iotData?.success)
      if (!iotSent) {
        iotError = iotData?.error || `IOT 命令失敗（${iotRes.status}）`
      }
    } catch (err: unknown) {
      iotSent = false
      iotError = err instanceof Error ? err.message : "IOT 連線失敗"
    }

    let lineSent = 0
    let lineFailed = 0
    let lineError = ""
    let lineTargetCount = 0

    try {
      const lineClient = getLineClient()
      const lineTargets = await getEmergencyLineTargets(supabase)
      lineTargetCount = lineTargets.length

      const message =
        `🚨 緊急事件通知\n` +
        `類型：${type}\n` +
        `發起人：${resolvedReportedByName || "未知"}\n` +
        `時間：${new Date(nowIso).toLocaleString("zh-TW", { hour12: false })}\n` +
        `備註：${note || "（無）"}`

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
    const responseStatus = lineDeliveryOk ? 200 : 502

    return NextResponse.json(
      {
        success: lineDeliveryOk,
        emergencyId: insertedEmergency?.id,
        reportedById: reportedById || undefined,
        reportedByName: resolvedReportedByName || "未知",
        iotSent,
        iotError: iotError || undefined,
        lineTargetCount,
        lineSent,
        lineFailed,
        lineError: lineError || (lineDeliveryOk ? undefined : "LINE 完全未送達"),
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
