import { users, messageQueues } from "../shared-state"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Unregister user
    delete users[userId]

    // Clear message queue
    delete messageQueues[userId]

    console.log(`User unregistered: ${userId}`)

    return NextResponse.json({
      success: true,
      message: `User ${userId} unregistered successfully`,
    })
  } catch (error) {
    console.error("Error unregistering user:", error)
    return NextResponse.json({ error: "Failed to unregister user" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"

