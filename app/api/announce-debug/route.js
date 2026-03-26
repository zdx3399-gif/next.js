import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url, serviceRoleKey || anonKey);
}

export async function GET(req) {
  console.log("🔍 [DEBUG] API /api/announce-debug 被呼叫了！");

  try {
    const supabase = getSupabase();

    console.log("[DEBUG] 📋 開始診斷...");

    // 1. 查詢 profiles 表中有 line_user_id 的記錄
    console.log("[DEBUG] 査詢 profiles 表...");
    const { data: profilesWithLine, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name, line_user_id")
      .not("line_user_id", "is", null);

    if (profilesError) {
      console.error("[DEBUG] ❌ profiles 查詢失敗:", profilesError);
    } else {
      console.log(`[DEBUG] ✅ profiles 找到 ${profilesWithLine?.length || 0} 筆有 line_user_id 的帳號`);
    }

    // 2. 查詢 line_users 表的所有記錄
    console.log("[DEBUG] 査詢 line_users 表...");
    const { data: allLineUsers, error: lineUsersError } = await supabase
      .from("line_users")
      .select("*");

    if (lineUsersError) {
      console.error("[DEBUG] ❌ line_users 查詢失敗:", lineUsersError);
    } else {
      console.log(`[DEBUG] ✅ line_users 找到 ${allLineUsers?.length || 0} 筆記錄`);
    }

    // 3. 查詢 profiles 表的統計資訊
    console.log("[DEBUG] 查詢 profiles 表統計資訊...");
    const { data: profileStats, error: profileStatsError } = await supabase
      .from("profiles")
      .select("id", { count: "exact" });

    const totalProfiles = profileStats?.length || 0;
    const profilesWithLineCount = profilesWithLine?.length || 0;

    console.log(`[DEBUG] 統計: profiles 總數: ${totalProfiles}, 已綁定 LINE: ${profilesWithLineCount}`);

    return Response.json({
      success: true,
      diagnosis: {
        profiles_total: totalProfiles,
        profiles_with_line: profilesWithLineCount,
        line_users_count: allLineUsers?.length || 0,
        profiles_with_line_data: profilesWithLine || [],
        line_users_data: allLineUsers || [],
        errors: {
          profiles_error: profilesError?.message || null,
          line_users_error: lineUsersError?.message || null,
        },
      },
    });
  } catch (err) {
    console.error("💥 [ERROR]", err);
    return Response.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
