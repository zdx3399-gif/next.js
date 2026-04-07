import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  const key = serviceRoleKey || anonKey
  if (!url || !key) {
    throw new Error("Missing Supabase env")
  }

  return createClient(url, key)
}

async function resolveUnitId(supabase, room, unitId) {
  if (unitId) return unitId
  if (!room) return null

  const { data, error } = await supabase
    .from("units")
    .select("id")
    .eq("unit_code", room)
    .maybeSingle()

  if (!error && data?.id) return data.id

  const { data: fallbackData } = await supabase
    .from("units")
    .select("id")
    .eq("unit_number", room)
    .maybeSingle()

  return fallbackData?.id || null
}

async function resolveLineUserId(supabase, unitId) {
  if (!unitId) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("line_user_id")
    .eq("unit_id", unitId)
    .not("line_user_id", "is", null)
    .limit(1)
    .maybeSingle()

  if (profile?.line_user_id) return profile.line_user_id

  const { data: profileByJoin } = await supabase
    .from("line_users")
    .select("line_user_id, profile:profiles!line_users_profile_id_fkey(unit_id)")
    .eq("profile.unit_id", unitId)
    .not("line_user_id", "is", null)
    .limit(1)

  if (profileByJoin && profileByJoin.length > 0) return profileByJoin[0].line_user_id

  return null
}

async function pushFeeMessage(lineUserId, room, amount, due) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || !lineUserId) {
    return { pushed: false, reason: "missing_token_or_line_user" }
  }

  const pushBody = {
    to: lineUserId,
    messages: [
      {
        type: "text",
        text:
          `💰 管理費通知\n` +
          `房號：${room || "(未提供)"}\n` +
          `金額：NT$ ${Number(amount || 0).toLocaleString("zh-TW")}\n` +
          `到期日：${due}`,
      },
    ],
  }

  const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(pushBody),
  })

  if (!lineRes.ok) {
    const errText = await lineRes.text()
    return { pushed: false, reason: errText || `LINE push failed (${lineRes.status})` }
  }

  return { pushed: true }
}

export async function POST(req) {
  try {
    const supabase = getSupabase()
    const body = await req.json()

    const {
      room,
      amount,
      due,
      invoice,
      paid = false,
      note,
      unit_id: rawUnitId,
      test,
    } = body || {}

    if (!amount || !due) {
      return NextResponse.json({ error: "amount, due 為必填" }, { status: 400 })
    }

    if (test === true) {
      return NextResponse.json({ message: "測試成功" })
    }

    const unitId = await resolveUnitId(supabase, room, rawUnitId)
    if (!unitId) {
      return NextResponse.json({ error: "查無對應單位，請確認房號或 unit_id" }, { status: 404 })
    }

    const insertData = {
      unit_id: unitId,
      amount,
      due,
      invoice: invoice || null,
      paid: !!paid,
      note: note || null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from("fees")
      .insert([insertData])
      .select("*")
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    let notify = { pushed: false, reason: "paid_or_no_notify" }
    if (!paid) {
      const lineUserId = await resolveLineUserId(supabase, unitId)
      notify = await pushFeeMessage(lineUserId, room, amount, due)
    }

    return NextResponse.json({
      success: true,
      record: inserted,
      notify,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Internal Server Error", details: err?.message || String(err) },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
