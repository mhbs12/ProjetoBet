import { useEffect, useRef, useState, useCallback } from 'react'
import type { SimpleRoom } from '@/lib/simple-room-manager'

export interface SSEMessage {
  type: 'connected' | 'connection_ready' | 'room_state_changed' | 'error'
  roomId?: string
  connectionId?: string
  data?: SimpleRoom
  message?: string
  timestamp?: number
}

export function useServerSentEventsRoomSync(roomId: string | null) {
  const [connected, setConnected] = useState(false)
  const [roomState, setRoomState] = useState<SimpleRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionReady, setConnectionReady] = useState(false)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const connectionAttemptTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!roomId || eventSourceRef.current?.readyState === EventSource.OPEN) return

    try {
      const url = `/api/socket?roomId=${encodeURIComponent(roomId)}`
      console.log(`[SSE] Connecting to ${url}`)
      
      eventSourceRef.current = new EventSource(url)

      // Set a timeout for the connection attempt
      connectionAttemptTimeoutRef.current = setTimeout(() => {
        if (!connectionReady) {
          console.warn('[SSE] Connection timeout - forcing reconnect')
          setConnected(false)
          setConnectionReady(false)
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
          }
          
          // Trigger reconnect logic
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++
              connect()
            }, delay)
          }
        }
      }, 5000) // 5 second timeout for connection establishment

      eventSourceRef.current.onopen = () => {
        console.log('[SSE] Connected successfully')
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0
      }

      eventSourceRef.current.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data)
          console.log('[SSE] Received message:', message.type, message.roomId, message.connectionId)

          switch (message.type) {
            case 'connected':
              console.log('[SSE] Connection acknowledged for room:', message.roomId)
              setConnectionId(message.connectionId || null)
              
              // Clear connection timeout since we received a response
              if (connectionAttemptTimeoutRef.current) {
                clearTimeout(connectionAttemptTimeoutRef.current)
                connectionAttemptTimeoutRef.current = null
              }
              break

            case 'connection_ready':
              console.log('[SSE] Connection ready for room:', message.roomId)
              setConnectionReady(true)
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
        setConnectionReady(false)

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

    if (connectionAttemptTimeoutRef.current) {
      clearTimeout(connectionAttemptTimeoutRef.current)
      connectionAttemptTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setConnected(false)
    setConnectionReady(false)
    setRoomState(null)
    setError(null)
    setConnectionId(null)
    reconnectAttempts.current = 0
  }, [])

  const broadcastRoomUpdate = useCallback(async (roomData: SimpleRoom) => {
    if (roomId) {
      try {
        console.log('[SSE] Broadcasting room update:', roomData)
        
        // Validate connection is ready before broadcasting
        if (!connected || !connectionReady) {
          console.warn('[SSE] Attempting to broadcast without stable connection, queuing update')
          // TODO: Could implement a queue mechanism here for offline updates
        }
        
        const response = await fetch('/api/socket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomId,
            roomData
          })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        console.log('[SSE] Room update broadcasted successfully:', roomData)
      } catch (error) {
        console.error('[SSE] Failed to broadcast room update:', error)
        setError(`Broadcast failed: ${error.message}`)
      }
    }
  }, [roomId, connected, connectionReady])

  // Connect when component mounts or roomId changes
  useEffect(() => {
    if (!roomId) return

    console.log('[SSE] Initializing connection for room:', roomId)
    connect()

    return disconnect
  }, [roomId, connect, disconnect])

  return {
    connected,
    connectionReady,
    roomState,
    error,
    connectionId,
    broadcastRoomUpdate,
    disconnect
  }
}

// Export with backward compatibility alias
export const useWebSocketRoomSync = useServerSentEventsRoomSync