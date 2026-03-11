import { type NextRequest, NextResponse } from "next/server"
import { createDecryptionRequest } from "@/features/decryption/api/decryption"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lineUserId, targetType, targetId, reason } = body

    if (!lineUserId || !targetType || !targetId || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await createDecryptionRequest({
      lineUserId,
      targetType,
      targetId,
      reason,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating decryption request:", error)
    return NextResponse.json({ error: "Failed to create decryption request" }, { status: 500 })
  }
}
