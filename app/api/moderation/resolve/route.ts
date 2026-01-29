import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
  if (!url || !key) return null
  return createClient(url, key)
}

function redactSensitiveContent(text: string): { redactedText: string; redactedItems: string[] } {
  const redactedItems: string[] = []
  let result = text

  // 身分證字號
  result = result.replace(/[A-Z][12]\d{8}/gi, (match) => {
    redactedItems.push(`身分證: ${match}`)
    return "***身分證已遮蔽***"
  })

  // 手機號碼
  result = result.replace(/09\d{2}[- ]?\d{3}[- ]?\d{3}/g, (match) => {
    redactedItems.push(`手機: ${match}`)
    return "***手機已遮蔽***"
  })

  // 市話號碼
  result = result.replace(/0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}/g, (match) => {
    redactedItems.push(`電話: ${match}`)
    return "***電話已遮蔽***"
  })

  // 車牌號碼
  result = result.replace(/[A-Z]{2,3}[- ]?\d{4}/gi, (match) => {
    redactedItems.push(`車牌: ${match}`)
    return "***車牌已遮蔽***"
  })

  // 棟號+門牌 (例如 A棟101)
  result = result.replace(/[A-Za-z]棟\s*\d{1,4}/gi, (match) => {
    redactedItems.push(`位置: ${match}`)
    return "***位置已遮蔽***"
  })

  // 樓層+房號
  result = result.replace(/\d{1,3}樓\d{0,4}(室|號)?/g, (match) => {
    redactedItems.push(`位置: ${match}`)
    return "***位置已遮蔽***"
  })

  // 完整地址
  result = result.replace(
    /(台北|新北|桃園|台中|台南|高雄|基隆|新竹|苗栗|彰化|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|澎湖|金門|連江)[市縣]?[^\s,，。]{2,20}(路|街|巷|弄|段|號)/g,
    (match) => {
      redactedItems.push(`地址: ${match}`)
      return "***地址已遮蔽***"
    },
  )

  // 姓名 (常見姓氏 + 1-2 個字的組合)
  const commonSurnames = "王李張劉陳楊黃趙周吳徐孫馬朱胡郭何林羅高鄭梁謝宋唐許鄧馮韓曹曾彭蕭蔡潘田董袁于余葉杜"
  const namePattern = new RegExp(`[${commonSurnames}][\\u4e00-\\u9fa5]{1,2}(?=先生|小姐|太太|住戶|鄰居|的)`, "g")
  result = result.replace(namePattern, (match) => {
    redactedItems.push(`姓名: ${match}`)
    return "***姓名已遮蔽***"
  })

  return { redactedText: result, redactedItems }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      console.error("[v0] Database not configured")
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const body = await req.json()
    const { itemId, userId, resolution } = body

    console.log("[v0] Resolving moderation item:", { itemId, userId, resolution })

    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 })
    }

    // 獲取審核項目
    const { data: queueItem, error: queueError } = await supabase
      .from("moderation_queue")
      .select("*")
      .eq("id", itemId)
      .single()

    if (queueError || !queueItem) {
      console.error("[v0] Queue item not found:", queueError)
      return NextResponse.json({ error: "Moderation item not found" }, { status: 404 })
    }

    console.log("[v0] Found queue item:", queueItem)

    let operatorRole = "admin"
    if (userId) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single()
      if (profile) {
        operatorRole = profile.role
      }
    }

    if (queueItem.item_type === "post") {
      console.log("[v0] Updating post:", queueItem.item_id, "action:", resolution.action)

      // 先取得原始貼文
      const { data: originalPost, error: postFetchError } = await supabase
        .from("community_posts")
        .select("*")
        .eq("id", queueItem.item_id)
        .single()

      if (postFetchError || !originalPost) {
        console.error("[v0] Error fetching original post:", postFetchError)
        return NextResponse.json({ error: "Post not found" }, { status: 404 })
      }

      const updateData: Record<string, any> = {
        moderated_at: new Date().toISOString(),
        moderated_by: userId,
        moderation_reason: resolution.reason || null,
      }

      if (resolution.action === "approve") {
        updateData.status = "published"
      } else if (resolution.action === "remove") {
        updateData.status = "removed"
      } else if (resolution.action === "redact") {
        const { redactedText: redactedTitle, redactedItems: titleItems } = redactSensitiveContent(originalPost.title)
        const { redactedText: redactedContent, redactedItems: contentItems } = redactSensitiveContent(
          originalPost.content,
        )

        const allRedactedItems = [...titleItems, ...contentItems]
        console.log("[v0] Redacted items:", allRedactedItems)

        updateData.status = "redacted"
        updateData.redacted_title = redactedTitle
        updateData.redacted_content = redactedContent
        updateData.redacted_items = allRedactedItems
        updateData.moderation_reason = resolution.reason || `已遮蔽敏感內容: ${allRedactedItems.join(", ")}`
      } else if (resolution.action === "shadow") {
        updateData.status = "shadow"
      } else if (resolution.action === "pending") {
        updateData.status = "pending"
      }

      const { error: postError } = await supabase.from("community_posts").update(updateData).eq("id", queueItem.item_id)

      if (postError) {
        console.error("[v0] Error updating post:", postError)
        return NextResponse.json({ error: "Failed to update post: " + postError.message }, { status: 500 })
      }
      console.log("[v0] Post updated with action:", resolution.action)
    } else if (queueItem.item_type === "comment") {
      console.log("[v0] Updating comment:", queueItem.item_id, "action:", resolution.action)

      if (resolution.action === "remove") {
        await supabase.from("post_comments").update({ status: "removed" }).eq("id", queueItem.item_id)
      } else if (resolution.action === "approve") {
        await supabase.from("post_comments").update({ status: "published" }).eq("id", queueItem.item_id)
      }
    } else if (queueItem.item_type === "report") {
      console.log("[v0] Updating report:", queueItem.item_id, "action:", resolution.action)

      if (resolution.action === "approve") {
        await supabase
          .from("reports")
          .update({
            status: "upheld",
            reviewed_at: new Date().toISOString(),
            reviewed_by: userId,
            review_notes: resolution.reason,
            action_taken: "content_removed",
          })
          .eq("id", queueItem.item_id)
      } else if (resolution.action === "reject_report") {
        await supabase
          .from("reports")
          .update({
            status: "dismissed",
            reviewed_at: new Date().toISOString(),
            reviewed_by: userId,
            review_notes: resolution.reason,
          })
          .eq("id", queueItem.item_id)
      }
    }

    // 更新審核隊列狀態
    const { error: updateError } = await supabase
      .from("moderation_queue")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution: JSON.stringify({ ...resolution, resolved_by: userId }),
      })
      .eq("id", itemId)

    if (updateError) {
      console.error("[v0] Error updating queue status:", updateError)
      return NextResponse.json({ error: "Failed to update queue status: " + updateError.message }, { status: 500 })
    }

    // 記錄稽核日誌
    try {
      await supabase.from("audit_logs").insert([
        {
          operator_id: userId,
          operator_role: operatorRole,
          action_type: `moderation_${resolution.action}`,
          target_type: queueItem.item_type,
          target_id: queueItem.item_id,
          reason: resolution.reason || "審核處理",
          after_state: { status: "resolved", resolution },
        },
      ])
      console.log("[v0] Audit log created")
    } catch (auditError) {
      console.error("[v0] Error creating audit log:", auditError)
    }

    console.log("[v0] Moderation resolved successfully")
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error resolving moderation:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
