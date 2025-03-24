import type { NextRequest } from "next/server"
import { WebSocketServer } from "ws"

// Store active connections and rooms
const rooms: Record<string, Set<any>> = {}
const MAX_CLIENTS_PER_ROOM = 2

// Initialize WebSocket server (only once)
let wss: WebSocketServer | null = null

export async function GET(req: NextRequest) {
  // Check if the request is a WebSocket upgrade request
  const upgrade = req.headers.get("upgrade")
  if (upgrade !== "websocket") {
    return new Response("Expected Upgrade: WebSocket", { status: 426 })
  }

  try {
    // Get the socket from the request
    const { socket } = req as any

    if (!socket) {
      return new Response("WebSocket upgrade failed", { status: 500 })
    }

    // Create WebSocket server if it doesn't exist
    if (!wss) {
      console.log("Creating new WebSocket server")
      wss = new WebSocketServer({ noServer: true })

      wss.on("connection", (ws: any) => {
        console.log("Client connected")

        let currentRoom: string | null = null

        ws.on("message", (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString())
            console.log(`Received message type: ${data.type}, room: ${data.roomId}`)

            switch (data.type) {
              case "join-room":
                // Leave current room if in one
                if (currentRoom) {
                  leaveRoom(currentRoom, ws)
                }

                // Join new room
                currentRoom = data.roomId
                joinRoom(currentRoom, ws)
                break

              case "leave-room":
                if (currentRoom) {
                  leaveRoom(currentRoom, ws)
                  currentRoom = null
                }
                break

              case "offer":
              case "answer":
              case "ice-candidate":
                // Forward message to all other clients in the room
                if (currentRoom && rooms[currentRoom]) {
                  console.log(`Forwarding ${data.type} to other clients in room ${currentRoom}`)
                  rooms[currentRoom].forEach((client: any) => {
                    if (client !== ws && client.readyState === ws.OPEN) {
                      client.send(message.toString())
                    }
                  })
                }
                break
            }
          } catch (error) {
            console.error("Error processing message:", error)
          }
        })

        ws.on("close", () => {
          console.log("Client disconnected")

          // Leave room on disconnect
          if (currentRoom) {
            leaveRoom(currentRoom, ws)
          }
        })

        ws.on("error", (error: any) => {
          console.error("WebSocket error:", error)
        })
      })
    }

    // Handle the WebSocket connection
    const response = await new Promise((resolve) => {
      wss!.handleUpgrade(req as any, socket, Buffer.alloc(0), (ws) => {
        wss!.emit("connection", ws, req)
        resolve(new Response(null, { status: 101 }))
      })
    })

    return response as Response
  } catch (error) {
    console.error("WebSocket upgrade error:", error)
    return new Response("WebSocket upgrade error", { status: 500 })
  }
}

// Join a room
function joinRoom(roomId: string, ws: any) {
  // Create room if it doesn't exist
  if (!rooms[roomId]) {
    rooms[roomId] = new Set()
    console.log(`Created new room: ${roomId}`)
  }

  // Check if room is full
  if (rooms[roomId].size >= MAX_CLIENTS_PER_ROOM) {
    console.log(`Room ${roomId} is full, rejecting client`)
    ws.send(JSON.stringify({ type: "room-full" }))
    return
  }

  // Add client to room
  rooms[roomId].add(ws)

  // Notify client they've joined
  ws.send(JSON.stringify({ type: "room-joined", roomId }))
  console.log(`Client joined room ${roomId}`)

  // Notify other clients in the room
  rooms[roomId].forEach((client: any) => {
    if (client !== ws && client.readyState === ws.OPEN) {
      client.send(JSON.stringify({ type: "user-joined", roomId }))
    }
  })

  console.log(`Room ${roomId} now has ${rooms[roomId].size} clients`)
}

// Leave a room
function leaveRoom(roomId: string, ws: any) {
  if (rooms[roomId]) {
    // Remove client from room
    rooms[roomId].delete(ws)
    console.log(`Client left room ${roomId}`)

    // Notify other clients
    rooms[roomId].forEach((client: any) => {
      if (client.readyState === ws.OPEN) {
        client.send(JSON.stringify({ type: "user-left", roomId }))
      }
    })

    // Delete room if empty
    if (rooms[roomId].size === 0) {
      delete rooms[roomId]
      console.log(`Room ${roomId} deleted (empty)`)
    } else {
      console.log(`Room ${roomId} now has ${rooms[roomId].size} clients`)
    }
  }
}

export const dynamic = "force-dynamic"

