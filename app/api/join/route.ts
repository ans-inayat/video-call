// Make sure the rooms and messageQueues are shared between all API routes
import { rooms, addMessage, MAX_CLIENTS_PER_ROOM } from "../shared-state"
import { type NextRequest, NextResponse } from "next/server"

// Generate a unique client ID
function generateClientId() {
  return Math.random().toString(36).substring(2, 15)
}

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json()

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = new Set()
      console.log(`Created new room: ${roomId}`)
    }

    // Check if room is full
    if (rooms[roomId].size >= MAX_CLIENTS_PER_ROOM) {
      return NextResponse.json({ error: "Room is full" }, { status: 403 })
    }

    // Generate a client ID
    const clientId = generateClientId()

    // Add client to room
    rooms[roomId].add(clientId)
    console.log(`Client ${clientId} joined room ${roomId}`)

    // Add message to notify other clients
    addMessage({
      type: "user-joined",
      roomId,
      timestamp: Date.now(),
    })

    // Add message to notify the client they've joined
    addMessage({
      type: "room-joined",
      roomId,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      success: true,
      roomId,
      clientId,
      message: `Joined room ${roomId}`,
    })
  } catch (error) {
    console.error("Error joining room:", error)
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"

