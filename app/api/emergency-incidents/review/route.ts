import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"

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
  if (!channelAccessToken) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN")
  return new Client({ channelAccessToken, channelSecret: process.env.LINE_CHANNEL_SECRET || "unused" })
}

async function getLineIdsByRoles(supabase: any, roles: string[]) {
  const { data } = await supabase.from("profiles").select("line_user_id").in("role", roles)
  return (data || []).map((p: any) => p.line_user_id).filter(Boolean) as string[]
}

async function broadcastApproved(supabase: any, incident: any) {
  // 1. LINE 廣播給 admin + guard + committee
  try {
    const lineClient = getLineClient()
    const targets = await getLineIdsByRoles(supabase, ["admin", "guard", "committee"])
    const msg =
      `🚨 緊急事件已核准廣播\n` +
      `類型：${incident.event_type}\n` +
      `地點：${incident.location || "未提供"}\n` +
      `內容：${incident.description || "（無）"}\n` +
      `時間：${new Date(incident.created_at).toLocaleString("zh-TW", { hour12: false })}`
    for (const to of targets) {
      await lineClient.pushMessage(to, { type: "text", text: msg }).catch(() => {})
    }
  } catch {}

  // 2. IoT 發送 E 指令
  try {
    const iotBase = process.env.IOT_DEVICE_BASE_URL?.replace(/\/$/, "")
    if (iotBase) {
      await fetch(`${iotBase}/cmd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "E" }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {})
    }
  } catch {}

  // 3. notification_events 紀錄
  try {
    await supabase.from("notification_events").insert([{
      title: "緊急事件通知",
      message: `緊急事件已核准｜地點：${incident.location || "未提供"}`,
      module_key: "emergency",
      action_link: "/admin?section=emergencies",
      payload: { emergency_incident_id: incident.id, category: "emergency" },
    }])
  } catch {}
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
      .select("id, status, event_type, location, description, created_at")
      .eq("id", incidentId)
      .maybeSingle()

    if (!incident) {
      return NextResponse.json({ success: false, error: "找不到事件" }, { status: 404 })
    }

    const statusNormMap: Record<string, string> = { '待審核': 'pending', '編輯中': 'draft', '已發布': 'approved', '已駁回': 'rejected', 'submitted': 'pending' }
    const normalizedIncidentStatus = statusNormMap[incident.status] ?? incident.status
    if (normalizedIncidentStatus !== "pending" && normalizedIncidentStatus !== "draft") {
      return NextResponse.json(
        { success: false, error: `目前狀態為 ${normalizedIncidentStatus}，不可再審核` },
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

    // 審核通過後自動廣播
    if (action === "approve") {
      await broadcastApproved(supabase, incident)
    }

    return NextResponse.json({
      success: true,
      incidentId,
      status: nextStatus,
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

// LINE Flex Message 按鈕為 URI action（GET 請求），需支援 GET 路由
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const incidentId = searchParams.get("incidentId") || ""
    const action = (searchParams.get("action") || "").toLowerCase()
    const reviewerId = searchParams.get("reviewerId") || ""

    if (!incidentId || !reviewerId || !["approve", "reject"].includes(action)) {
      return new Response("<html><body><h2>參數不完整，請至後台操作。</h2></body></html>", {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    const supabase = getSupabase()

    const { data: reviewer } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", reviewerId)
      .maybeSingle()

    if (!reviewer || !["committee", "admin"].includes(String(reviewer.role || ""))) {
      return new Response("<html><body><h2>您沒有審核權限。</h2></body></html>", {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    const { data: incident } = await supabase
      .from("emergency_incidents")
      .select("id, status, event_type, location, description, created_at")
      .eq("id", incidentId)
      .maybeSingle()

    if (!incident) {
      return new Response("<html><body><h2>找不到事件。</h2></body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    if (incident.status !== "pending" && incident.status !== "draft") {
      return new Response(
        `<html><body><h2>此事件已處理（狀態：${incident.status}）。</h2></body></html>`,
        { status: 409, headers: { "Content-Type": "text/html; charset=utf-8" } },
      )
    }

    const nextStatus = action === "approve" ? "approved" : "rejected"
    await supabase
      .from("emergency_incidents")
      .update({ status: nextStatus, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", incidentId)

    if (action === "approve") {
      await broadcastApproved(supabase, incident)
    }

    const msg = action === "approve"
      ? `✅ 緊急事件已確認發布，系統將自動廣播給所有住戶。`
      : `❌ 緊急事件已駁回，不會廣播。`

    return new Response(
      `<html><body style="font-family:sans-serif;padding:32px;text-align:center;"><h2>${msg}</h2><p>您可以關閉此頁面。</p></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  } catch (error) {
    return new Response(
      `<html><body><h2>審核失敗：${error instanceof Error ? error.message : "未知錯誤"}</h2></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  }
}
