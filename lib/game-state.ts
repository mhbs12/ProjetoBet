import { suiContract } from "./sui-integration"

export interface GameRoom {
  id: string
  treasuryId?: string
  betAmount: number
  players: string[]
  gameState: "waiting" | "playing" | "finished"
  board: (string | null)[]
  currentPlayer: string
  winner?: string
  transactionDigest?: string
}

class GameStateManager {
  private rooms = new Map<string, GameRoom>()
  private listeners = new Map<string, ((room: GameRoom) => void)[]>()
  private readonly STORAGE_KEY = 'game-rooms'

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
          this.rooms.set(id, room as GameRoom)
        })
      }
    } catch (error) {
      console.warn('[v0] Failed to load rooms from storage:', error)
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

  async createRoom(roomId: string, betAmount: number, creatorAddress: string, signAndExecute: any): Promise<GameRoom> {
    console.log("[v0] Creating room with modern SUI transaction")

    // Create a promise that resolves when the transaction completes
    const result = await new Promise<any>((resolve, reject) => {
      try {
        suiContract.createBettingRoom(creatorAddress, betAmount, (transactionData: any) => {
          signAndExecute(
            transactionData,
            {
              onSuccess: (result: any) => {
                console.log("[v0] Transaction successful:", result)
                
                // Extract treasury object ID from transaction result
                const treasuryObject = result.objectChanges?.find(
                  (change: any) => change.type === "created" && change.objectType.includes("Treasury"),
                )

                resolve({
                  success: true,
                  treasuryId: treasuryObject?.objectId,
                  transactionDigest: result.digest,
                })
              },
              onError: (error: any) => {
                console.error("[v0] Transaction failed:", error)
                reject(new Error(`Failed to create betting room: ${error.message || error}`))
              },
            }
          )
        })
      } catch (error) {
        reject(new Error(`Failed to create betting room: ${error.message || error}`))
      }
    })

    const room: GameRoom = {
      id: roomId,
      treasuryId: result.treasuryId,
      betAmount,
      players: [creatorAddress],
      gameState: "waiting",
      board: Array(9).fill(null),
      currentPlayer: creatorAddress,
      transactionDigest: result.transactionDigest,
    }

    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    this.notifyListeners(roomId, room)

    console.log("[v0] Room created successfully with treasury:", result.treasuryId)
    return room
  }

  async joinRoom(roomId: string, playerAddress: string, signAndExecute: any): Promise<GameRoom> {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error("Room not found")
    if (room.players.length >= 2) throw new Error("Room is full")
    if (!room.treasuryId) throw new Error("Treasury not found")

    console.log("[v0] Joining room with modern SUI transaction")

    const result = await new Promise<any>((resolve, reject) => {
      try {
        suiContract.joinBettingRoom(room.treasuryId!, room.betAmount, (transactionData: any) => {
          signAndExecute(
            transactionData,
            {
              onSuccess: (result: any) => {
                console.log("[v0] Join transaction successful:", result)
                resolve({
                  success: true,
                  transactionDigest: result.digest,
                })
              },
              onError: (error: any) => {
                console.error("[v0] Join transaction failed:", error)
                reject(new Error(`Failed to join betting room: ${error.message || error}`))
              },
            }
          )
        })
      } catch (error) {
        reject(new Error(`Failed to join betting room: ${error.message || error}`))
      }
    })

    room.players.push(playerAddress)
    room.gameState = "playing"

    this.rooms.set(roomId, room)
    this.saveRoomsToStorage()
    this.notifyListeners(roomId, room)

    console.log("[v0] Player joined successfully")
    return room
  }

  async finishGame(roomId: string, winner: string | null, signAndExecute: any): Promise<void> {
    const room = this.rooms.get(roomId)
    if (!room || !room.treasuryId) return

    console.log("[v0] Finishing game with modern prize distribution")

    if (winner) {
      try {
        const result = await new Promise<any>((resolve, reject) => {
          try {
            suiContract.finishGame(room.treasuryId!, winner, (transactionData: any) => {
              signAndExecute(
                transactionData,
                {
                  onSuccess: (result: any) => {
                    console.log("[v0] Finish game transaction successful:", result)
                    resolve({
                      success: true,
                      transactionDigest: result.digest,
                    })
                  },
                  onError: (error: any) => {
                    console.error("[v0] Finish game transaction failed:", error)
                    reject(new Error(`Failed to finish game: ${error.message || error}`))
                  },
                }
              )
            })
          } catch (error) {
            reject(new Error(`Failed to finish game: ${error.message || error}`))
          }
        })

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
}

export const gameStateManager = new GameStateManager()
