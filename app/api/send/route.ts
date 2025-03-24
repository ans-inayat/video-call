import { addMessage, users } from "../shared-state"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const message = await req.json()

    if (!message || !message.to || !message.from || !message.type) {
      return NextResponse.json({ error: "Invalid message format" }, { status: 400 })
    }

    // Check if recipient exists
    if (!users[message.to]) {
      return NextResponse.json(
        {
          error: "Recipient not found or offline",
          success: false,
        },
        { status: 404 },
      )
    }

    // Add message to queue
    addMessage(message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"

