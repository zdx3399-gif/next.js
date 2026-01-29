import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ✅ 延後建立，避免 build 階段就跑
function getSupabase() {
  const url = process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_ANON_KEY || ""

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.")
  }
  return createClient(url, key)
}

export async function POST(req) {
  try {
    const supabase = getSupabase()

    const body = await req.json()
    const { room, amount, due, invoice, test } = body

    // --- 防呆檢查 ---
    if (!room || !amount || !due) {
      return NextResponse.json({ error: "room, amount, due 為必填" }, { status: 400 })
    }

    // --- 測試模式 ---
    if (test === true) {
      return NextResponse.json({ message: "測試成功" })
    }

    // --- 2. LINE 推播 ---
    console.log("查詢 units 表的 unit_number:", room)

    const { data: unitData, error: unitError } = await supabase
      .from("units")
      .select("id")
      .eq("unit_number", room)
      .single()

    if (unitError) {
      if (unitError.code === "PGRST116") {
        console.error("查詢 units 表無結果，可能單位編號不存在:", unitError)
        return NextResponse.json({ error: "查無對應單位編號，請確認輸入是否正確" }, { status: 404 })
      }
      console.error("查詢 units 表失敗:", unitError)
      return NextResponse.json({ error: "查詢單位資料失敗，無法推播 LINE 訊息" }, { status: 500 })
    }

    const unitId = unitData.id

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("line_user_id")
      .eq("unit_id", unitId)
      .single()

    if (profileError || !profile) {
      console.error("查詢 profiles 表失敗:", profileError)
      return NextResponse.json({ error: "查詢住戶資料失敗，無法推播 LINE 訊息" }, { status: 500 })
    }

    const lineUserId = profile.line_user_id

    const pushBody = {
      to: lineUserId,
      messages: [
        {
          type: "text",
          text:
            `💰 管理費通知\n` +
            `房號：${room}\n` +
            `金額：NT$ ${amount}\n` +
            `到期日：${due}`,
        },
      ],
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) {
      return NextResponse.json({ error: "Missing LINE_CHANNEL_ACCESS_TOKEN" }, { status: 500 })
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
      console.error("LINE 推播失敗:", errText)
      return NextResponse.json({ error: errText }, { status: 500 })
    }

    console.log("管理費通知已成功發送")

    // --- 1. 儲存到 Supabase ---
    const { data, error } = await supabase
      .from("fees")
      .insert([{ unit_id: unitId, amount, due }])
      .select("id")

    if (error) {
      console.error("Supabase 插入錯誤:", error)
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.[0]?.id })
  } catch (err) {
    console.error("fees POST 錯誤:", err)
    return NextResponse.json(
      { error: "Internal Server Error", details: err?.message || String(err) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
