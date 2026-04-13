import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase env")
  }

  return createClient(supabaseUrl, supabaseKey)
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)

    const selectedCategory = searchParams.get("category") || "all"
    const selectedStatus = searchParams.get("status") || "all"
    const queueFilter = searchParams.get("queueFilter") || "pending"

    let postsQuery = supabase.from("community_posts").select("*").order("created_at", { ascending: false })

    if (selectedCategory !== "all") postsQuery = postsQuery.eq("category", selectedCategory)
    if (selectedStatus !== "all") postsQuery = postsQuery.eq("status", selectedStatus)

    const [{ data: posts, error: postsError }, { data: postStats, error: postStatsError }] = await Promise.all([
      postsQuery,
      supabase.from("community_posts").select("status"),
    ])

    if (postsError) {
      return NextResponse.json({ error: postsError.message, details: postsError }, { status: 500 })
    }
    if (postStatsError) {
      return NextResponse.json({ error: postStatsError.message, details: postStatsError }, { status: 500 })
    }

    const statusFilter = queueFilter === "pending" ? ["pending", "in_review"] : ["resolved"]
    const [{ data: queueData, error: queueError }, { data: queueStats, error: queueStatsError }] = await Promise.all([
      supabase
        .from("moderation_queue")
        .select("*")
        .in("status", statusFilter)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("moderation_queue").select("status"),
    ])

    if (queueError) {
      return NextResponse.json({ error: queueError.message, details: queueError }, { status: 500 })
    }
    if (queueStatsError) {
      return NextResponse.json({ error: queueStatsError.message, details: queueStatsError }, { status: 500 })
    }

    const queueItems = queueData || []
    const postItemIds = Array.from(new Set(queueItems.filter((item) => item.item_type === "post").map((item) => item.item_id)))

    let postById = new Map<string, any>()
    if (postItemIds.length > 0) {
      const { data: queuePosts, error: queuePostsError } = await supabase.from("community_posts").select("*").in("id", postItemIds)
      if (queuePostsError) {
        return NextResponse.json({ error: queuePostsError.message, details: queuePostsError }, { status: 500 })
      }
      postById = new Map((queuePosts || []).map((post) => [post.id, post]))
    }

    const moderationQueue = queueItems.map((item) => {
      if (item.item_type === "post") {
        return { ...item, post: postById.get(item.item_id) || null }
      }
      return item
    })

    const stats = {
      total: (postStats || []).length,
      published: (postStats || []).filter((p: any) => p.status === "published").length,
      pending: (postStats || []).filter((p: any) => p.status === "pending").length,
      shadow: (postStats || []).filter((p: any) => p.status === "shadow").length,
      redacted: (postStats || []).filter((p: any) => p.status === "redacted").length,
      removed: (postStats || []).filter((p: any) => p.status === "removed" || p.status === "deleted").length,
      queuePending: (queueStats || []).filter((q: any) => q.status === "pending" || q.status === "in_review").length,
      queueResolved: (queueStats || []).filter((q: any) => q.status === "resolved").length,
    }

    return NextResponse.json({
      posts: posts || [],
      moderationQueue,
      stats,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "載入管理資料失敗" }, { status: 500 })
  }
}
