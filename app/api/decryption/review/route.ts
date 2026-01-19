import { type NextRequest, NextResponse } from "next/server"
import { adminReviewDecryptionRequest, committeeReviewDecryptionRequest } from "@/features/decryption/api/decryption"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, reviewerId, reviewerRole, approved, notes } = body

    if (!requestId || !reviewerId || !reviewerRole || approved === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let result
    if (reviewerRole === "admin") {
      result = await adminReviewDecryptionRequest(requestId, {
        adminId: reviewerId,
        approved,
        notes,
      })
    } else if (reviewerRole === "committee") {
      result = await committeeReviewDecryptionRequest(requestId, {
        committeeId: reviewerId,
        approved,
        notes,
      })
    } else {
      return NextResponse.json({ error: "Invalid reviewer role" }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error reviewing decryption request:", error)
    return NextResponse.json({ error: error.message || "Failed to review decryption request" }, { status: 500 })
  }
}
