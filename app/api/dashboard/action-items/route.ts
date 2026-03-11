import { NextRequest, NextResponse } from "next/server"
import { createTenantServerClient, toTenantId } from "@/lib/tenant-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ModuleStat = {
  key: string
  title: string
  count: number
  actionLink: string
  kmsLink: string
}

type RoutineItem = {
  id: string
  title: string
  dueDate: string
  actionLink: string
  kmsLink: string
  assigneeRole: string
  status: "pending" | "in_progress" | "completed"
}

type NotificationEvent = {
  id: string
  title: string
  message: string
  actionLink: string
  createdAt: string
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

async function countEqAny(
  supabase: any,
  table: string,
  column: string,
  values: string[],
): Promise<number> {
  for (const value of values) {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value)
    if (error) continue
    if (typeof count === "number") {
      const remaining = values.filter((v) => v !== value)
      let total = count
      for (const v of remaining) {
        const r = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, v)
        if (!r.error && typeof r.count === "number") total += r.count
      }
      return total
    }
  }
  return 0
}

async function countPendingFees(supabase: any): Promise<number> {
  const { count, error } = await supabase.from("fees").select("id", { count: "exact", head: true }).eq("paid", false)
  if (error || typeof count !== "number") return 0
  return count
}

async function countEmergenciesPending(supabase: any): Promise<number> {
  const byStatus = await countEqAny(supabase, "emergencies", "status", ["pending", "open"])
  if (byStatus > 0) return byStatus

  const unresolved = await supabase.from("emergencies").select("id", { count: "exact", head: true }).is("resolved_at", null)
  if (!unresolved.error && typeof unresolved.count === "number") return unresolved.count

  const fallback = await supabase.from("emergencies").select("id", { count: "exact", head: true })
  if (!fallback.error && typeof fallback.count === "number") return fallback.count

  return 0
}

async function listRoutineItems(supabase: any, role: string): Promise<RoutineItem[]> {
  const today = todayIsoDate()
  const { data, error } = await supabase
    .from("routine_instances")
    .select("id, due_date, status, assignee_role, template_id")
    .in("status", ["pending", "in_progress"])
    .eq("assignee_role", role)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20)

  if (error || !data || data.length === 0) return []

  const templateIds = [...new Set(data.map((d: any) => d.template_id).filter(Boolean))]
  const titleMap = new Map<string, { title: string; action_link: string; kms_link: string }>()

  if (templateIds.length > 0) {
    const { data: templates } = await supabase
      .from("routine_templates")
      .select("id, title, action_link, kms_link")
      .in("id", templateIds)

    ;(templates || []).forEach((t: any) => {
      titleMap.set(t.id, {
        title: t.title || "例行任務",
        action_link: t.action_link || "/admin",
        kms_link: t.kms_link || "/admin?section=handover-knowledge",
      })
    })
  }

  return data.map((item: any) => {
    const tpl = titleMap.get(item.template_id) || {
      title: "例行任務",
      action_link: "/admin",
      kms_link: "/admin?section=handover-knowledge",
    }
    return {
      id: item.id,
      title: tpl.title,
      dueDate: item.due_date,
      actionLink: tpl.action_link,
      kmsLink: tpl.kms_link,
      assigneeRole: item.assignee_role || role,
      status: item.status || "pending",
    }
  })
}

async function listNotifications(supabase: any, role: string, userId?: string | null): Promise<NotificationEvent[]> {
  let query = supabase
    .from("notification_events")
    .select("id, title, message, action_link, created_at, target_role, target_user_id")
    .order("created_at", { ascending: false })
    .limit(20)

  if (userId) {
    query = query.or(`target_user_id.eq.${userId},target_role.eq.${role},target_role.is.null`)
  } else {
    query = query.or(`target_role.eq.${role},target_role.is.null`)
  }

  const { data, error } = await query
  if (error || !data) return []

  return data.map((item: any) => ({
    id: item.id,
    title: item.title || "系統通知",
    message: item.message || "",
    actionLink: item.action_link || "/admin",
    createdAt: item.created_at || new Date().toISOString(),
  }))
}

async function countLegacyPending(supabase: any): Promise<number> {
  const days = 30
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const checks = [
    supabase
      .from("maintenance")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "progress", "pending"])
      .lt("created_at", threshold),
    supabase
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("arrived_at", threshold),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "reviewing"])
      .lt("created_at", threshold),
    supabase
      .from("routine_instances")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"])
      .lt("due_date", threshold.slice(0, 10)),
  ]

  const results = await Promise.all(checks)
  return results.reduce((sum, r: any) => sum + (r.error || typeof r.count !== "number" ? 0 : r.count), 0)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = toTenantId(searchParams.get("tenantId"))
    const role = (searchParams.get("role") || "committee").trim()
    const userId = searchParams.get("userId")

    const supabase = createTenantServerClient(tenantId)

    const modules: ModuleStat[] = [
      {
        key: "emergencies",
        title: "緊急事件",
        count: await countEmergenciesPending(supabase),
        actionLink: "/admin?section=emergencies",
        kmsLink: "/admin?section=handover-knowledge",
      },
      {
        key: "maintenance",
        title: "設備維護",
        count: await countEqAny(supabase, "maintenance", "status", ["open", "progress", "pending"]),
        actionLink: "/admin?section=maintenance",
        kmsLink: "/admin?section=handover-knowledge",
      },
      {
        key: "community",
        title: "社區討論檢舉",
        count: await countEqAny(supabase, "reports", "status", ["pending", "reviewing"]),
        actionLink: "/admin?section=community",
        kmsLink: "/admin?section=handover-knowledge",
      },
      {
        key: "packages",
        title: "包裹待領",
        count: await countEqAny(supabase, "packages", "status", ["pending"]),
        actionLink: "/admin?section=packages",
        kmsLink: "/admin?section=handover-knowledge",
      },
      {
        key: "finance",
        title: "管理費待處理",
        count: await countPendingFees(supabase),
        actionLink: "/admin?section=finance",
        kmsLink: "/admin?section=handover-knowledge",
      },
      {
        key: "decryption",
        title: "解密審核",
        count: await countEqAny(supabase, "decryption_requests", "status", ["pending", "committee_approved", "admin_approved"]),
        actionLink: "/admin?section=decryption",
        kmsLink: "/admin?section=handover-knowledge",
      },
    ]

    const routineItems = await listRoutineItems(supabase, role)
    const notifications = await listNotifications(supabase, role, userId)
    const legacyPendingCount = await countLegacyPending(supabase)

    const modulePending = modules.reduce((sum, m) => sum + m.count, 0)
    const totalPending = modulePending + routineItems.length

    return NextResponse.json({
      modules,
      routines: routineItems,
      notifications,
      legacyPendingCount,
      totalPending,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load action items" }, { status: 500 })
  }
}
