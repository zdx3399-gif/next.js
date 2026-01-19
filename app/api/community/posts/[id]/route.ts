import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_ANON_KEY || "")

// GET: 獲取單一貼文詳情
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const { data, error } = await supabase.from("community_posts").select("*").eq("id", id).single()

    if (error) throw error

    // 增加瀏覽次數
    await supabase
      .from("community_posts")
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq("id", id)

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error fetching post:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH: 更新貼文
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await req.json()
    const { user_id, ...updates } = body

    // 檢查權限
    const { data: post } = await supabase
      .from("community_posts")
      .select("author_id, can_edit_until")
      .eq("id", id)
      .single()

    if (!post || post.author_id !== user_id) {
      return NextResponse.json({ error: "無權限編輯此貼文" }, { status: 403 })
    }

    // 檢查是否超過編輯期限
    if (post.can_edit_until && new Date(post.can_edit_until) < new Date()) {
      return NextResponse.json({ error: "已超過可編輯期限" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("community_posts")
      .update({ ...updates, edited_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error updating post:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: 刪除貼文（實際上是更新狀態為 deleted）
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")

    // 檢查權限
    const { data: post } = await supabase.from("community_posts").select("author_id").eq("id", id).single()

    if (!post || post.author_id !== userId) {
      return NextResponse.json({ error: "無權限刪除此貼文" }, { status: 403 })
    }

    const { error } = await supabase.from("community_posts").update({ status: "deleted" }).eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error deleting post:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
