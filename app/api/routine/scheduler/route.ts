import { NextRequest, NextResponse } from "next/server"
import { createTenantServerClient, type TenantId } from "@/lib/tenant-server"
import { writeServerAuditLog } from "@/lib/audit-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RoutineTemplate = {
  id: string
  title: string
  frequency: "weekly" | "monthly" | "quarterly" | "yearly"
  assignee_role: string
  action_link: string
  kms_link: string | null
  active: boolean
}

function shouldGenerate(frequency: RoutineTemplate["frequency"], date: Date): boolean {
  const day = date.getDate()
  const month = date.getMonth() + 1
  const weekday = date.getDay()

  if (frequency === "weekly") return weekday === 1
  if (frequency === "monthly") return day === 1
  if (frequency === "quarterly") return day === 1 && [1, 4, 7, 10].includes(month)
  if (frequency === "yearly") return day === 1 && month === 1
  return false
}

function resolveTenants(fromBody?: string[]): TenantId[] {
  const all: TenantId[] = []
  if (process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL) all.push("tenant_a")
  if (process.env.NEXT_PUBLIC_TENANT_B_SUPABASE_URL || process.env.SUPABASE_URL) all.push("tenant_b")

  if (!fromBody || fromBody.length === 0) return all.length > 0 ? all : ["tenant_a"]

  const requested = fromBody.filter((v): v is TenantId => v === "tenant_a" || v === "tenant_b")
  return requested.length > 0 ? requested : all
}

async function runSchedulerForTenant(tenantId: TenantId, now: Date) {
  const supabase = createTenantServerClient(tenantId)
  const dueDate = now.toISOString().slice(0, 10)

  const { data: templates, error } = await supabase
    .from("routine_templates")
    .select("id, title, frequency, assignee_role, action_link, kms_link, active")
    .eq("active", true)

  if (error) {
    await writeServerAuditLog({
      supabase,
      operatorId: null,
      operatorRole: "system",
      actionType: "system_action",
      targetType: "system",
      targetId: tenantId,
      reason: error.message,
      module: "routine-scheduler",
      status: "failed",
      errorCode: error.message,
    })
    return { tenantId, generated: 0, notifications: 0, error: error.message }
  }

  let generated = 0
  let notifications = 0

  for (const template of (templates || []) as RoutineTemplate[]) {
    if (!shouldGenerate(template.frequency, now)) continue

    const { data: existing } = await supabase
      .from("routine_instances")
      .select("id")
      .eq("template_id", template.id)
      .eq("due_date", dueDate)
      .limit(1)

    if (existing && existing.length > 0) continue

    const { data: instance, error: insertError } = await supabase
      .from("routine_instances")
      .insert([
        {
          template_id: template.id,
          due_date: dueDate,
          status: "pending",
          assignee_role: template.assignee_role,
        },
      ])
      .select("id")
      .single()

    if (insertError || !instance?.id) continue
    generated += 1

    await writeServerAuditLog({
      supabase,
      operatorId: null,
      operatorRole: "system",
      actionType: "system_action",
      targetType: "system",
      targetId: instance.id,
      reason: `建立例行任務 ${template.title}`,
      afterState: { template_id: template.id, due_date: dueDate, tenantId },
      module: "routine-scheduler",
      status: "success",
    })

    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", template.assignee_role)
      .eq("status", "active")

    for (const user of users || []) {
      const { error: notifyError } = await supabase.from("notification_events").insert([
        {
          title: `例行任務：${template.title}`,
          message: `已產生新的例行任務，期限 ${dueDate}`,
          module_key: "routine",
          action_link: template.action_link || "/admin",
          target_role: template.assignee_role,
          target_user_id: user.id,
          payload: {
            routine_instance_id: instance.id,
            template_id: template.id,
            kms_link: template.kms_link || "/admin?section=handover-knowledge",
          },
        },
      ])
      if (!notifyError) {
        notifications += 1
      } else {
        await writeServerAuditLog({
          supabase,
          operatorId: user.id,
          operatorRole: template.assignee_role,
          actionType: "system_action",
          targetType: "system",
          targetId: instance.id,
          reason: notifyError.message,
          module: "routine-scheduler",
          status: "failed",
          errorCode: notifyError.message,
        })
      }
    }
  }

  return { tenantId, generated, notifications }
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = request.headers.get("authorization")
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const tenants = resolveTenants(Array.isArray(body?.tenants) ? body.tenants : undefined)
    const now = new Date()

    const results = []
    for (const tenantId of tenants) {
      results.push(await runSchedulerForTenant(tenantId, now))
    }

    return NextResponse.json({
      success: true,
      runAt: now.toISOString(),
      results,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Scheduler failed" }, { status: 500 })
  }
}
