import { NextRequest, NextResponse } from "next/server"
import { createTenantServerClient, toTenantId } from "@/lib/tenant-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = toTenantId(searchParams.get("tenantId"))
    const role = (searchParams.get("role") || "committee").trim()

    const supabase = createTenantServerClient(tenantId)
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from("routine_instances")
      .select("id, template_id, due_date, status, assignee_role, completed_at, completed_by")
      .eq("assignee_role", role)
      .in("status", ["pending", "in_progress"])
      .lte("due_date", today)
      .order("due_date", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load routine instances" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const tenantId = toTenantId(body?.tenantId)
    const instanceId = String(body?.instanceId || "")
    const status = String(body?.status || "completed") as "pending" | "in_progress" | "completed"
    const completedBy = String(body?.completedBy || "")

    if (!instanceId || !completedBy || !["pending", "in_progress", "completed"].includes(status)) {
      return NextResponse.json({ error: "instanceId, status and completedBy are required" }, { status: 400 })
    }

    const supabase = createTenantServerClient(tenantId)
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === "completed") {
      updatePayload.completed_at = new Date().toISOString()
      updatePayload.completed_by = completedBy
    } else {
      updatePayload.completed_at = null
      updatePayload.completed_by = null
    }

    const { error } = await supabase
      .from("routine_instances")
      .update(updatePayload)
      .eq("id", instanceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to complete routine task" }, { status: 500 })
  }
}
