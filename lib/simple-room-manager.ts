import { suiContract } from "./sui-integration"

export interface SimpleRoom {
  treasuryId: string // This is the room code - the primary identifier
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

  /**
   * Create a new room by calling the blockchain contract
   * Returns the treasuryId which serves as the room code
   */
  async createRoom(creatorAddress: string, betAmount: number, signAndExecute: any): Promise<string> {
    console.log("[v0] Creating new room with treasury ID as room code")

    try {
      // Call the blockchain contract to create the room
      const result = await suiContract.createRoom(creatorAddress, betAmount, signAndExecute)
      
      console.log("[v0] Room creation transaction successful:", result)
      
      // Extract treasury object ID from transaction result
      let treasuryId = null
      
      if (result.objectChanges) {
        // Look for the treasury object in the transaction result
        const treasuryObject = result.objectChanges.find(
          (change: any) => change.type === "created" && change.objectType && 
          (change.objectType.toLowerCase().includes("treasury") || 
           change.objectType.includes("::bet::") ||
           change.objectType.includes("Treasury"))
        )
        
        // Fallback: look for any created object
        const fallbackObject = result.objectChanges.find(
          (change: any) => change.type === "created" && change.objectId
        )
        
        treasuryId = treasuryObject?.objectId || fallbackObject?.objectId
      }

      if (!treasuryId) {
        throw new Error("Failed to extract treasury ID from transaction. Unable to create room.")
      }

      console.log("[v0] Treasury ID extracted successfully:", treasuryId)

      // Create the room object using treasury ID as the key
      const room: SimpleRoom = {
        treasuryId,
        betAmount,
        creator: creatorAddress,
        players: [creatorAddress],
        currentPlayer: creatorAddress,
        board: Array(9).fill(null),
        gameState: "waiting",
        createdAt: Date.now(),
      }

      // Store the room using treasury ID as the key
      this.rooms.set(treasuryId, room)
      this.notifyListeners(treasuryId, room)

      console.log("[v0] Room created successfully with treasury ID:", treasuryId)
      return treasuryId

    } catch (error) {
      console.error("[v0] Failed to create room:", error)
      throw new Error(`Failed to create room: ${error.message || error}`)
    }
  }

  /**
   * Join a room using treasury ID as the room code
   */
  async joinRoom(treasuryId: string, playerAddress: string, betAmount: number, signAndExecute: any): Promise<SimpleRoom> {
    console.log("[v0] Joining room with treasury ID:", treasuryId)

    try {
      // First, try to get the room from local storage
      let room = this.rooms.get(treasuryId)

      // If room doesn't exist locally, try to get treasury info from blockchain
      if (!room) {
        console.log("[v0] Room not found locally, checking treasury on blockchain...")
        
        const treasuryInfo = await suiContract.getTreasuryInfo(treasuryId)
        if (!treasuryInfo) {
          throw new Error(`Treasury ${treasuryId} not found. Invalid room code.`)
        }

        // Create room from treasury info if it doesn't exist locally
        room = {
          treasuryId,
          betAmount: treasuryInfo.betAmount,
          creator: "unknown", // We don't know the creator from treasury info
          players: [], // We'll add the joining player
          currentPlayer: "",
          board: Array(9).fill(null),
          gameState: "waiting",
          createdAt: Date.now(),
        }
        
        console.log("[v0] Created room from treasury info:", treasuryInfo)
      }

      // Validate room state
      if (room.players.length >= 2) {
        throw new Error("Room is full. Cannot join a room with 2 players.")
      }

      if (room.players.includes(playerAddress)) {
        throw new Error("You are already in this room.")
      }

      // Call the blockchain contract to join the room
      const result = await suiContract.joinRoom(treasuryId, betAmount, signAndExecute)
      
      console.log("[v0] Join transaction successful:", result)

      // Add player to room
      room.players.push(playerAddress)
      
      // If we now have 2 players, start the game
      if (room.players.length === 2) {
        room.gameState = "playing"
        room.currentPlayer = room.players[0] // First player (creator) starts
        console.log("[v0] Room is full, starting game automatically")
      }

      // Update the room
      this.rooms.set(treasuryId, room)
      this.notifyListeners(treasuryId, room)

      console.log("[v0] Player joined successfully, room updated:", room)
      return room

    } catch (error) {
      console.error("[v0] Failed to join room:", error)
      throw new Error(`Failed to join room: ${error.message || error}`)
    }
  }

  /**
   * Enter an existing room (for creators who want to enter their own room)
   */
  enterRoom(treasuryId: string, playerAddress: string): SimpleRoom | null {
    const room = this.rooms.get(treasuryId)
    if (!room) {
      console.error("[v0] Room not found:", treasuryId)
      return null
    }

    if (!room.players.includes(playerAddress)) {
      console.error("[v0] Player not part of room:", playerAddress)
      return null
    }

    console.log("[v0] Player entering room:", playerAddress)
    return room
  }

  /**
   * Make a move in the game
   */
  makeMove(treasuryId: string, position: number, player: string): SimpleRoom | null {
    const room = this.rooms.get(treasuryId)
    if (!room || room.gameState !== "playing" || room.currentPlayer !== player) {
      return null
    }

    if (room.board[position] !== null) return null

    // Make the move
    room.board[position] = room.players[0] === player ? "X" : "O"
    
    // Switch current player
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

    this.rooms.set(treasuryId, room)
    this.notifyListeners(treasuryId, room)
    
    return room
  }

  /**
   * Finish the game and distribute prizes
   */
  async finishGame(treasuryId: string, winner: string | null, signAndExecute: any): Promise<void> {
    const room = this.rooms.get(treasuryId)
    if (!room) return

    console.log("[v0] Finishing game and distributing prize")

    if (winner) {
      try {
        // Execute blockchain transaction to finish the game and distribute prizes
        const result = await suiContract.finishGame(treasuryId, winner, signAndExecute)
        
        console.log("[v0] Finish game transaction successful:", result)
        room.winner = winner
        room.gameState = "finished"
        console.log("[v0] Prize distributed to winner:", winner)
      } catch (error) {
        console.error("[v0] Failed to distribute prize:", error)
      }
    }

    this.rooms.set(treasuryId, room)
    this.notifyListeners(treasuryId, room)
  }

  /**
   * Get room by treasury ID
   */
  getRoom(treasuryId: string): SimpleRoom | undefined {
    return this.rooms.get(treasuryId)
  }

  /**
   * Subscribe to room updates
   */
  subscribeToRoom(treasuryId: string, callback: (room: SimpleRoom) => void): () => void {
    if (!this.listeners.has(treasuryId)) {
      this.listeners.set(treasuryId, [])
    }
    this.listeners.get(treasuryId)!.push(callback)

    return () => {
      const callbacks = this.listeners.get(treasuryId)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) callbacks.splice(index, 1)
      }
    }
  }

  private notifyListeners(treasuryId: string, room: SimpleRoom): void {
    const callbacks = this.listeners.get(treasuryId) || []
    callbacks.forEach((callback) => callback(room))
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