/**
 * Global Room Synchronization Service
 * 
 * This service enables real-time room synchronization across different browser sessions,
 * tabs, and even different devices on the same network using multiple synchronization methods.
 */

import type { GameRoom } from './game-state'

// Storage keys for different sync methods
const GLOBAL_ROOMS_KEY = 'global-game-rooms'
const BROADCAST_CHANNEL_NAME = 'tictactoe-rooms'
const NETWORK_STORAGE_KEY = 'network-room-sync'

export interface RoomSyncEvent {
  type: 'room_created' | 'room_updated' | 'room_joined' | 'room_deleted' | 'rooms_requested'
  room?: GameRoom
  roomId?: string
  timestamp: number
  senderId: string
}

class GlobalRoomSyncService {
  private broadcastChannel?: BroadcastChannel
  private listeners: ((event: RoomSyncEvent) => void)[] = []
  private syncInterval?: NodeJS.Timeout
  private readonly syncId: string
  private isEnabled = false

  constructor() {
    this.syncId = Math.random().toString(36).substr(2, 9)
    this.initialize()
  }

  private initialize() {
    if (typeof window === 'undefined') return

    try {
      // Initialize BroadcastChannel for tab-to-tab communication
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data)
        }
        console.log('[GlobalSync] BroadcastChannel initialized')
      }

      // Enable storage events for cross-window communication
      window.addEventListener('storage', this.handleStorageChange.bind(this))

      // Start periodic sync for persistence
      this.startPeriodicSync()

      this.isEnabled = true
      console.log('[GlobalSync] Service initialized with sync ID:', this.syncId)
    } catch (error) {
      console.warn('[GlobalSync] Failed to initialize:', error)
    }
  }

  private handleBroadcastMessage(event: RoomSyncEvent) {
    if (event.senderId === this.syncId) return // Ignore own messages
    
    console.log('[GlobalSync] Received broadcast:', event.type, event.roomId)
    this.notifyListeners(event)
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === GLOBAL_ROOMS_KEY && event.newValue && event.oldValue !== event.newValue) {
      console.log('[GlobalSync] Detected storage change')
      this.notifyListeners({
        type: 'room_updated',
        timestamp: Date.now(),
        senderId: 'storage'
      })
    }
  }

  private startPeriodicSync() {
    // Sync every 3 seconds to catch updates from other sessions
    this.syncInterval = setInterval(() => {
      this.broadcastEvent({
        type: 'rooms_requested',
        timestamp: Date.now(),
        senderId: this.syncId
      })
    }, 3000)
  }

  private notifyListeners(event: RoomSyncEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.warn('[GlobalSync] Listener error:', error)
      }
    })
  }

  /**
   * Broadcast a room event to all connected sessions
   */
  broadcastEvent(event: RoomSyncEvent) {
    if (!this.isEnabled) return

    try {
      // Use BroadcastChannel for same-origin tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(event)
      }

      // Use localStorage for cross-window persistence
      const storageEvent = {
        ...event,
        storageTimestamp: Date.now()
      }
      
      // Trigger storage event by updating a sync key
      localStorage.setItem(NETWORK_STORAGE_KEY, JSON.stringify(storageEvent))
      
      console.log('[GlobalSync] Broadcasted event:', event.type, event.roomId)
    } catch (error) {
      console.warn('[GlobalSync] Failed to broadcast event:', error)
    }
  }

  /**
   * Announce room creation to all sessions
   */
  announceRoomCreated(room: GameRoom) {
    this.broadcastEvent({
      type: 'room_created',
      room,
      roomId: room.id,
      timestamp: Date.now(),
      senderId: this.syncId
    })
  }

  /**
   * Announce room updates to all sessions
   */
  announceRoomUpdated(room: GameRoom) {
    this.broadcastEvent({
      type: 'room_updated',
      room,
      roomId: room.id,
      timestamp: Date.now(),
      senderId: this.syncId
    })
  }

  /**
   * Announce when a player joins a room
   */
  announceRoomJoined(room: GameRoom) {
    this.broadcastEvent({
      type: 'room_joined',
      room,
      roomId: room.id,
      timestamp: Date.now(),
      senderId: this.syncId
    })
  }

  /**
   * Announce room deletion to all sessions
   */
  announceRoomDeleted(roomId: string) {
    this.broadcastEvent({
      type: 'room_deleted',
      roomId,
      timestamp: Date.now(),
      senderId: this.syncId
    })
  }

  /**
   * Add listener for sync events
   */
  addListener(listener: (event: RoomSyncEvent) => void): () => void {
    this.listeners.push(listener)
    
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Get all rooms from global storage
   */
  getGlobalRooms(): Record<string, GameRoom> {
    if (typeof window === 'undefined') return {}

    try {
      const stored = localStorage.getItem(GLOBAL_ROOMS_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.warn('[GlobalSync] Failed to get global rooms:', error)
      return {}
    }
  }

  /**
   * Save room to global storage
   */
  saveRoomToGlobal(room: GameRoom) {
    if (typeof window === 'undefined') return

    try {
      const existingRooms = this.getGlobalRooms()
      existingRooms[room.id] = room
      localStorage.setItem(GLOBAL_ROOMS_KEY, JSON.stringify(existingRooms))
      console.log('[GlobalSync] Room saved to global storage:', room.id)
    } catch (error) {
      console.warn('[GlobalSync] Failed to save room to global storage:', error)
    }
  }

  /**
   * Remove room from global storage
   */
  removeRoomFromGlobal(roomId: string) {
    if (typeof window === 'undefined') return

    try {
      const existingRooms = this.getGlobalRooms()
      delete existingRooms[roomId]
      localStorage.setItem(GLOBAL_ROOMS_KEY, JSON.stringify(existingRooms))
      console.log('[GlobalSync] Room removed from global storage:', roomId)
    } catch (error) {
      console.warn('[GlobalSync] Failed to remove room from global storage:', error)
    }
  }

  /**
   * Clean up expired rooms from global storage
   */
  cleanupExpiredRooms() {
    if (typeof window === 'undefined') return

    try {
      const rooms = this.getGlobalRooms()
      const now = Date.now()
      let cleaned = false

      Object.entries(rooms).forEach(([id, room]) => {
        // Remove rooms older than 2 hours or finished games older than 30 minutes
        const maxAge = room.gameState === 'finished' ? 1800000 : 7200000
        if (now - room.createdAt > maxAge) {
          delete rooms[id]
          cleaned = true
          console.log('[GlobalSync] Cleaned up expired room:', id)
        }
      })

      if (cleaned) {
        localStorage.setItem(GLOBAL_ROOMS_KEY, JSON.stringify(rooms))
        this.announceRoomDeleted('cleanup')
      }
    } catch (error) {
      console.warn('[GlobalSync] Failed to cleanup expired rooms:', error)
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange.bind(this))
    }
    
    this.listeners = []
    this.isEnabled = false
    
    console.log('[GlobalSync] Service destroyed')
  }
}

// Export singleton instance
export const globalRoomSync = new GlobalRoomSyncService()