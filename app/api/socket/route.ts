import { NextRequest } from 'next/server'

// Store room subscriptions
const roomSubscriptions = new Map<string, Set<{ writer: any; encoder: TextEncoder }>>()

// Broadcast room state change to all subscribers
export function broadcastRoomStateChange(roomId: string, roomData: any) {
  const connections = roomSubscriptions.get(roomId)
  if (!connections) return

  const message = JSON.stringify({
    type: 'room_state_changed',
    roomId,
    data: roomData,
    timestamp: Date.now()
  })

  let activeCount = 0
  connections.forEach(async ({ writer, encoder }) => {
    try {
      writer.enqueue(encoder.encode(`data: ${message}\n\n`))
      activeCount++
    } catch (error) {
      console.log('[SSE] Connection closed, removing from subscribers')
      connections.delete({ writer, encoder })
    }
  })

  console.log(`[SSE] Broadcasted room state change to ${activeCount} connections for room: ${roomId}`)
  
  // Clean up if no active connections
  if (activeCount === 0) {
    roomSubscriptions.delete(roomId)
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')

  if (!roomId) {
    return new Response(JSON.stringify({ error: 'Missing roomId parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const encoder = new TextEncoder()

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Client subscribed to room: ${roomId}`)

      // Add connection to room subscriptions
      if (!roomSubscriptions.has(roomId)) {
        roomSubscriptions.set(roomId, new Set())
      }

      const connectionData = { writer: controller, encoder }
      roomSubscriptions.get(roomId)!.add(connectionData)

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'connected',
        roomId,
        message: 'SSE connected to room'
      })}\n\n`))

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected from room: ${roomId}`)
        const connections = roomSubscriptions.get(roomId)
        if (connections) {
          connections.delete(connectionData)
          if (connections.size === 0) {
            roomSubscriptions.delete(roomId)
          }
        }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { roomId, roomData } = body

  if (!roomId || !roomData) {
    return new Response(JSON.stringify({ error: 'Missing roomId or roomData' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Broadcast the room state change
  broadcastRoomStateChange(roomId, roomData)

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
}