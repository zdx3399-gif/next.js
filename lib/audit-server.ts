import type { SupabaseClient } from "@supabase/supabase-js"

type JsonRecord = Record<string, unknown>

export type AuditWriteStatus = "success" | "blocked" | "failed"

export interface ServerAuditLogParams {
  supabase: SupabaseClient<any, any, any>
  operatorId?: string | null
  operatorRole?: string | null
  actionType: string
  targetType: string
  targetId?: string | null
  reason?: string | null
  beforeState?: JsonRecord | null
  afterState?: JsonRecord | null
  additionalData?: JsonRecord | null
  relatedRequestId?: string | null
  module: string
  status: AuditWriteStatus
  errorCode?: string | null
  source?: string
}

export async function writeServerAuditLog({
  supabase,
  operatorId,
  operatorRole,
  actionType,
  targetType,
  targetId,
  reason,
  beforeState,
  afterState,
  additionalData,
  relatedRequestId,
  module,
  status,
  errorCode,
  source = "api",
}: ServerAuditLogParams): Promise<boolean> {
  if (!operatorId) {
    return false
  }

  const resolvedTargetId = targetId || operatorId
  const resolvedTargetType = targetType || "system"

  try {
    const { error } = await supabase.from("audit_logs").insert([
      {
        operator_id: operatorId,
        operator_role: operatorRole || "unknown",
        action_type: actionType,
        target_type: resolvedTargetType,
        target_id: resolvedTargetId,
        reason: reason || null,
        before_state: beforeState || null,
        after_state: afterState || null,
        additional_data: {
          ...(additionalData || {}),
          module,
          status,
          source,
          ...(errorCode ? { error_code: errorCode } : {}),
        },
        related_request_id: relatedRequestId || null,
      },
    ])

    if (error) {
      console.error("[audit-server] Failed to write audit log:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[audit-server] Exception while writing audit log:", error)
    return false
  }
}