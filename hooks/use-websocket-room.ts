import { useEffect, useRef, useState, useCallback } from 'react'
import type { SimpleRoom } from '@/lib/simple-room-manager'

export interface SSEMessage {
  type: 'connected' | 'room_state_changed' | 'error'
  roomId?: string
  data?: SimpleRoom
  message?: string
  timestamp?: number
}

export function useServerSentEventsRoomSync(roomId: string | null) {
  const [connected, setConnected] = useState(false)
  const [roomState, setRoomState] = useState<SimpleRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!roomId || eventSourceRef.current?.readyState === EventSource.OPEN) return

    try {
      const url = `/api/socket?roomId=${encodeURIComponent(roomId)}`
      console.log(`[SSE] Connecting to ${url}`)
      
      eventSourceRef.current = new EventSource(url)

      eventSourceRef.current.onopen = () => {
        console.log('[SSE] Connected successfully')
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0
      }

      eventSourceRef.current.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data)
          console.log('[SSE] Received message:', message.type, message.roomId)

          switch (message.type) {
            case 'connected':
              console.log('[SSE] Connection acknowledged for room:', message.roomId)
              break

            case 'room_state_changed':
              if (message.data && message.roomId === roomId) {
                console.log('[SSE] Room state updated:', message.data)
                setRoomState(message.data)
              }
              break

            case 'error':
              console.error('[SSE] Server error:', message.message)
              setError(message.message || 'SSE error')
              break

            default:
              console.warn('[SSE] Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('[SSE] Failed to parse message:', error)
        }
      }

      eventSourceRef.current.onerror = (event) => {
        console.log('[SSE] Connection error or closed')
        setConnected(false)

        // Attempt to reconnect if not a manual close
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('Failed to reconnect to server')
        }
      }

    } catch (error) {
      console.error('[SSE] Failed to create connection:', error)
      setError('Failed to create SSE connection')
    }
  }, [roomId])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setConnected(false)
    setRoomState(null)
    setError(null)
    reconnectAttempts.current = 0
  }, [])

  const broadcastRoomUpdate = useCallback(async (roomData: SimpleRoom) => {
    if (roomId) {
      try {
        await fetch('/api/socket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomId,
            roomData
          })
        })
        console.log('[SSE] Broadcasted room update:', roomData)
      } catch (error) {
        console.error('[SSE] Failed to broadcast room update:', error)
      }
    }
  }, [roomId])

  // Connect when component mounts or roomId changes
  useEffect(() => {
    if (!roomId) return

    console.log('[SSE] Initializing connection for room:', roomId)
    connect()

    return disconnect
  }, [roomId, connect, disconnect])

  return {
    connected,
    roomState,
    error,
    broadcastRoomUpdate,
    disconnect
  }
}

// Export with backward compatibility alias
export const useWebSocketRoomSync = useServerSentEventsRoomSync