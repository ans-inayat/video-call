// Make sure the rooms and messageQueues are shared between all API routes
import { rooms, addMessage } from "../shared-state"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { roomId, clientId } = await req.json()

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    // Check if room exists
    if (rooms[roomId]) {
      // Remove client from room
      if (clientId) {
        rooms[roomId].delete(clientId)
      }

      // Add message to notify other clients
      addMessage({
        type: "user-left",
        roomId,
        timestamp: Date.now(),
      })

      // Delete room if empty
      if (rooms[roomId].size === 0) {
        delete rooms[roomId]
        console.log(`Room ${roomId} deleted (empty)`)
      }
    }

    return NextResponse.json({ success: true, message: `Left room ${roomId}` })
  } catch (error) {
    console.error("Error leaving room:", error)
    return NextResponse.json({ error: "Failed to leave room" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"

