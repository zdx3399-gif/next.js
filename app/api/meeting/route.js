import { createClient } from "@supabase/supabase-js"
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

// POST: 保存新增會議到資料庫（不發送通知）
export async function POST(req) {
  try {
    const supabase = getSupabase()

    const body = await req.json()
    const { topic, time, location, key_takeaways, notes, pdf_file_url, created_by } = body
    const operatorRole = body?.operatorRole || "unknown"

    if (!topic || !time || !location) {
      await writeServerAuditLog({
        supabase,
        operatorId: created_by || undefined,
        operatorRole,
        actionType: "create_meeting",
        targetType: "system",
        targetId: "unknown",
        reason: "Missing required fields: topic, time, location",
        module: "meetings",
        status: "blocked",
        errorCode: "missing_required_fields",
      })
      return Response.json({ error: "Missing required fields: topic, time, location" }, { status: 400 })
    }

    // 新增會議到資料庫
    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert([
        {
          topic,
          time,
          location,
          key_takeaways: key_takeaways || [],
          notes: notes || "",
          pdf_file_url: pdf_file_url || "",
          created_by: created_by || null,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("[meeting] POST error:", error)
      await writeServerAuditLog({
        supabase,
        operatorId: created_by || undefined,
        operatorRole,
        actionType: "create_meeting",
        targetType: "system",
        targetId: "unknown",
        reason: error.message,
        module: "meetings",
        status: "failed",
        errorCode: error.message,
      })
      return Response.json({ error: error.message }, { status: 500 })
    }

    await writeServerAuditLog({
      supabase,
      operatorId: created_by || undefined,
      operatorRole,
      actionType: "create_meeting",
      targetType: "system",
      targetId: meeting.id,
      reason: topic,
      module: "meetings",
      status: "success",
      afterState: { time, location },
    })

    return Response.json({ success: true, id: meeting.id })
  } catch (err) {
    console.error("[meeting] POST error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}