import { NextRequest } from 'next/server'
import { WebSocketServer } from 'ws'

// Global WebSocket server instance
let wss: WebSocketServer | null = null

// Store room subscriptions
const roomSubscriptions = new Map<string, Set<any>>()

// Initialize WebSocket server
function initWebSocketServer() {
  if (wss) return wss

  const port = parseInt(process.env.WS_PORT || '3001')
  wss = new WebSocketServer({ port })

  console.log(`[WebSocket] Server started on port ${port}`)

  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] New client connected')

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        handleWebSocketMessage(ws, message)
      } catch (error) {
        console.error('[WebSocket] Invalid message format:', error)
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
      }
    })

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected')
      // Remove client from all room subscriptions
      roomSubscriptions.forEach((clients, roomId) => {
        clients.delete(ws)
        if (clients.size === 0) {
          roomSubscriptions.delete(roomId)
        }
      })
    })

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error)
    })

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }))
  })

  return wss
}

function handleWebSocketMessage(ws: any, message: any) {
  const { type, roomId, data } = message

  switch (type) {
    case 'subscribe':
      if (roomId) {
        if (!roomSubscriptions.has(roomId)) {
          roomSubscriptions.set(roomId, new Set())
        }
        roomSubscriptions.get(roomId)!.add(ws)
        console.log(`[WebSocket] Client subscribed to room: ${roomId}`)
        
        ws.send(JSON.stringify({ 
          type: 'subscribed', 
          roomId,
          message: `Subscribed to room ${roomId}` 
        }))
      }
      break

    case 'unsubscribe':
      if (roomId && roomSubscriptions.has(roomId)) {
        roomSubscriptions.get(roomId)!.delete(ws)
        console.log(`[WebSocket] Client unsubscribed from room: ${roomId}`)
        
        if (roomSubscriptions.get(roomId)!.size === 0) {
          roomSubscriptions.delete(roomId)
        }
      }
      break

    case 'room_update':
      if (roomId && roomSubscriptions.has(roomId)) {
        const clients = roomSubscriptions.get(roomId)!
        const updateMessage = JSON.stringify({
          type: 'room_state_changed',
          roomId,
          data
        })

        clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) { // Don't send back to sender
            client.send(updateMessage)
          }
        })

        console.log(`[WebSocket] Broadcasted room update to ${clients.size - 1} clients for room: ${roomId}`)
      }
      break

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }))
  }
}

// Broadcast room state change to all subscribers
export function broadcastRoomStateChange(roomId: string, roomData: any) {
  if (!wss || !roomSubscriptions.has(roomId)) return

  const clients = roomSubscriptions.get(roomId)!
  const message = JSON.stringify({
    type: 'room_state_changed',
    roomId,
    data: roomData
  })

  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message)
    }
  })

  console.log(`[WebSocket] Broadcasted room state change to ${clients.size} clients for room: ${roomId}`)
}

export async function GET(request: NextRequest) {
  // Initialize WebSocket server on first request
  initWebSocketServer()

  return new Response(JSON.stringify({ 
    status: 'WebSocket server running',
    port: process.env.WS_PORT || '3001'
  }), {
    headers: { 'Content-Type': 'application/json' }
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