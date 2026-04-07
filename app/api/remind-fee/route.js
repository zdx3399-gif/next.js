import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LINE_API = "https://api.line.me/v2/bot/message/push"

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.TENANT_A_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL ||
    ""

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.TENANT_A_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY ||
    ""

  if (!url || !key) {
    throw new Error("Missing Supabase env")
  }

  return createClient(url, key)
}

export async function POST(req) {
  try {
    const supabase = getSupabase()
    const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!LINE_TOKEN) {
      return NextResponse.json({ error: "缺少 LINE_CHANNEL_ACCESS_TOKEN 環境變數" }, { status: 500 })
    }

    const { feeId, customMessage } = await req.json()
    if (!feeId) {
      return NextResponse.json({ error: "feeId 必填" }, { status: 400 })
    }

    const { data: fee, error: feeErr } = await supabase
      .from("fees")
      .select("id, unit_id, amount, due, paid, note")
      .eq("id", feeId)
      .single()

    if (feeErr || !fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, name, unit_id, line_user_id")
      .eq("unit_id", fee.unit_id)
      .maybeSingle()

    if (pErr) {
      return NextResponse.json({ error: "查詢住戶資料失敗" }, { status: 500 })
    }

    if (!profile?.id) {
      return NextResponse.json({ error: `未找到單位 ID ${fee.unit_id} 的住戶` }, { status: 404 })
    }

    let lineUserId = profile.line_user_id


    if (!lineUserId) {
      return NextResponse.json({ 
        success: false, 
        sent: 0, 
        skipped: 1, 
        message: "❌ 推播失敗\n此住戶尚未完成 LINE 綁定"
      }, { status: 400 })
    }

    const text =
      customMessage ??
      `親愛的${profile?.name ?? "住戶"}您好，\n` +
        `您本期的管理費尚未繳清：\n` +
        `金額：${fee.amount}\n` +
        `到期日：${fee.due}\n` +
        `狀態：${fee.paid ? "已繳" : "未繳"}\n` +
        `${fee.note ? `備註：${fee.note}` : ""}\n` +
        `請盡快完成繳費，謝謝！`

    const resp = await fetch(LINE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return NextResponse.json({ 
        success: false, 
        sent: 0, 
        skipped: 0, 
        message: `❌ LINE 推播失敗\n${errText || "未知錯誤"}`
      }, { status: 500 })
    }

    await supabase.from("fees").update({ updated_at: new Date().toISOString() }).eq("id", fee.id)

    return NextResponse.json({ 
      success: true, 
      sent: 1, 
      skipped: 0, 
      message: `✅ 催繳通知已推播\n已發送給 ${profile.name || "住戶"}`
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || "伺服器錯誤" }, { status: 500 })
  }
}
