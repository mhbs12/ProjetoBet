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
      
      // Extract room object ID from transaction result
      let roomId = null
      
      if (result.objectChanges) {
        console.log("[v0] Analyzing transaction object changes:", JSON.stringify(result.objectChanges, null, 2))
        
        // Look for the Room object in the transaction result
        let roomObject = null
        
        // Strategy 1: Look for objects with Room type
        roomObject = result.objectChanges.find(
          (change: any) => change.type === "created" && change.objectType && 
          change.objectType.includes("Room")
        )
        
        // Strategy 2: Look for objects from the twoproom module 
        if (!roomObject) {
          roomObject = result.objectChanges.find(
            (change: any) => change.type === "created" && change.objectType && 
            change.objectType.includes("::twoproom::")
          )
        }
        
        // Strategy 3: Look for any shared object (Room is shared via transfer::share_object)
        if (!roomObject) {
          roomObject = result.objectChanges.find(
            (change: any) => change.type === "created" && change.objectId
          )
        }
        
        roomId = roomObject?.objectId
        
        if (roomId) {
          console.log("[v0] Room ID extracted successfully, object details:", roomObject)
        } else {
          console.error("[v0] Failed to find Room object in transaction changes")
        }
      }

      // Additional fallback: try to get room from transaction digest if objectChanges failed
      if (!roomId && result.digest) {
        console.log("[v0] Attempting to extract room ID from transaction digest:", result.digest)
        roomId = await suiContract.getRoomFromTransaction(result.digest)
        
        if (roomId) {
          console.log("[v0] Room ID extracted from transaction digest:", roomId)
        }
      }

      if (!roomId) {
        const errorDetails = {
          transactionDigest: result.digest || "unknown",
          hasObjectChanges: !!result.objectChanges,
          objectChangesCount: result.objectChanges?.length || 0,
          objectChanges: result.objectChanges || [],
        }
        
        console.error("[v0] All room extraction strategies failed. Error details:", JSON.stringify(errorDetails, null, 2))
        
        throw new Error(`Failed to extract room ID from transaction. Please try again. Transaction: ${result.digest || 'unknown'}`)
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
        // If player is already in room, just return the room (useful for creators re-entering)
        console.log("[v0] Player is already in room, returning existing room:", playerAddress)
        
        // Update room state and notify listeners to ensure sync
        this.rooms.set(roomId, room)
        this.saveRoomsToStorage()
        this.notifyListeners(roomId, room)
        
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
        
        // Update the room immediately and broadcast the state change
        this.rooms.set(roomId, room)
        this.saveRoomsToStorage()
        this.notifyListeners(roomId, room)
        
        console.log("[v0] Game started! Broadcasting room state to all players")
      } else {
        // Update the room for single player case
        this.rooms.set(roomId, room)
        this.saveRoomsToStorage()
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
   */
  enterRoom(roomId: string, playerAddress: string): SimpleRoom | null {
    const room = this.rooms.get(roomId)
    if (!room) {
      console.error("[v0] Room not found:", roomId)
      return null
    }

    if (!room.players.includes(playerAddress)) {
      console.error("[v0] Player not part of room:", playerAddress)
      return null
    }

    console.log("[v0] Player entering room:", playerAddress)
    
    // Update room state and notify listeners to ensure real-time updates
    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    this.notifyListeners(roomId, room)
    
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
   */
  private async broadcastRoomUpdate(roomId: string, roomData: SimpleRoom): Promise<void> {
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
      console.log('[v0] Room update broadcasted via SSE:', roomId)
    } catch (error) {
      console.warn('[v0] Failed to broadcast room update via SSE:', error)
      // Don't throw error - local updates should still work
    }
  }

  /**
   * List all available rooms from the blockchain
   * Requires a wallet address since Sui queries are address-specific
   */
  async listAvailableRooms(walletAddress?: string): Promise<SimpleRoom[]> {
    if (!walletAddress) {
      console.warn("[v0] Cannot list rooms without wallet address")
      return []
    }

    try {
      console.log("[v0] Fetching available rooms from blockchain for address:", walletAddress)
      
      const blockchainRooms = await suiContract.listRooms(walletAddress)
      const availableRooms: SimpleRoom[] = []
      
      for (const roomInfo of blockchainRooms) {
        // Convert blockchain room info to SimpleRoom format
        const room: SimpleRoom = {
          roomId: roomInfo.id!,
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
      }
      
      // Save to local storage
      this.saveRoomsToStorage()
      
      console.log(`[v0] Found ${availableRooms.length} available rooms`)
      return availableRooms
      
    } catch (error) {
      console.error("[v0] Failed to list available rooms:", error)
      
      // Check if it's a wallet address error
      if (error.message && error.message.includes("Invalid wallet address")) {
        throw error // Re-throw wallet-specific errors
      }
      
      // Return locally cached rooms as fallback
      return Array.from(this.rooms.values())
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