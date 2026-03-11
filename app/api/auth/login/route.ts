import { NextRequest, NextResponse } from "next/server"
import { performLogin } from "@/lib/auth-service"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    // 使用共享的登入邏輯
    const result = await performLogin(email, password)

    if (!result.success) {
      // 根據錯誤類型返回適當的 HTTP 狀態碼
      const statusCode = result.error?.includes("停用") ? 403 : result.error?.includes("必填") ? 400 : 401

      return NextResponse.json(
        {
          success: false,
          message: result.error || result.message,
        },
        { status: statusCode },
      )
    }

    // 登入成功
    return NextResponse.json({
      success: true,
      message: result.message || "登入成功",
      user: {
        ...result.user,
        line_bound: !!result.user?.line_user_id,
      },
    })
  } catch (error: any) {
    console.error("❌ 登入錯誤:", error)
    return NextResponse.json({ success: false, message: "伺服器錯誤" }, { status: 500 })
  }
}