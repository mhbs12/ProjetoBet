import type { GameState, Player } from "@/types/game"

export function createInitialGameState(): GameState {
  return {
    board: Array(9).fill(null),
    currentPlayer: "X",
    winner: null,
    gameOver: false,
    moves: 0,
  }
}

export function makeMove(gameState: GameState, position: number): GameState {
  if (gameState.board[position] || gameState.gameOver) {
    return gameState
  }

  const newBoard = [...gameState.board]
  newBoard[position] = gameState.currentPlayer

  const winner = checkWinner(newBoard)
  const isDraw = !winner && newBoard.every((cell) => cell !== null)

  return {
    ...gameState,
    board: newBoard,
    currentPlayer: gameState.currentPlayer === "X" ? "O" : "X",
    winner: winner || (isDraw ? "draw" : null),
    gameOver: winner !== null || isDraw,
    moves: gameState.moves + 1,
  }
}

export function checkWinner(board: Player[]): Player | null {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // columns
    [0, 4, 8],
    [2, 4, 6], // diagonals
  ]

  for (const [a, b, c] of winningCombinations) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }

  return null
}

export function getWinningLine(board: Player[]): number[] | null {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // columns
    [0, 4, 8],
    [2, 4, 6], // diagonals
  ]

  for (const combination of winningCombinations) {
    const [a, b, c] = combination
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combination
    }
  }

  return null
}

export function generateGameHash(board: Player[], moves: number, roomId: string): string {
  const gameData = {
    board,
    moves,
    roomId,
    timestamp: Date.now(),
  }

  // Simple hash function for demo - in production use crypto.subtle
  const str = JSON.stringify(gameData)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}
