// Shared state for all API routes
export const users: Record<string, boolean> = {}
export const messageQueues: Record<string, any[]> = {}

let messageCounter = 0

// Add a message to the queue
export function addMessage(message: any) {
  const { to } = message

  if (!to) {
    console.error("Message has no recipient (to field)")
    return
  }

  if (!messageQueues[to]) {
    messageQueues[to] = []
  }

  // Add message ID and timestamp
  const messageWithId = {
    ...message,
    id: ++messageCounter,
    timestamp: Date.now(),
  }

  messageQueues[to].push(messageWithId)

  // Keep only the last 100 messages
  if (messageQueues[to].length > 100) {
    messageQueues[to].shift()
  }

  console.log(`Added message to queue: ${message.type} for user ${to}`)
}

export const rooms: Record<string, Set<any>> = {}
export const MAX_CLIENTS_PER_ROOM = 2

