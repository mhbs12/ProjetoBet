import { suiContract } from "./sui-integration"
import { globalRoomSync, type RoomSyncEvent } from "./global-room-sync"

export interface GameRoom {
  id: string
  name: string
  treasuryId?: string
  betAmount: number
  players: string[]
  playersPresent: string[]  // Track which players are actively present
  gameState: "waiting" | "playing" | "finished"
  board: (string | null)[]
  currentPlayer: string
  winner?: string
  transactionDigest?: string
  createdAt: number
}

// Global room storage that persists across browser sessions
const GLOBAL_ROOMS_STORAGE_KEY = 'global-game-rooms'
const LEGACY_SHARED_ROOMS_STORAGE_KEY = 'shared-game-rooms'

class GameStateManager {
  private rooms = new Map<string, GameRoom>()
  private listeners = new Map<string, ((room: GameRoom) => void)[]>()
  private readonly STORAGE_KEY = 'game-rooms'
  private globalSyncUnsubscribe?: () => void

  constructor() {
    this.loadRoomsFromStorage()
    this.loadGlobalRooms()
    this.migrateLegacySharedRooms()
    this.initializeGlobalSync()
  }

  private initializeGlobalSync() {
    // Subscribe to global room synchronization events
    this.globalSyncUnsubscribe = globalRoomSync.addListener((event: RoomSyncEvent) => {
      this.handleGlobalSyncEvent(event)
    })
    
    // Start cleanup of expired rooms
    this.setupCleanupInterval()
    
    console.log('[GameState] Global synchronization initialized')
  }

  private handleGlobalSyncEvent(event: RoomSyncEvent) {
    console.log('[GameState] Received global sync event:', event.type, event.roomId)
    
    switch (event.type) {
      case 'room_created':
      case 'room_updated':
      case 'room_joined':
        if (event.room && !this.rooms.has(event.room.id)) {
          // Add room from other session if it doesn't exist locally
          this.rooms.set(event.room.id, event.room)
          console.log('[GameState] Added room from global sync:', event.room.id)
        } else if (event.room && this.rooms.has(event.room.id)) {
          // Update existing room with latest data
          const existingRoom = this.rooms.get(event.room.id)!
          if (event.room.createdAt >= existingRoom.createdAt) {
            this.rooms.set(event.room.id, event.room)
            this.notifyListeners(event.room.id, event.room)
            console.log('[GameState] Updated room from global sync:', event.room.id)
          }
        }
        break
      
      case 'room_deleted':
        if (event.roomId && this.rooms.has(event.roomId)) {
          this.rooms.delete(event.roomId)
          console.log('[GameState] Removed room from global sync:', event.roomId)
        }
        break
      
      case 'rooms_requested':
        // Respond by syncing our available rooms to global storage
        this.syncLocalRoomsToGlobal()
        break
    }
  }

  private syncLocalRoomsToGlobal() {
    // Sync all available rooms to global storage
    this.rooms.forEach((room) => {
      if (room.gameState === 'waiting' || (Date.now() - room.createdAt) < 600000) {
        globalRoomSync.saveRoomToGlobal(room)
      }
    })
  }

  private setupCleanupInterval() {
    // Clean up expired rooms every 5 minutes
    setInterval(() => {
      this.cleanupExpiredRooms()
      globalRoomSync.cleanupExpiredRooms()
    }, 300000)
  }

  // Allow access to rooms map for testing
  get roomsMap() {
    return this.rooms
  }

  private loadRoomsFromStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const roomsData = JSON.parse(stored)
        Object.entries(roomsData).forEach(([id, room]) => {
          this.rooms.set(id, room as GameRoom)
        })
      }
    } catch (error) {
      console.warn('[v0] Failed to load rooms from storage:', error)
    }
  }

  private loadSharedRooms(): void {
    if (typeof window === 'undefined') return
    
    try {
      const sharedRooms = localStorage.getItem(LEGACY_SHARED_ROOMS_STORAGE_KEY)
      if (sharedRooms) {
        const roomsData = JSON.parse(sharedRooms)
        Object.entries(roomsData).forEach(([id, room]) => {
          // Only add room if it doesn't exist locally to avoid conflicts
          if (!this.rooms.has(id)) {
            this.rooms.set(id, room as GameRoom)
          }
        })
        console.log('[v0] Loaded legacy shared rooms:', Object.keys(roomsData).length)
      }
    } catch (error) {
      console.warn('[v0] Failed to load legacy shared rooms from storage:', error)
    }
  }

  private loadGlobalRooms(): void {
    if (typeof window === 'undefined') return
    
    try {
      // Load from the global sync service
      const globalRooms = globalRoomSync.getGlobalRooms()
      
      Object.entries(globalRooms).forEach(([id, room]) => {
        // Only load rooms that are still relevant (waiting for players or recently created)
        const isRelevant = room.gameState === 'waiting' || 
                         (Date.now() - room.createdAt) < 300000 // 5 minutes
        
        if (isRelevant && !this.rooms.has(id)) {
          this.rooms.set(id, room)
        }
      })
      
      console.log('[GameState] Loaded global rooms:', Object.keys(globalRooms).length)
      
      // Also load from legacy storage for backward compatibility
      const legacyGlobalRooms = localStorage.getItem(GLOBAL_ROOMS_STORAGE_KEY)
      if (legacyGlobalRooms) {
        const roomsData = JSON.parse(legacyGlobalRooms)
        Object.entries(roomsData).forEach(([id, room]) => {
          const roomData = room as GameRoom
          const isRelevant = roomData.gameState === 'waiting' || 
                           (Date.now() - roomData.createdAt) < 300000 // 5 minutes
          
          if (isRelevant && !this.rooms.has(id)) {
            this.rooms.set(id, roomData)
            // Migrate to new global sync service
            globalRoomSync.saveRoomToGlobal(roomData)
          }
        })
      }
    } catch (error) {
      console.warn('[GameState] Failed to load global rooms from storage:', error)
    }
  }

  private migrateLegacySharedRooms(): void {
    if (typeof window === 'undefined') return
    
    try {
      const legacySharedRooms = localStorage.getItem(LEGACY_SHARED_ROOMS_STORAGE_KEY)
      if (legacySharedRooms) {
        const roomsData = JSON.parse(legacySharedRooms)
        
        // Migrate to global storage
        const globalRooms = localStorage.getItem(GLOBAL_ROOMS_STORAGE_KEY)
        const globalRoomsData = globalRooms ? JSON.parse(globalRooms) : {}
        
        Object.entries(roomsData).forEach(([id, room]) => {
          if (!globalRoomsData[id]) {
            globalRoomsData[id] = room
          }
        })
        
        localStorage.setItem(GLOBAL_ROOMS_STORAGE_KEY, JSON.stringify(globalRoomsData))
        
        // Clear legacy storage after migration
        localStorage.removeItem(LEGACY_SHARED_ROOMS_STORAGE_KEY)
        console.log('[v0] Migrated legacy shared rooms to global storage')
      }
    } catch (error) {
      console.warn('[v0] Failed to migrate legacy shared rooms:', error)
    }
  }

  private saveRoomsToStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      const roomsData: Record<string, GameRoom> = {}
      this.rooms.forEach((room, id) => {
        roomsData[id] = room
      })
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(roomsData))
    } catch (error) {
      console.warn('[v0] Failed to save rooms to storage:', error)
    }
  }

  private saveToSharedStorage(room: GameRoom): void {
    if (typeof window === 'undefined') return
    
    try {
      // Save to the new global sync service
      globalRoomSync.saveRoomToGlobal(room)
      
      // Also maintain legacy storage for backward compatibility
      const globalRooms = localStorage.getItem(GLOBAL_ROOMS_STORAGE_KEY)
      const roomsData = globalRooms ? JSON.parse(globalRooms) : {}
      
      // Save all rooms that are waiting or recently created to global storage
      if (room.gameState === 'waiting' || (Date.now() - room.createdAt) < 600000) { // 10 minutes
        roomsData[room.id] = room
        localStorage.setItem(GLOBAL_ROOMS_STORAGE_KEY, JSON.stringify(roomsData))
        console.log('[GameState] Saved room to global storage:', room.id)
      }
    } catch (error) {
      console.warn('[GameState] Failed to save room to global storage:', error)
    }
  }

  private removeFromSharedStorage(roomId: string): void {
    if (typeof window === 'undefined') return
    
    try {
      // Remove from global sync service
      globalRoomSync.removeRoomFromGlobal(roomId)
      
      // Also remove from legacy storage
      const globalRooms = localStorage.getItem(GLOBAL_ROOMS_STORAGE_KEY)
      if (globalRooms) {
        const roomsData = JSON.parse(globalRooms)
        delete roomsData[roomId]
        localStorage.setItem(GLOBAL_ROOMS_STORAGE_KEY, JSON.stringify(roomsData))
        console.log('[GameState] Removed room from global storage:', roomId)
      }
    } catch (error) {
      console.warn('[GameState] Failed to remove room from global storage:', error)
    }
  }

  private cleanupExpiredRooms(): void {
    if (typeof window === 'undefined') return
    
    try {
      const globalRooms = localStorage.getItem(GLOBAL_ROOMS_STORAGE_KEY)
      if (globalRooms) {
        const roomsData = JSON.parse(globalRooms)
        const now = Date.now()
        let cleaned = false
        
        Object.entries(roomsData).forEach(([id, room]) => {
          const roomData = room as GameRoom
          // Remove rooms older than 1 hour or finished games older than 10 minutes
          const maxAge = roomData.gameState === 'finished' ? 600000 : 3600000
          if (now - roomData.createdAt > maxAge) {
            delete roomsData[id]
            cleaned = true
            console.log('[v0] Cleaned up expired room:', id)
          }
        })
        
        if (cleaned) {
          localStorage.setItem(GLOBAL_ROOMS_STORAGE_KEY, JSON.stringify(roomsData))
          console.log('[v0] Completed room cleanup')
        }
      }
    } catch (error) {
      console.warn('[v0] Failed to cleanup expired rooms:', error)
    }
  }

  async createRoom(roomId: string, roomName: string, betAmount: number, creatorAddress: string, signAndExecute: any): Promise<GameRoom> {
    console.log("[v0] Creating room with modern SUI transaction")

    try {
      // Call the SUI contract to create betting room and get the transaction result
      const result = await suiContract.createBettingRoom(creatorAddress, betAmount, signAndExecute)
      
      console.log("[v0] Transaction successful:", result)
      
      // Extract treasury object ID from transaction result
      // Try multiple approaches to find the treasury object
      let treasuryObject = null
      
      if (result.objectChanges) {
        // First try: look for Treasury type (case insensitive)
        treasuryObject = result.objectChanges.find(
          (change: any) => change.type === "created" && change.objectType && 
          (change.objectType.toLowerCase().includes("treasury") || 
           change.objectType.includes("::bet::") ||
           change.objectType.includes("Treasury"))
        )
        
        // Second try: look for objects created by the bet module
        if (!treasuryObject) {
          treasuryObject = result.objectChanges.find(
            (change: any) => change.type === "created" && change.objectType &&
            change.objectType.includes("::bet::")
          )
        }
        
        // Third try: look for any created object that might be the treasury
        if (!treasuryObject) {
          treasuryObject = result.objectChanges.find(
            (change: any) => change.type === "created" && change.objectId
          )
        }
      }
      
      // Log detailed transaction result for debugging
      console.log("[v0] Transaction result details:")
      console.log("- digest:", result.digest)
      console.log("- objectChanges:", JSON.stringify(result.objectChanges, null, 2))
      console.log("- extracted treasuryObject:", treasuryObject)

      const room: GameRoom = {
        id: roomId,
        name: roomName,
        treasuryId: treasuryObject?.objectId,
        betAmount,
        players: [creatorAddress],
        playersPresent: [creatorAddress], // Creator is present when creating the room
        gameState: "waiting",
        board: Array(9).fill(null),
        currentPlayer: creatorAddress,
        transactionDigest: result.digest,
        createdAt: Date.now(),
      }

      this.rooms.set(roomId, room)
      this.saveRoomsToStorage()
      this.saveToSharedStorage(room) // Save to global storage for cross-browser/wallet visibility
      this.notifyListeners(roomId, room)

      // Announce room creation to all connected sessions
      globalRoomSync.announceRoomCreated(room)

      if (!treasuryObject?.objectId) {
        console.warn("[v0] Warning: Treasury object ID not found in transaction result. Room created but may have issues with betting.")
        console.warn("[v0] This could be due to smart contract returning different object types than expected.")
        console.warn("[v0] Room will be created but treasury functionality may be limited.")
        console.warn("[v0] Available object changes:", JSON.stringify(result.objectChanges, null, 2))
        
        // For development/testing, we'll still create the room but warn users
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn("[v0] Development mode: Room created without Treasury ID - this will limit betting functionality")
        }
      }

      console.log("[v0] Room created successfully with treasury:", treasuryObject?.objectId)
      console.log("[v0] Room saved to global storage for cross-browser visibility")
      return room
    } catch (error) {
      console.error("[v0] Failed to create room:", error)
      throw new Error(`Failed to create betting room: ${error.message || error}`)
    }
  }

  enterRoom(roomId: string, playerAddress: string): GameRoom | null {
    const room = this.rooms.get(roomId)
    if (!room) {
      console.error("[v0] Room not found for entering:", roomId)
      return null
    }

    // Check if player is part of this room
    if (!room.players.includes(playerAddress)) {
      console.error("[v0] Player not part of room:", playerAddress)
      return null
    }

    // Mark player as present if not already
    if (!room.playersPresent.includes(playerAddress)) {
      room.playersPresent.push(playerAddress)
      console.log("[v0] Player marked as present:", playerAddress)
    }

    // Check if we can start the game (both players present)
    if (room.players.length === 2 && room.playersPresent.length === 2 && room.gameState === "waiting") {
      room.gameState = "playing"
      console.log("[v0] Both players now present, starting game")
    }

    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    this.notifyListeners(roomId, room)

    // Announce presence update to other sessions
    globalRoomSync.announceRoomUpdated(room)
    
    return room
  }

  async joinRoom(roomId: string, playerAddress: string, signAndExecute: any, treasuryId?: string, betAmount?: number): Promise<GameRoom> {
    let room = this.rooms.get(roomId)
    
    console.log(`[v0] Attempting to join room ${roomId}, local room exists: ${!!room}, treasury provided: ${!!treasuryId}`)
    
    // If room doesn't exist locally, try to load from global storage first
    if (!room) {
      console.log("[v0] Room not found locally, checking global storage...")
      this.loadGlobalRooms()
      room = this.rooms.get(roomId)
      if (room) {
        console.log("[v0] Room found in global storage!")
      }
    }
    
    // If room doesn't exist locally but we have a treasury ID, get info from blockchain
    if (!room && treasuryId) {
      console.log("[v0] Room not found locally, attempting to retrieve from blockchain treasury:", treasuryId)
      try {
        const treasuryInfo = await suiContract.getTreasuryInfo(treasuryId)
        if (treasuryInfo) {
          // Create room from treasury info since it doesn't exist locally
          room = {
            id: roomId,
            name: `Room ${roomId}`, // Default name when retrieved from treasury
            treasuryId: treasuryId,
            betAmount: treasuryInfo.betAmount,
            players: [], // We don't know the first player address without additional blockchain query
            playersPresent: [], // No players present initially when retrieved from treasury
            gameState: "waiting",
            board: Array(9).fill(null),
            currentPlayer: "", // This will be set when game starts
            createdAt: Date.now(),
          }
          console.log("[v0] Successfully created room from treasury info:", treasuryInfo)
        } else {
          throw new Error(`Treasury ${treasuryId} not found or is invalid`)
        }
      } catch (error) {
        console.error("[v0] Failed to get treasury info:", error)
        throw new Error(`Failed to retrieve room information: ${error.message}`)
      }
    }
    
    // If room exists locally but has no treasury info, try to use provided treasury ID
    if (room && !room.treasuryId && treasuryId) {
      console.log("[v0] Room exists locally but missing treasury info, validating provided treasury:", treasuryId)
      try {
        const treasuryInfo = await suiContract.getTreasuryInfo(treasuryId)
        if (treasuryInfo) {
          room.treasuryId = treasuryId
          room.betAmount = treasuryInfo.betAmount
          console.log("[v0] Updated room with treasury info:", treasuryInfo)
        } else {
          throw new Error(`Treasury ${treasuryId} not found or is invalid`)
        }
      } catch (error) {
        console.error("[v0] Failed to validate treasury info:", error)
        throw new Error(`Failed to validate treasury information: ${error.message}`)
      }
    }
    
    // Validate room exists
    if (!room) {
      const message = treasuryId 
        ? `Room ${roomId} not found. The treasury ID may be invalid or the room may not exist.`
        : `Room ${roomId} not found. Please check the room ID or provide a valid share link with treasury information.`
      console.error("[v0] Room validation failed:", message)
      throw new Error(message)
    }
    
    // Validate room capacity
    if (room.players.length >= 2) {
      throw new Error(`Room ${roomId} is already full. Cannot join room with 2 players.`)
    }
    
    // Validate player not already in room
    if (room.players.includes(playerAddress)) {
      throw new Error(`You are already in room ${roomId}.`)
    }
    
    const effectiveTreasuryId = treasuryId || room.treasuryId
    
    // If no treasury ID is available, try to retrieve it from the transaction digest
    if (!effectiveTreasuryId && room?.transactionDigest) {
      console.log("[v0] Treasury ID missing, attempting to retrieve from transaction digest:", room.transactionDigest)
      try {
        const retrievedTreasuryId = await suiContract.getTreasuryFromTransaction(room.transactionDigest)
        if (retrievedTreasuryId) {
          console.log("[v0] Successfully retrieved treasury ID from transaction:", retrievedTreasuryId)
          room.treasuryId = retrievedTreasuryId
          this.rooms.set(roomId, room)
          this.saveRoomsToStorage()
          return this.joinRoom(roomId, playerAddress, signAndExecute, retrievedTreasuryId)
        }
      } catch (error) {
        console.error("[v0] Failed to retrieve treasury ID from transaction:", error)
      }
    }
    
    // Final check for treasury ID
    const finalTreasuryId = treasuryId || room.treasuryId
    if (!finalTreasuryId) {
      console.error("[v0] Missing treasury information for room:", {
        roomId: roomId,
        localRoom: !!room,
        providedTreasuryId: !!treasuryId,
        roomTreasuryId: room?.treasuryId,
        roomCreatedAt: room?.createdAt,
        roomTransactionDigest: room?.transactionDigest
      })
      
      if (room?.transactionDigest) {
        throw new Error(`Room ${roomId} was created but treasury information is missing. Transaction digest: ${room.transactionDigest}. Please use the share link provided by the room creator or contact them for the treasury ID.`)
      }
      
      throw new Error(`Room ${roomId} is missing treasury information. Cannot process bet. Please use the share link provided by the room creator.`)
    }

    console.log("[v0] Joining room with modern SUI transaction, treasury:", finalTreasuryId)

    try {
      // Use the user-specified bet amount, or fall back to room's bet amount
      const finalBetAmount = betAmount || room.betAmount
      
      // Execute blockchain transaction to join the betting room
      const result = await suiContract.joinBettingRoom(finalTreasuryId!, finalBetAmount, signAndExecute)
      
      console.log("[v0] Join transaction successful:", result)

      // Update the room with the treasury ID if it wasn't set before
      if (!room.treasuryId && finalTreasuryId) {
        room.treasuryId = finalTreasuryId
      }

      // Add player to room
      room.players.push(playerAddress)
      room.playersPresent.push(playerAddress) // Mark joining player as present
      
      // If room has 2 players, automatically mark both as present and start the game
      if (room.players.length === 2) {
        const creatorAddress = room.players[0]
        if (!room.playersPresent.includes(creatorAddress)) {
          room.playersPresent.push(creatorAddress)
          console.log("[v0] Auto-marked creator as present when second player joined")
        }
        
        // Start the game immediately when both players are in the room
        room.gameState = "playing"
        console.log("[v0] Both players in room, game started automatically")
      }
      
      // Set the first player as current player if none was set
      if (!room.currentPlayer && room.players.length > 0) {
        room.currentPlayer = room.players[0]
      }

      // Update local storage and notify listeners
      this.rooms.set(roomId, room)
      this.saveRoomsToStorage()
      
      // Remove from shared storage since the room is now playing (not available)
      this.removeFromSharedStorage(roomId)
      this.notifyListeners(roomId, room)

      // Announce successful room join to all sessions
      globalRoomSync.announceRoomJoined(room)

      console.log("[v0] Player joined successfully, room updated:", room)
      return room
    } catch (error) {
      console.error("[v0] Failed to join room:", error)
      throw new Error(`Failed to join betting room: ${error.message || error}`)
    }
  }

  async finishGame(roomId: string, winner: string | null, signAndExecute: any): Promise<void> {
    const room = this.rooms.get(roomId)
    if (!room || !room.treasuryId) return

    console.log("[v0] Finishing game with modern prize distribution")

    if (winner) {
      try {
        // Execute blockchain transaction to finish the game and distribute prizes
        const result = await suiContract.finishGame(room.treasuryId!, winner, signAndExecute)
        
        console.log("[v0] Finish game transaction successful:", result)
        room.winner = winner
        room.gameState = "finished"
        console.log("[v0] Prize distributed to winner:", winner)
      } catch (error) {
        console.error("[v0] Failed to distribute prize:", error)
      }
    }

    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    this.removeFromSharedStorage(roomId) // Remove finished game from shared storage
    this.notifyListeners(roomId, room)

    // Announce game completion to all sessions
    globalRoomSync.announceRoomUpdated(room)
  }

  makeMove(roomId: string, position: number, player: string): GameRoom | null {
    const room = this.rooms.get(roomId)
    if (!room || room.gameState !== "playing" || room.currentPlayer !== player) {
      return null
    }

    if (room.board[position] !== null) return null

    room.board[position] = room.players[0] === player ? "X" : "O"
    room.currentPlayer = room.players.find((p) => p !== player) || player

    // Check for winner
    const winner = this.checkWinner(room.board)
    if (winner || room.board.every((cell) => cell !== null)) {
      room.gameState = "finished"
      if (winner) {
        const winnerAddress = winner === "X" ? room.players[0] : room.players[1]
        room.winner = winnerAddress
      }
    }

    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    this.notifyListeners(roomId, room)

    // Announce move to all sessions
    globalRoomSync.announceRoomUpdated(room)
    
    return room
  }

  private checkWinner(board: (string | null)[]): string | null {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // columns
      [0, 4, 8],
      [2, 4, 6], // diagonals
    ]

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]
      }
    }
    return null
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId)
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values())
  }

  getAvailableRooms(): GameRoom[] {
    // Refresh global rooms and cleanup expired ones
    this.loadGlobalRooms()
    this.cleanupExpiredRooms()
    
    return Array.from(this.rooms.values()).filter(room => room.gameState === "waiting")
  }

  searchRooms(query: string): GameRoom[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.rooms.values()).filter(room => 
      room.name.toLowerCase().includes(lowerQuery) || 
      room.id.toLowerCase().includes(lowerQuery)
    )
  }

  getRoomsByWallet(walletAddress: string): GameRoom[] {
    return Array.from(this.rooms.values()).filter(room => 
      room.players.includes(walletAddress)
    )
  }

  getRoomsCreatedByWallet(walletAddress: string): GameRoom[] {
    return Array.from(this.rooms.values()).filter(room => 
      room.players.length > 0 && room.players[0] === walletAddress
    )
  }

  subscribeToRoom(roomId: string, callback: (room: GameRoom) => void): () => void {
    if (!this.listeners.has(roomId)) {
      this.listeners.set(roomId, [])
    }
    this.listeners.get(roomId)!.push(callback)

    return () => {
      const callbacks = this.listeners.get(roomId)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) callbacks.splice(index, 1)
      }
    }
  }

  private notifyListeners(roomId: string, room: GameRoom): void {
    const callbacks = this.listeners.get(roomId) || []
    callbacks.forEach((callback) => callback(room))
  }

  // Helper method to create a shareable room URL with treasury ID
  generateRoomShareUrl(roomId: string, treasuryId: string, baseUrl?: string): string {
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    return `${base}/game/${roomId}?treasury=${treasuryId}`
  }

  // Helper method to extract treasury ID from URL parameters
  extractTreasuryFromUrl(): string | null {
    if (typeof window === 'undefined') return null
    
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('treasury')
  }

  // Helper method to add mock rooms for testing (includes global storage)
  addMockRoom(room: GameRoom): void {
    // Ensure playersPresent is initialized for mock rooms
    if (!room.playersPresent) {
      room.playersPresent = [...room.players] // For mock rooms, assume all players are present
    }
    this.rooms.set(room.id, room)
    this.saveToSharedStorage(room)
  }

  // Method to refresh rooms from global storage (useful for polling for new rooms)
  refreshRoomsFromGlobalStorage(): void {
    this.loadGlobalRooms()
    
    // Also trigger a rooms request to get updates from other sessions
    globalRoomSync.broadcastEvent({
      type: 'rooms_requested',
      timestamp: Date.now(),
      senderId: 'refresh-request'
    })
  }

  // Method to get the current number of available rooms
  getAvailableRoomsCount(): number {
    return this.getAvailableRooms().length
  }

  // Method to check if a specific room exists in global storage
  async checkRoomExistsGlobally(roomId: string): Promise<boolean> {
    if (typeof window === 'undefined') return false
    
    try {
      const globalRooms = globalRoomSync.getGlobalRooms()
      return globalRooms.hasOwnProperty(roomId)
    } catch (error) {
      console.warn('[GameState] Failed to check room in global storage:', error)
    }
    return false
  }

  // Cleanup method to destroy global sync
  destroy() {
    if (this.globalSyncUnsubscribe) {
      this.globalSyncUnsubscribe()
    }
    globalRoomSync.destroy()
  }
}

export const gameStateManager = new GameStateManager()
