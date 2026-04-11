import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
      .select("id, status")
      .eq("id", incidentId)
      .maybeSingle()

    if (!incident) {
      return NextResponse.json({ success: false, error: "找不到事件" }, { status: 404 })
    }

    if (incident.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `目前狀態為 ${incident.status}，不可再審核` },
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
