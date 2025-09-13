export type Player = "X" | "O" | null

export interface GameState {
  board: Player[]
  currentPlayer: Player
  winner: Player | "draw" | null
  gameOver: boolean
  moves: number
}

export interface Room {
  id: string
  name: string
  betAmount: number
  players: {
    X?: {
      address: string
      name: string
      ready: boolean
      present: boolean
    }
    O?: {
      address: string
      name: string
      ready: boolean
      present: boolean
    }
  }
  gameState: GameState
  status: "waiting" | "playing" | "finished"
  createdAt: Date
  totalPrize: number
  gameHash?: string
  winnerProof?: {
    merkleRoot: string
    proof: string[]
    signature: string
  }
}

export interface WalletState {
  connected: boolean
  address: string | null
  balance: number
  connecting: boolean
}

export interface BettingInfo {
  roomId: string
  betAmount: number
  totalPrize: number
  escrowAddress?: string
  transactionHash?: string
}
