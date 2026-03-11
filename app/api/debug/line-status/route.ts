import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Client } from "@line/bot-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

    // 1. 環境變數檢查
    const envStatus = {
      LINE_CHANNEL_ACCESS_TOKEN_exists: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      LINE_CHANNEL_SECRET_exists: !!process.env.LINE_CHANNEL_SECRET,
      SUPABASE_URL_exists: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY_exists: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY_exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }

    // 2. 統計 LINE 綁定住戶
    const { data: profilesWithLine, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, line_user_id, unit_id")
      .not("line_user_id", "is", null)

    const profilesCount = profilesWithLine?.length || 0

    // 3. 檢查 line_users 表
    const { data: lineUsers, error: lineUsersError } = await supabase.from("line_users").select("*")
    const lineUsersCount = lineUsers?.length || 0

    // 4. 最新的包裹
    const { data: latestPackage, error: packageError } = await supabase
      .from("packages")
      .select("id, courier, recipient_room, unit_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    // 5. 如果有最新包裹，查看其 unit_id 是否能找到 LINE user
    let packageLineUserLookup = null
    if (latestPackage?.unit_id) {
      const { data: profilesForUnit } = await supabase
        .from("profiles")
        .select("id, name, line_user_id, line_display_name")
        .eq("unit_id", latestPackage.unit_id)
        .not("line_user_id", "is", null)

      packageLineUserLookup = {
        unit_id: latestPackage.unit_id,
        profiles_found: profilesForUnit?.length || 0,
        line_user_ids: profilesForUnit?.map((p) => ({ name: p.name, id: p.line_user_id })) || [],
      }
    }

    // 6. 嘗試推送測試訊息到第一個綁定的住戶
    let lineTestResult = null
    if (profilesWithLine && profilesWithLine.length > 0) {
      const testUserId = profilesWithLine[0].line_user_id
      try {
        const client = new Client({
          channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
          channelSecret: process.env.LINE_CHANNEL_SECRET!,
        })

        await client.pushMessage(testUserId, {
          type: "text",
          text: "🔍 LINE 推播診斷測試 - 如果你收到這個訊息，表示推播系統正常運作！",
        })

        lineTestResult = {
          success: true,
          test_user_id: testUserId,
          test_user_name: profilesWithLine[0].name,
          message: "測試訊息推送成功",
        }
      } catch (lineError: any) {
        lineTestResult = {
          success: false,
          test_user_id: testUserId,
          test_user_name: profilesWithLine[0].name,
          error: lineError?.message || String(lineError),
          details: lineError?.response?.data || lineError?.toString(),
        }
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envStatus,
      line_binding_status: {
        profiles_with_line_bound: profilesCount,
        line_users_table_count: lineUsersCount,
        profiles_with_line_error: profileError?.message || null,
        line_users_error: lineUsersError?.message || null,
      },
      latest_package: latestPackage ? {
        id: latestPackage.id,
        courier: latestPackage.courier,
        recipient_room: latestPackage.recipient_room,
        unit_id: latestPackage.unit_id,
        status: latestPackage.status,
        created_at: latestPackage.created_at,
      } : null,
      package_line_user_lookup: packageLineUserLookup,
      line_push_test: lineTestResult,
      summary: {
        is_env_complete: Object.values(envStatus).every((v) => v === true),
        bound_users_count: profilesCount,
        can_find_user_for_latest_package: !!packageLineUserLookup?.line_user_ids?.length,
        line_push_working: lineTestResult?.success || false,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Unknown error",
        details: error?.toString(),
      },
      { status: 500 },
    )
  }
}
