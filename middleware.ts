import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const isWebSocketRequest = request.headers.get("upgrade")?.toLowerCase() === "websocket"

  // Allow WebSocket connections to proceed
  if (isWebSocketRequest) {
    console.log("Middleware: WebSocket upgrade request detected")
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/ws"],
}

