import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  // 優先使用 service role key 以繞過 RLS
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Missing Supabase env for IoT API")
  return createClient(url, key)
}

const VALID_COMMANDS = new Set(["V", "P", "E", "C"]);

// GET：Arduino 輪詢此端點取得指令，Server 同步清除 NONE（read-and-clear）
export async function GET() {
  try {
    const supabase = getSupabase()

    // 1. 讀取當前指令
    const { data, error } = await supabase
      .from('iot_commands')
      .select('current_command')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, cmd: "NONE", error: "read failed" })
    }

    const cmd = String(data.current_command || "NONE").trim().toUpperCase()

    // 2. 若有待執行指令，立即清除（Arduino anon key 沒有 UPDATE 權限，由 Server 代清）
    if (cmd !== "NONE") {
      await supabase
        .from('iot_commands')
        .update({ current_command: 'NONE' })
        .eq('id', 1)
      console.log(`[IoT] GET read-and-clear: ${cmd} → NONE`)
    }

    return NextResponse.json({ success: true, cmd })
  } catch (err) {
    console.error("[IoT] GET error:", err)
    return NextResponse.json({ success: false, cmd: "NONE", error: "internal error" })
  }
}

// POST：寫入指令到 iot_commands（V=訪客, P=包裹, E=緊急, C=停止）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const normalizedCmd = String(body?.cmd || "").trim().toUpperCase();
    const relatedType: string | null = body?.related_type ? String(body.related_type).trim() : null
    const relatedId: string | null = body?.related_id ? String(body.related_id).trim() : null
    const createdBy: string | null = body?.created_by ? String(body.created_by).trim() : null

    if (!VALID_COMMANDS.has(normalizedCmd)) {
      return NextResponse.json(
        { success: false, error: "無效指令，只允許 V/P/E/C" },
        { status: 400 },
      );
    }

    const supabase = getSupabase()

    // 1. 更新 iot_commands（Arduino 輪詢此欄位）
    const { error } = await supabase
      .from('iot_commands')
      .update({ current_command: normalizedCmd })
      .eq('id', 1);

    if (error) {
      console.error("[IoT] Supabase update error:", error);
      // 寫入失敗記錄
      try {
        await supabase.from('iot_command_logs').insert([{
          command_type: normalizedCmd,
          target_device_id: `${normalizedCmd.toLowerCase()}-buzzer`,
          related_type: relatedType,
          related_id: relatedId,
          command_payload: { cmd: normalizedCmd },
          send_status: "failed",
          response_payload: { error: error.message },
          sent_at: new Date().toISOString(),
          created_by: createdBy,
        }])
      } catch {}
      throw error;
    }

    // 2. 寫入 iot_command_logs（審計紀錄）
    try {
      await supabase.from('iot_command_logs').insert([{
        command_type: normalizedCmd,
        target_device_id: `${normalizedCmd.toLowerCase()}-buzzer`,
        related_type: relatedType,
        related_id: relatedId,
        command_payload: { cmd: normalizedCmd },
        send_status: "sent",
        response_payload: { success: true },
        sent_at: new Date().toISOString(),
        created_by: createdBy,
      }])
    } catch (logErr: unknown) {
      // log 失敗不影響主流程
      console.warn("[IoT] iot_command_logs insert failed:", logErr)
    }

    console.log(`[IoT] Command written: ${normalizedCmd} (related: ${relatedType}/${relatedId})`);

    // 4. 5 秒後自動重設為 NONE（Arduino 用 anon key 無法自行清除 RLS 限制）
    after(async () => {
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const resetSupa = getSupabase()
        await resetSupa.from('iot_commands').update({ current_command: 'NONE' }).eq('id', 1)
        console.log(`[IoT] Auto-reset to NONE (was: ${normalizedCmd})`)
      } catch (e) {
        console.warn('[IoT] Auto-reset failed:', e)
      }
    })

    return NextResponse.json({ success: true, cmd: normalizedCmd, device: "Mailbox updated" });

  } catch (error) {
    console.error("[IoT] POST error:", error);
    return NextResponse.json(
      { success: false, error: 'Failed to send command to mailbox' },
      { status: 500 },
    );
  }
}

