import { suiContract } from "./sui-integration"

export interface SimpleRoom {
  roomId: string // This is the room ID - the Room object ID from blockchain
  betAmount: number
  creator: string
  players: string[] // Array of player addresses, max 2
  currentPlayer: string
  board: (string | null)[] // TicTacToe board state
  gameState: "waiting" | "playing" | "finished"
  winner?: string
  createdAt: number
}

class SimpleRoomManager {
  private rooms = new Map<string, SimpleRoom>()
  private listeners = new Map<string, ((room: SimpleRoom) => void)[]>()
  private readonly STORAGE_KEY = 'simple-game-rooms'

  constructor() {
    this.loadRoomsFromStorage()
  }

  private loadRoomsFromStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const roomsData = JSON.parse(stored)
        Object.entries(roomsData).forEach(([id, room]) => {
          this.rooms.set(id, room as SimpleRoom)
        })
        console.log('[SimpleRoomManager] Loaded rooms from storage:', Object.keys(roomsData).length)
      }
    } catch (error) {
      console.warn('[SimpleRoomManager] Failed to load rooms from storage:', error)
    }
  }

  private saveRoomsToStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      const roomsData: Record<string, SimpleRoom> = {}
      this.rooms.forEach((room, id) => {
        roomsData[id] = room
      })
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(roomsData))
      console.log('[SimpleRoomManager] Saved rooms to storage')
    } catch (error) {
      console.warn('[SimpleRoomManager] Failed to save rooms to storage:', error)
    }
  }

  /**
   * Create a new room by calling the blockchain contract
   * Returns the roomId which serves as the room identifier
   */
  async createRoom(creatorAddress: string, betAmount: number, signAndExecute: any): Promise<string> {
    console.log("[v0] Creating new room with Room system")

    try {
      // Call the blockchain contract to create the room
      const result = await suiContract.createRoom(creatorAddress, betAmount, signAndExecute)
      
      console.log("[v0] Room creation transaction successful:", result)
      
      // Extract room object ID from transaction result with multiple strategies
      let roomId = null
      
      console.log("[v0] Starting room ID extraction from transaction result")
      console.log("[v0] Transaction result structure:", {
        hasDigest: !!result.digest,
        hasObjectChanges: !!result.objectChanges,
        objectChangesCount: result.objectChanges?.length || 0,
        hasEffects: !!result.effects,
        status: result.effects?.status?.status || "unknown"
      })
      
      // Strategy 1: Extract from immediate transaction result object changes
      if (result.objectChanges && result.objectChanges.length > 0) {
        console.log("[v0] Strategy 1: Analyzing immediate transaction object changes")
        console.log("[v0] Object changes details:", JSON.stringify(result.objectChanges, null, 2))
        
        // Look for the Room object in the transaction result
        let roomObject = null
        
        // Sub-strategy 1a: Look for objects with Room type (exact match)
        const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID
        if (packageId) {
          const exactRoomType = `${packageId}::twoproom::Room`
          roomObject = result.objectChanges.find(
            (change: any) => change.type === "created" && 
            change.objectType === exactRoomType
          )
          if (roomObject) {
            console.log("[v0] Strategy 1a success - exact Room type match:", roomObject)
          }
        }
        
        // Sub-strategy 1b: Look for objects with Room in the type name
        if (!roomObject) {
          roomObject = result.objectChanges.find(
            (change: any) => change.type === "created" && change.objectType && 
            change.objectType.toLowerCase().includes("room")
          )
          if (roomObject) {
            console.log("[v0] Strategy 1b success - Room in type name:", roomObject)
          }
        }
        
        // Sub-strategy 1c: Look for objects from the twoproom module 
        if (!roomObject) {
          roomObject = result.objectChanges.find(
            (change: any) => change.type === "created" && change.objectType && 
            change.objectType.includes("::twoproom::")
          )
          if (roomObject) {
            console.log("[v0] Strategy 1c success - twoproom module:", roomObject)
          }
        }
        
        // Sub-strategy 1d: Look for any created object as fallback
        if (!roomObject) {
          roomObject = result.objectChanges.find(
            (change: any) => change.type === "created" && change.objectId
          )
          if (roomObject) {
            console.log("[v0] Strategy 1d (fallback) - any created object:", roomObject)
          }
        }
        
        roomId = roomObject?.objectId
        
        if (roomId) {
          console.log("[v0] Strategy 1 successful - Room ID extracted:", roomId)
        } else {
          console.warn("[v0] Strategy 1 failed - No Room object found in immediate transaction changes")
        }
      }

      // Strategy 2: Use transaction digest with enhanced extraction
      if (!roomId && result.digest) {
        console.log("[v0] Strategy 2: Using transaction digest for room extraction")
        
        try {
          roomId = await suiContract.getRoomFromTransaction(result.digest)
          
          if (roomId) {
            console.log("[v0] Strategy 2 successful - Room ID extracted from digest:", roomId)
          } else {
            console.warn("[v0] Strategy 2 failed - No room ID from transaction digest")
          }
        } catch (digestError) {
          console.error("[v0] Strategy 2 error:", digestError)
        }
      }

      // Strategy 3: Retry transaction lookup with delay (sometimes blockchain needs time)
      if (!roomId && result.digest) {
        console.log("[v0] Strategy 3: Retrying transaction lookup after delay")
        
        try {
          await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
          roomId = await suiContract.getRoomFromTransaction(result.digest)
          
          if (roomId) {
            console.log("[v0] Strategy 3 successful - Room ID extracted after retry:", roomId)
          } else {
            console.warn("[v0] Strategy 3 failed - Still no room ID after retry")
          }
        } catch (retryError) {
          console.error("[v0] Strategy 3 error:", retryError)
        }
      }

      // Final check and error reporting
      if (!roomId) {
        const errorDetails = {
          transactionDigest: result.digest || "unknown",
          transactionStatus: result.effects?.status?.status || "unknown",
          hasObjectChanges: !!result.objectChanges,
          objectChangesCount: result.objectChanges?.length || 0,
          objectChanges: result.objectChanges?.map((change: any) => ({
            type: change.type,
            objectType: change.objectType,
            objectId: change.objectId,
            sender: change.sender
          })) || [],
          hasEffects: !!result.effects,
          packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || "not configured"
        }
        
        console.error("[v0] All room extraction strategies failed!")
        console.error("[v0] Detailed error information:", JSON.stringify(errorDetails, null, 2))
        
        // Provide more specific error messages based on what we found
        let errorMessage = "Failed to extract room ID from transaction."
        
        if (!result.digest) {
          errorMessage += " No transaction digest available."
        } else if (!result.objectChanges || result.objectChanges.length === 0) {
          errorMessage += " No object changes found in transaction."
        } else if (!process.env.NEXT_PUBLIC_SUI_PACKAGE_ID) {
          errorMessage += " Smart contract package ID not configured."
        } else {
          errorMessage += " Room object not found in transaction results."
        }
        
        errorMessage += ` Transaction: ${result.digest || 'unknown'}.`
        errorMessage += " Please verify your smart contract deployment and try again."
        
        throw new Error(errorMessage)
      }

      console.log("[v0] Room ID extracted successfully:", roomId)

      // Create the room object using room ID as the key
      const room: SimpleRoom = {
        roomId,
        betAmount,
        creator: creatorAddress,
        players: [creatorAddress],
        currentPlayer: creatorAddress,
        board: Array(9).fill(null),
        gameState: "waiting",
        createdAt: Date.now(),
      }

      // Store the room using room ID as the key
      this.rooms.set(roomId, room)
      this.saveRoomsToStorage()
      this.notifyListeners(roomId, room)

      console.log("[v0] Room created successfully with room ID:", roomId)
      
      // Optional: Verify room is accessible (don't fail room creation if this fails)
      try {
        console.log("[v0] Verifying room accessibility...")
        const roomInfo = await suiContract.getRoomInfo(roomId)
        if (roomInfo) {
          console.log("[v0] Room verification successful:", roomInfo)
        } else {
          console.warn("[v0] Room verification failed - room may need time to propagate")
        }
      } catch (verificationError) {
        console.warn("[v0] Room verification failed (non-critical):", verificationError.message)
      }
      
      return roomId

    } catch (error) {
      console.error("[v0] Failed to create room:", error)
      throw new Error(`Failed to create room: ${error.message || error}`)
    }
  }

  /**
   * Join a room using room ID
   */
  async joinRoom(roomId: string, playerAddress: string, betAmount: number, signAndExecute: any): Promise<SimpleRoom> {
    console.log("[v0] Joining room with room ID:", roomId)

    try {
      // First, try to get the room from local storage
      let room = this.rooms.get(roomId)

      // If room doesn't exist locally, try to get room info from blockchain
      if (!room) {
        console.log("[v0] Room not found locally, checking room on blockchain...")
        
        const roomInfo = await suiContract.getRoomInfo(roomId)
        if (!roomInfo) {
          throw new Error(`Room ${roomId} not found. Invalid room ID.`)
        }

        // Create room from blockchain room info if it doesn't exist locally
        room = {
          roomId,
          betAmount: betAmount, // Use the joining player's bet amount
          creator: roomInfo.player1, // player1 is the creator
          players: roomInfo.player2 ? [roomInfo.player1, roomInfo.player2] : [roomInfo.player1],
          currentPlayer: roomInfo.player1,
          board: Array(9).fill(null),
          gameState: roomInfo.isFull ? "playing" : "waiting",
          createdAt: Date.now(),
        }
        
        console.log("[v0] Created room from blockchain info:", roomInfo)
      }

      // Validate room state
      if (room.players.length >= 2) {
        throw new Error("Room is full. Cannot join a room with 2 players.")
      }

      if (room.players.includes(playerAddress)) {
        // If player is already in room, ensure proper state synchronization
        console.log("[v0] Player is already in room, ensuring state sync:", playerAddress)
        
        // Update room state and force synchronization
        this.rooms.set(roomId, room)
        this.saveRoomsToStorage()
        
        // Force broadcast to ensure all clients are synchronized
        await this.broadcastRoomUpdate(roomId, room)
        
        // Notify local listeners
        this.notifyListeners(roomId, room)
        
        console.log("[v0] Player already in room, state synchronized successfully")
        return room
      }

      // Call the blockchain contract to join the room
      const result = await suiContract.joinRoom(roomId, betAmount, signAndExecute)
      
      console.log("[v0] Join transaction successful:", result)

      // Add player to room
      room.players.push(playerAddress)
      
      // If we now have 2 players, start the game
      if (room.players.length === 2) {
        room.gameState = "playing"
        room.currentPlayer = room.players[0] // First player (creator) starts
        console.log("[v0] Room is full, starting game automatically")
        
        // Update the room immediately
        this.rooms.set(roomId, room)
        this.saveRoomsToStorage()
        
        // Force broadcast the state change to ensure all clients are synchronized
        await this.broadcastRoomUpdate(roomId, room)
        
        // Notify local listeners
        this.notifyListeners(roomId, room)
        
        console.log("[v0] Game started! Room state broadcasted to all players")
      } else {
        // Update the room for single player case
        this.rooms.set(roomId, room)
        this.saveRoomsToStorage()
        
        // Broadcast state even for single player to ensure sync
        await this.broadcastRoomUpdate(roomId, room)
        this.notifyListeners(roomId, room)
      }

      console.log("[v0] Player joined successfully, room updated:", room)
      return room

    } catch (error) {
      console.error("[v0] Failed to join room:", error)
      throw new Error(`Failed to join room: ${error.message || error}`)
    }
  }

  /**
   * Enter an existing room (for creators who want to enter their own room)
   * This method handles creators accessing their own rooms without needing blockchain transactions
   * Enhanced with better state synchronization and validation
   */
  async enterRoom(roomId: string, playerAddress: string): Promise<SimpleRoom | null> {
    console.log("[v0] Attempting to enter room:", roomId, "for player:", playerAddress)
    
    // First, try to get the room from local storage
    let room = this.rooms.get(roomId)
    
    // If room doesn't exist locally, try to load from blockchain
    if (!room) {
      console.log("[v0] Room not found locally, attempting to load from blockchain")
      room = await this.getOrLoadRoom(roomId)
      
      if (!room) {
        console.error("[v0] Room not found anywhere:", roomId)
        return null
      }
    }

    // Validate that the player is part of the room
    if (!room.players.includes(playerAddress)) {
      console.error("[v0] Player not part of room:", playerAddress, "Room players:", room.players)
      return null
    }

    console.log("[v0] Player successfully entering room:", playerAddress)
    console.log("[v0] Room current state:", {
      roomId: room.roomId,
      players: room.players,
      gameState: room.gameState,
      playersCount: room.players.length
    })
    
    // Ensure room state is properly updated and synchronized
    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    
    // Force broadcast room state to ensure all clients are synchronized
    await this.broadcastRoomUpdate(roomId, room)
    
    // Notify local listeners
    this.notifyListeners(roomId, room)
    
    console.log("[v0] Room entry completed successfully, state synchronized")
    return room
  }

  /**
   * Make a move in the game
   */
  makeMove(roomId: string, position: number, player: string): SimpleRoom | null {
    const room = this.rooms.get(roomId)
    if (!room || room.gameState !== "playing" || room.currentPlayer !== player) {
      console.log(`[v0] Invalid move attempt: roomExists=${!!room}, gameState=${room?.gameState}, currentPlayer=${room?.currentPlayer}, attemptingPlayer=${player}`)
      return null
    }

    if (room.board[position] !== null) {
      console.log(`[v0] Invalid move: position ${position} already occupied by ${room.board[position]}`)
      return null
    }

    const playerSymbol = room.players[0] === player ? "X" : "O"
    console.log(`[v0] Making move: Player ${playerSymbol} at position ${position}`)

    // Make the move
    room.board[position] = playerSymbol
    
    // Switch current player
    room.currentPlayer = room.players.find((p) => p !== player) || player

    // Check for winner
    const winner = this.checkWinner(room.board)
    if (winner || room.board.every((cell) => cell !== null)) {
      room.gameState = "finished"
      if (winner) {
        const winnerAddress = winner === "X" ? room.players[0] : room.players[1]
        room.winner = winnerAddress
        console.log(`[v0] Game finished! Winner: ${winner} (${winnerAddress})`)
      } else {
        console.log(`[v0] Game finished! It's a draw.`)
      }
    } else {
      console.log(`[v0] Move completed. Next turn: ${room.currentPlayer === room.players[0] ? 'X' : 'O'} (${room.currentPlayer})`)
    }

    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    this.notifyListeners(roomId, room)
    
    return room
  }

  /**
   * Finish the game and distribute prizes
   */
  async finishGame(roomId: string, winner: string | null, signAndExecute: any): Promise<void> {
    const room = this.rooms.get(roomId)
    if (!room) return

    console.log("[v0] Finishing game and distributing prize")

    if (winner) {
      try {
        // Execute blockchain transaction to finish the game and distribute prizes
        // Note: This may need to be updated based on the actual Room contract implementation
        const result = await suiContract.finishGame(roomId, winner, signAndExecute)
        
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
    this.notifyListeners(roomId, room)
  }

  /**
   * Get room by room ID, with fallback to blockchain lookup
   */
  async getOrLoadRoom(roomId: string): Promise<SimpleRoom | null> {
    // First try local storage
    let room = this.rooms.get(roomId)
    
    if (room) {
      return room
    }
    
    // If not found locally, try to load from blockchain
    console.log("[v0] Room not found locally, attempting to load from blockchain:", roomId)
    
    try {
      const roomInfo = await suiContract.getRoomInfo(roomId)
      if (!roomInfo) {
        console.log("[v0] Room not found on blockchain:", roomId)
        return null
      }
      
      // Create room from room info
      room = {
        roomId,
        betAmount: 0.1, // Default bet amount since Room struct doesn't store this
        creator: roomInfo.player1, // player1 is the creator
        players: roomInfo.player2 ? [roomInfo.player1, roomInfo.player2] : [roomInfo.player1],
        currentPlayer: roomInfo.player1,
        board: Array(9).fill(null),
        gameState: roomInfo.isFull ? "playing" : "waiting",
        createdAt: Date.now(),
      }
      
      // Store it locally for future access
      this.rooms.set(roomId, room)
      this.saveRoomsToStorage()
      
      console.log("[v0] Room loaded from blockchain and cached locally:", room)
      return room
      
    } catch (error) {
      console.error("[v0] Failed to load room from blockchain:", error)
      return null
    }
  }

  /**
   * Get room by room ID
   */
  getRoom(roomId: string): SimpleRoom | undefined {
    return this.rooms.get(roomId)
  }

  /**
   * Subscribe to room updates
   */
  subscribeToRoom(roomId: string, callback: (room: SimpleRoom) => void): () => void {
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

  private notifyListeners(roomId: string, room: SimpleRoom): void {
    const callbacks = this.listeners.get(roomId) || []
    callbacks.forEach((callback) => callback(room))
    
    // Also broadcast via WebSocket API for real-time sync
    this.broadcastRoomUpdate(roomId, room)
  }

  /**
   * Broadcast room update via Server-Sent Events API
   * Made public to allow explicit synchronization calls
   */
  async broadcastRoomUpdate(roomId: string, roomData: SimpleRoom): Promise<void> {
    try {
      console.log('[v0] Broadcasting room update via SSE for room:', roomId)
      
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
      
      console.log('[v0] Room update successfully broadcasted via SSE:', roomId)
    } catch (error) {
      console.warn('[v0] Failed to broadcast room update via SSE:', error)
      // Don't throw error - local updates should still work
      // But log the error for debugging
      console.warn('[v0] SSE broadcast error details:', {
        roomId,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * List all available rooms from the blockchain
   * Requires a wallet address since Sui queries are address-specific
   * Enhanced with better error handling for address validation issues
   */
  async listAvailableRooms(walletAddress?: string): Promise<SimpleRoom[]> {
    if (!walletAddress) {
      console.warn("[v0] Cannot list rooms without wallet address")
      return []
    }

    // Validate wallet address format before proceeding
    if (!walletAddress.trim() || walletAddress.trim().length < 10) {
      console.warn("[v0] Invalid wallet address format provided:", walletAddress)
      return []
    }

    try {
      console.log("[v0] Fetching available rooms from blockchain for address:", walletAddress)
      
      const blockchainRooms = await suiContract.listRooms(walletAddress)
      
      if (!Array.isArray(blockchainRooms)) {
        console.warn("[v0] Invalid response from blockchain room listing:", blockchainRooms)
        return []
      }
      
      const availableRooms: SimpleRoom[] = []
      
      for (const roomInfo of blockchainRooms) {
        try {
          // Validate room info before processing
          if (!roomInfo || !roomInfo.id || !roomInfo.player1) {
            console.warn("[v0] Skipping invalid room info:", roomInfo)
            continue
          }
          
          // Convert blockchain room info to SimpleRoom format
          const room: SimpleRoom = {
            roomId: roomInfo.id,
            betAmount: 0.1, // Default bet amount since Room struct doesn't store this
            creator: roomInfo.player1,
            players: roomInfo.player2 ? [roomInfo.player1, roomInfo.player2] : [roomInfo.player1],
            currentPlayer: roomInfo.player1,
            board: Array(9).fill(null),
            gameState: roomInfo.isFull ? "playing" : "waiting",
            createdAt: Date.now(),
          }
          
          // Cache the room locally
          this.rooms.set(room.roomId, room)
          availableRooms.push(room)
          
        } catch (roomProcessingError) {
          console.warn("[v0] Failed to process room info:", roomInfo, "Error:", roomProcessingError)
          // Continue processing other rooms
        }
      }
      
      // Save to local storage
      this.saveRoomsToStorage()
      
      console.log(`[v0] Successfully processed ${availableRooms.length} available rooms`)
      return availableRooms
      
    } catch (error) {
      console.error("[v0] Failed to list available rooms:", error)
      
      // Check if it's a wallet address error and provide specific handling
      if (error.message && error.message.includes("Invalid wallet address")) {
        console.warn("[v0] Wallet address validation failed, returning empty list")
        return [] // Return empty array instead of crashing the UI
      }
      
      // Check if it's a network/connection error
      if (error.message && (error.message.includes("network") || error.message.includes("connection"))) {
        console.warn("[v0] Network error while listing rooms, returning cached rooms")
        // Return locally cached rooms as fallback
        return Array.from(this.rooms.values()).filter(room => room.gameState === "waiting")
      }
      
      // For any other errors, return locally cached rooms as fallback
      console.warn("[v0] Using locally cached rooms as fallback")
      return Array.from(this.rooms.values()).filter(room => room.gameState === "waiting")
    }
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
}

export const simpleRoomManager = new SimpleRoomManager()