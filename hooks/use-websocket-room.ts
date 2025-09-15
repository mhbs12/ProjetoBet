import { useEffect, useRef, useState, useCallback } from 'react'
import type { SimpleRoom } from '@/lib/simple-room-manager'

export interface WebSocketMessage {
  type: 'connected' | 'subscribed' | 'room_state_changed' | 'error'
  roomId?: string
  data?: SimpleRoom
  message?: string
}

export function useWebSocketRoomSync(roomId: string | null) {
  const [connected, setConnected] = useState(false)
  const [roomState, setRoomState] = useState<SimpleRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!roomId || wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001'
      const wsUrl = `ws://localhost:${wsPort}`
      
      console.log(`[WebSocket] Connecting to ${wsUrl}`)
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected successfully')
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0

        // Subscribe to room updates
        if (roomId) {
          wsRef.current?.send(JSON.stringify({
            type: 'subscribe',
            roomId
          }))
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          console.log('[WebSocket] Received message:', message.type, message.roomId)

          switch (message.type) {
            case 'connected':
              console.log('[WebSocket] Connection acknowledged')
              break

            case 'subscribed':
              console.log(`[WebSocket] Subscribed to room: ${message.roomId}`)
              break

            case 'room_state_changed':
              if (message.data && message.roomId === roomId) {
                console.log('[WebSocket] Room state updated:', message.data)
                setRoomState(message.data)
              }
              break

            case 'error':
              console.error('[WebSocket] Server error:', message.message)
              setError(message.message || 'WebSocket error')
              break

            default:
              console.warn('[WebSocket] Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason)
        setConnected(false)

        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('Failed to reconnect to WebSocket server')
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error)
        setError('WebSocket connection error')
      }

    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error)
      setError('Failed to create WebSocket connection')
    }
  }, [roomId])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      if (roomId && wsRef.current.readyState === WebSocket.OPEN) {
        // Unsubscribe from room before closing
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          roomId
        }))
      }

      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    setConnected(false)
    setRoomState(null)
    setError(null)
    reconnectAttempts.current = 0
  }, [roomId])

  const broadcastRoomUpdate = useCallback((roomData: SimpleRoom) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(JSON.stringify({
        type: 'room_update',
        roomId,
        data: roomData
      }))
      console.log('[WebSocket] Broadcasted room update:', roomData)
    }
  }, [roomId])

  // Initialize WebSocket server and connect when component mounts
  useEffect(() => {
    if (!roomId) return

    // First, ensure WebSocket server is running
    fetch('/api/socket')
      .then(() => {
        console.log('[WebSocket] Server initialized')
        // Small delay to let server fully start
        setTimeout(connect, 500)
      })
      .catch((error) => {
        console.error('[WebSocket] Failed to initialize server:', error)
        setError('Failed to initialize WebSocket server')
      })

    return disconnect
  }, [roomId, connect, disconnect])

  // Change room subscription when roomId changes
  useEffect(() => {
    if (connected && wsRef.current && roomId) {
      // Subscribe to new room
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        roomId
      }))
    }
  }, [roomId, connected])

  return {
    connected,
    roomState,
    error,
    broadcastRoomUpdate,
    disconnect
  }
}