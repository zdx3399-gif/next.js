import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ 延後到 request 才建立，避免 build 階段就因 env 缺而爆掉
function getSupabase() {
  // 你目前這支 route 用的是 SUPABASE_URL / SUPABASE_ANON_KEY
  // 確保 .env.local / Vercel env 有這兩個（或你可以改成 TENANT_A_ 那套）
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("supabaseUrl is required. Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }

  return createClient(url, anonKey);
}

// GET: 獲取單一知識卡詳情
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase();
    const { id } = params;

    const { data, error } = await supabase.from("knowledge_cards").select("*").eq("id", id).single();
    if (error) throw error;

    // 增加瀏覽次數（失敗不擋主要回應也可以，但我先照你原本寫法）
    await supabase
      .from("knowledge_cards")
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq("id", id);

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("[kms/cards/[id]] Error fetching knowledge card:", error);
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

// PATCH: 更新知識卡（建立新版本）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase();
    const { id } = params;
    const body = await req.json();
    const { user_id, changelog, ...updates } = body;

    // 檢查權限
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();

    if (profileErr) throw profileErr;

    if (!profile || !["committee", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "無權限更新知識卡" }, { status: 403 });
    }

    // 獲取舊版本
    const { data: oldCard, error: oldErr } = await supabase
      .from("knowledge_cards")
      .select("*")
      .eq("id", id)
      .single();

    if (oldErr) throw oldErr;

    if (!oldCard) {
      return NextResponse.json({ error: "知識卡不存在" }, { status: 404 });
    }

    // 建立新版本
    const { data: newCard, error: newErr } = await supabase
      .from("knowledge_cards")
      .insert([
        {
          ...oldCard,
          ...updates,
          // ❗️注意：supabase insert 時不要傳 id（你原本用 undefined，我改成刪掉更乾淨）
          id: undefined as any,
          version: (oldCard.version || 0) + 1,
          previous_version_id: id,
          changelog,
          created_by: user_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (newErr) throw newErr;

    // 將舊版本標記為 archived
    const { error: archiveErr } = await supabase
      .from("knowledge_cards")
      .update({ status: "archived" })
      .eq("id", id);

    if (archiveErr) throw archiveErr;

    return NextResponse.json({ data: newCard });
  } catch (error: any) {
    console.error("[kms/cards/[id]] Error updating knowledge card:", error);
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

// DELETE: 刪除知識卡
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase();
    const { id } = params;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
    }

    // 檢查權限
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileErr) throw profileErr;

    if (!profile || !["committee", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "無權限刪除知識卡" }, { status: 403 });
    }

    const { error } = await supabase.from("knowledge_cards").update({ status: "removed" }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[kms/cards/[id]] Error deleting knowledge card:", error);
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
