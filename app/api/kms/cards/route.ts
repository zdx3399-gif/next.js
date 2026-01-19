import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_ANON_KEY || "")

// GET: 獲取單一知識卡詳情
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const { data, error } = await supabase.from("knowledge_cards").select("*").eq("id", id).single()

    if (error) throw error

    // 增加瀏覽次數
    await supabase
      .from("knowledge_cards")
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq("id", id)

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[v0] Error fetching knowledge card:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH: 更新知識卡（建立新版本）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await req.json()
    const { user_id, changelog, ...updates } = body

    // 檢查權限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user_id).single()

    if (!profile || !["committee", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "無權限更新知識卡" }, { status: 403 })
    }

    // 獲取舊版本
    const { data: oldCard } = await supabase.from("knowledge_cards").select("*").eq("id", id).single()

    if (!oldCard) {
      return NextResponse.json({ error: "知識卡不存在" }, { status: 404 })
    }

    // 建立新版本
    const { data: newCard, error } = await supabase
      .from("knowledge_cards")
      .insert([
        {
          ...oldCard,
          ...updates,
          id: undefined,
          version: oldCard.version + 1,
          previous_version_id: id,
          changelog,
          created_by: user_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) throw error

    // 將舊版本標記為 archived
    await supabase.from("knowledge_cards").update({ status: "archived" }).eq("id", id)

    return NextResponse.json({ data: newCard })
  } catch (error: any) {
    console.error("[v0] Error updating knowledge card:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: 刪除知���卡
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")

    // 檢查權限
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single()

    if (!profile || !["committee", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "無權限刪除知識卡" }, { status: 403 })
    }

    const { error } = await supabase.from("knowledge_cards").update({ status: "removed" }).eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error deleting knowledge card:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
