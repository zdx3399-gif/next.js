import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const lineSecret = process.env.LINE_CHANNEL_SECRET

    return NextResponse.json({
      line_token_exists: !!lineToken,
      line_token_length: lineToken?.length || 0,
      line_token_preview: lineToken ? `${lineToken.substring(0, 20)}...` : null,
      line_secret_exists: !!lineSecret,
      line_secret_length: lineSecret?.length || 0,
      line_secret_preview: lineSecret ? `${lineSecret.substring(0, 10)}...` : null,
      supabase_url_exists: !!process.env.SUPABASE_URL,
      supabase_key_exists: !!process.env.SUPABASE_ANON_KEY,
      supabase_service_role_exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
