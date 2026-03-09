import { NextRequest, NextResponse } from "next/server"
import { createTenantServerClient, toTenantId } from "@/lib/tenant-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = toTenantId(searchParams.get("tenantId"))

    const supabase = createTenantServerClient(tenantId)
    const { data, error } = await supabase
      .from("routine_templates")
      .select("id, title, frequency, assignee_role, action_link, kms_link, active, created_at, updated_at")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load routine templates" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tenantId = toTenantId(body?.tenantId)
    const title = String(body?.title || "").trim()
    const frequency = String(body?.frequency || "").trim()
    const assigneeRole = String(body?.assigneeRole || "").trim()
    const actionLink = String(body?.actionLink || "/admin").trim()
    const kmsLink = String(body?.kmsLink || "/admin?section=handover-knowledge").trim()

    if (!title || !frequency || !assigneeRole) {
      return NextResponse.json({ error: "title, frequency, assigneeRole are required" }, { status: 400 })
    }

    const supabase = createTenantServerClient(tenantId)
    const { data, error } = await supabase
      .from("routine_templates")
      .insert([
        {
          title,
          frequency,
          assignee_role: assigneeRole,
          action_link: actionLink,
          kms_link: kmsLink,
          active: true,
        },
      ])
      .select("id, title, frequency, assignee_role, action_link, kms_link, active")
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create routine template" }, { status: 500 })
  }
}
