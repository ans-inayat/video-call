import { messageQueues } from "../shared-state"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get("userId")
    const lastId = Number.parseInt(url.searchParams.get("lastId") || "0", 10)

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get messages for the user
    const messages = messageQueues[userId] || []

    // Filter messages newer than lastId
    const newMessages = messages.filter((msg) => msg.id > lastId)

    // Get the highest message ID
    const highestId = newMessages.length > 0 ? Math.max(...newMessages.map((msg) => msg.id)) : lastId

    return NextResponse.json({
      messages: newMessages,
      lastId: highestId,
    })
  } catch (error) {
    console.error("Error getting messages:", error)
    return NextResponse.json({ error: "Failed to get messages" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"

