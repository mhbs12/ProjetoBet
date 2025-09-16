import { NextRequest } from 'next/server'

// Store room subscriptions with enhanced tracking
const roomSubscriptions = new Map<string, Set<{ 
  writer: any; 
  encoder: TextEncoder;
  connectionId: string;
  connectedAt: number;
  lastActivity: number;
}>>()

// Broadcast room state change to all subscribers
export function broadcastRoomStateChange(roomId: string, roomData: any) {
  const connections = roomSubscriptions.get(roomId)
  if (!connections) {
    console.log(`[SSE] No connections found for room: ${roomId}`)
    return
  }

  const message = JSON.stringify({
    type: 'room_state_changed',
    roomId,
    data: roomData,
    timestamp: Date.now()
  })

  let activeCount = 0
  const connectionsToRemove = new Set()
  
  connections.forEach(async (connectionData) => {
    try {
      // Update last activity time for connection tracking
      connectionData.lastActivity = Date.now()
      
      connectionData.writer.enqueue(connectionData.encoder.encode(`data: ${message}\n\n`))
      activeCount++
      console.log(`[SSE] Sent room update to connection: ${connectionData.connectionId}`)
    } catch (error) {
      console.log(`[SSE] Connection closed, marking for removal: ${connectionData.connectionId}`)
      connectionsToRemove.add(connectionData)
    }
  })

  // Clean up closed connections
  connectionsToRemove.forEach(connectionData => {
    connections.delete(connectionData)
  })

  console.log(`[SSE] Broadcasted room state change to ${activeCount} active connections for room: ${roomId}`)
  
  // Clean up room subscriptions if no active connections
  if (connections.size === 0) {
    roomSubscriptions.delete(roomId)
    console.log(`[SSE] Removed empty room subscriptions for room: ${roomId}`)
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
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[SSE] New connection attempt for room: ${roomId}, connectionId: ${connectionId}`)

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Client subscribed to room: ${roomId}`)

      // Add connection to room subscriptions with enhanced tracking
      if (!roomSubscriptions.has(roomId)) {
        roomSubscriptions.set(roomId, new Set())
      }

      const connectionData = { 
        writer: controller, 
        encoder,
        connectionId,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      }
      roomSubscriptions.get(roomId)!.add(connectionData)

      // Send initial connection message with connection validation
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'connected',
        roomId,
        connectionId,
        message: 'SSE connected to room',
        timestamp: Date.now()
      })}\n\n`))

      // Send current room status if available (for faster initial sync)
      setTimeout(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'connection_ready',
            roomId,
            connectionId,
            message: 'Connection established and ready for room updates',
            timestamp: Date.now()
          })}\n\n`))
        } catch (error) {
          console.log(`[SSE] Connection closed before ready signal: ${connectionId}`)
        }
      }, 100)

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected from room: ${roomId}, connectionId: ${connectionId}`)
        const connections = roomSubscriptions.get(roomId)
        if (connections) {
          connections.delete(connectionData)
          if (connections.size === 0) {
            roomSubscriptions.delete(roomId)
            console.log(`[SSE] Removed empty room subscriptions for room: ${roomId}`)
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