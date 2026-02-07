import { createClient } from "@supabase/supabase-js"

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

    if (!topic || !time || !location) {
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
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, id: meeting.id })
  } catch (err) {
    console.error("[meeting] POST error:", err)
    return Response.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}