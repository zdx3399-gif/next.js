import { getSupabaseClient } from "@/lib/supabase"

// 稽核動作類型
export type AuditActionType =
  // 認證相關
  | "login"
  | "logout"
  | "login_failed"
  // 貼文相關
  | "create_post"
  | "update_post"
  | "delete_post"
  // 審核相關
  | "approve"
  | "remove"
  | "redact"
  | "shadow"
  | "reject_report"
  // 解密相關
  | "decryption_requested"
  | "decryption_committee_approved"
  | "decryption_fully_approved"
  | "decryption_rejected"
  | "decryption_viewed"
  // 知識庫相關
  | "create_knowledge_card"
  | "update_knowledge_card"
  | "delete_knowledge_card"
  | "verify_knowledge_card"
  | "import_post_to_kms"
  | "reject_kms_suggestion"
  // 公告相關
  | "create_announcement"
  | "update_announcement"
  | "delete_announcement"
  | "publish_announcement"
  // 投票相關
  | "create_vote"
  | "close_vote"
  | "delete_vote"
  // 用戶管理
  | "update_user_role"
  | "ban_user"
  | "unban_user"
  | "update_user_profile"
  // 其他
  | "bulk_action"
  | "system_action"

// 目標類型
export type AuditTargetType =
  | "post"
  | "comment"
  | "user"
  | "knowledge_card"
  | "announcement"
  | "vote"
  | "report"
  | "decryption_request"
  | "system"

// 稽核紀錄參數
export interface AuditLogParams {
  operatorId: string
  operatorRole: string
  actionType: AuditActionType
  targetType: AuditTargetType
  targetId: string
  reason?: string
  beforeState?: Record<string, any>
  afterState?: Record<string, any>
  additionalData?: Record<string, any>
  relatedRequestId?: string
}

// 建立稽核紀錄
export async function createAuditLog(params: AuditLogParams): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    console.error("[v0] Supabase client not available for audit log")
    return false
  }

  try {
    const { error } = await supabase.from("audit_logs").insert([
      {
        operator_id: params.operatorId,
        operator_role: params.operatorRole,
        action_type: params.actionType,
        target_type: params.targetType,
        target_id: params.targetId,
        reason: params.reason || null,
        before_state: params.beforeState || null,
        after_state: params.afterState || null,
        additional_data: params.additionalData || null,
        related_request_id: params.relatedRequestId || null,
      },
    ])

    if (error) {
      console.error("[v0] Error creating audit log:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[v0] Exception creating audit log:", err)
    return false
  }
}

// 批量建立稽核紀錄
export async function createBulkAuditLogs(logs: AuditLogParams[]): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  try {
    const insertData = logs.map((params) => ({
      operator_id: params.operatorId,
      operator_role: params.operatorRole,
      action_type: params.actionType,
      target_type: params.targetType,
      target_id: params.targetId,
      reason: params.reason || null,
      before_state: params.beforeState || null,
      after_state: params.afterState || null,
      additional_data: params.additionalData || null,
      related_request_id: params.relatedRequestId || null,
    }))

    const { error } = await supabase.from("audit_logs").insert(insertData)

    if (error) {
      console.error("[v0] Error creating bulk audit logs:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[v0] Exception creating bulk audit logs:", err)
    return false
  }
}

// 動作類型的中文標籤
export const ACTION_TYPE_LABELS: Record<AuditActionType, string> = {
  login: "登入",
  logout: "登出",
  login_failed: "登入失敗",
  create_post: "發布貼文",
  update_post: "更新貼文",
  delete_post: "刪除貼文",
  approve: "核准發布",
  remove: "下架內容",
  redact: "遮蔽敏感",
  shadow: "影子封禁",
  reject_report: "駁回檢舉",
  decryption_requested: "申請解密",
  decryption_committee_approved: "管委會初審通過",
  decryption_fully_approved: "完全核准解密",
  decryption_rejected: "拒絕解密",
  decryption_viewed: "查看解密資訊",
  create_knowledge_card: "建立知識卡",
  update_knowledge_card: "更新知識卡",
  delete_knowledge_card: "刪除知識卡",
  verify_knowledge_card: "認證知識卡",
  import_post_to_kms: "貼文入庫",
  reject_kms_suggestion: "拒絕入庫建議",
  create_announcement: "發布公告",
  update_announcement: "更新公告",
  delete_announcement: "刪除公告",
  publish_announcement: "公開公告",
  create_vote: "建立投票",
  close_vote: "結束投票",
  delete_vote: "刪除投票",
  update_user_role: "變更用戶角色",
  ban_user: "禁言用戶",
  unban_user: "解除禁言",
  update_user_profile: "更新用戶資料",
  bulk_action: "批量操作",
  system_action: "系統操作",
}

// 目標類型的中文標籤
export const TARGET_TYPE_LABELS: Record<AuditTargetType, string> = {
  post: "貼文",
  comment: "留言",
  user: "用戶",
  knowledge_card: "知識卡",
  announcement: "公告",
  vote: "投票",
  report: "檢舉",
  decryption_request: "解密申請",
  system: "系統",
}
