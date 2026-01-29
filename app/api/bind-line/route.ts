import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@line/bot-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ 共用：延後建立 Supabase，並檢查 env
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }

  return createClient(url, anonKey);
}

// ✅ 共用：延後建立 LINE client，並檢查 env
function getLineClient() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;

  if (!token || !secret) return null; // 允許沒設就跳過推播
  return new Client({ channelAccessToken: token, channelSecret: secret });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const {
      profile_id,
      line_user_id,
      line_display_name,
      line_avatar_url,
      line_status_message,
    } = await req.json();

    // 驗證必要欄位
    if (!profile_id || !line_user_id) {
      return NextResponse.json(
        { success: false, message: "缺少必要參數 (profile_id 或 line_user_id)" },
        { status: 400 }
      );
    }

    console.log("📥 收到 LINE 綁定請求:", { profile_id, line_user_id, line_display_name });

    // 1. 檢查 profile_id 是否存在
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, name, line_user_id, status")
      .eq("id", profile_id)
      .single();

    if (profileError || !currentProfile) {
      console.error("❌ 使用者不存在:", profile_id, profileError);
      return NextResponse.json({ success: false, message: "使用者不存在" }, { status: 404 });
    }

    // 檢查帳號狀態
    if (currentProfile.status !== "active") {
      return NextResponse.json(
        { success: false, message: "帳號已被停用，無法綁定 LINE" },
        { status: 403 }
      );
    }

    // 2. 檢查此 profile 是否已綁定其他 LINE 帳號
    if (currentProfile.line_user_id && currentProfile.line_user_id !== line_user_id) {
      return NextResponse.json(
        {
          success: false,
          message: `此帳號已綁定 LINE (${currentProfile.line_user_id})，請先解除綁定`,
        },
        { status: 409 }
      );
    }

    // 3. 檢查此 LINE 帳號是否已被其他 profile 綁定
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id, email, name")
      .eq("line_user_id", line_user_id)
      .neq("id", profile_id)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: `此 LINE 帳號已被帳號 ${existingUser.email} 綁定` },
        { status: 409 }
      );
    }

    // 4. 同步寫入 line_users
    const { error: lineUserDbError } = await supabase
      .from("line_users")
      .upsert(
        [
          {
            line_user_id,
            profile_id,
            display_name: line_display_name,
            avatar_url: line_avatar_url,
            status_message: line_status_message || "",
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "line_user_id" }
      );

    if (lineUserDbError) {
      console.error("❌ 無法寫入 line_users:", lineUserDbError);
      return NextResponse.json({ success: false, message: "資料庫寫入失敗 (line_users)" }, { status: 500 });
    }

    // 5. 更新 profiles，綁定 LINE 資訊
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        line_user_id,
        line_display_name: line_display_name || null,
        line_avatar_url: line_avatar_url || null,
        line_status_message: line_status_message || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile_id)
      .select(
        `
        id,
        email,
        name,
        phone,
        role,
        line_user_id,
        line_display_name,
        line_avatar_url,
        line_status_message,
        updated_at
      `
      )
      .single();

    if (updateError || !updatedProfile) {
      console.error("❌ 更新 profiles 失敗:", updateError);
      return NextResponse.json({ success: false, message: "綁定失敗，請稍後再試" }, { status: 500 });
    }

    // 6. (可選) 發送 LINE 歡迎訊息（失敗不影響綁定）
    try {
      const client = getLineClient();
      if (client) {
        await client.pushMessage(line_user_id, {
          type: "text",
          text: `🎉 綁定成功！\n親愛的 ${line_display_name || "住戶"} 您好，您已成功連接社區管理系統。\n現在您可以直接透過 LINE 接收包裹與繳費通知了！`,
        });
      }
    } catch (botError) {
      console.warn("⚠️ 機器人推播失敗 (可能用戶未加好友):", botError);
    }

    return NextResponse.json({
      success: true,
      message: "LINE 綁定成功",
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name,
        phone: updatedProfile.phone,
        role: updatedProfile.role,
        line_user_id: updatedProfile.line_user_id,
        line_display_name: updatedProfile.line_display_name,
        line_avatar_url: updatedProfile.line_avatar_url,
        line_status_message: updatedProfile.line_status_message,
        updated_at: updatedProfile.updated_at,
      },
    });
  } catch (error: any) {
    console.error("❌ LINE 綁定錯誤:", error);

    if (error?.code === "23505") {
      return NextResponse.json({ success: false, message: "此 LINE 帳號已被其他使用者綁定" }, { status: 409 });
    }

    return NextResponse.json({ success: false, message: error?.message ?? "伺服器錯誤，請稍後再試" }, { status: 500 });
  }
}

// 解除 LINE 綁定 API
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { profile_id } = await req.json();
    if (!profile_id) {
      return NextResponse.json({ success: false, message: "缺少 profile_id" }, { status: 400 });
    }

    console.log("🔓 解除 LINE 綁定請求:", profile_id);

    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update({
        line_user_id: null,
        line_display_name: null,
        line_avatar_url: null,
        line_status_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile_id)
      .select("id, email, name, line_user_id")
      .single();

    if (updateError || !profile) {
      return NextResponse.json({ success: false, message: "使用者不存在" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "LINE 綁定已解除",
      profile: { id: profile.id, email: profile.email, name: profile.name },
    });
  } catch (error: any) {
    console.error("❌ 解除綁定錯誤:", error);
    return NextResponse.json({ success: false, message: error?.message ?? "伺服器錯誤" }, { status: 500 });
  }
}
