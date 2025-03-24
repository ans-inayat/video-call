import { users } from "../shared-state"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Register user
    users[userId] = true
    console.log(`User registered: ${userId}`)

    return NextResponse.json({
      success: true,
      userId,
      message: `User ${userId} registered successfully`,
    })
  } catch (error) {
    console.error("Error registering user:", error)
    return NextResponse.json({ error: "Failed to register user" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"

