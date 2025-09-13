"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Player, GameState } from "@/types/game"
import { getWinningLine } from "@/lib/game-logic"
import { cn } from "@/lib/utils"

interface GameBoardProps {
  gameState: GameState
  onMove: (position: number) => void
  playerSymbol: Player
  disabled?: boolean
}

export function GameBoard({ gameState, onMove, playerSymbol, disabled = false }: GameBoardProps) {
  const winningLine = getWinningLine(gameState.board)

  const handleCellClick = (position: number) => {
    if (disabled || gameState.gameOver || gameState.board[position] || gameState.currentPlayer !== playerSymbol) {
      return
    }
    onMove(position)
  }

  const getCellClassName = (index: number) => {
    const isWinningCell = winningLine?.includes(index)
    const hasValue = gameState.board[index]

    return cn(
      "w-20 h-20 border-2 border-border rounded-lg flex items-center justify-center text-2xl font-bold cursor-pointer transition-all duration-200 hover:bg-muted/50",
      {
        "bg-accent/20 pulse-glow": isWinningCell,
        "hover:scale-105": !hasValue && !gameState.gameOver && gameState.currentPlayer === playerSymbol && !disabled,
        "cursor-not-allowed opacity-50": disabled || gameState.gameOver || gameState.currentPlayer !== playerSymbol,
        "text-primary": gameState.board[index] === "X",
        "text-accent": gameState.board[index] === "O",
      },
    )
  }

  const getStatusMessage = () => {
    if (gameState.winner === "draw") {
      return "It's a draw!"
    }
    if (gameState.winner) {
      return gameState.winner === playerSymbol ? "You won!" : "You lost!"
    }
    if (gameState.currentPlayer === playerSymbol) {
      return "Your turn"
    }
    return "Opponent's turn"
  }

  const getStatusBadgeVariant = () => {
    if (gameState.winner === playerSymbol) return "default"
    if (gameState.winner && gameState.winner !== playerSymbol) return "destructive"
    if (gameState.winner === "draw") return "secondary"
    return gameState.currentPlayer === playerSymbol ? "default" : "outline"
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-between">
          <span>TicTacToe</span>
          <Badge variant={getStatusBadgeVariant()}>{getStatusMessage()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-3 gap-2 mb-6">
          {gameState.board.map((cell, index) => (
            <button
              key={index}
              className={getCellClassName(index)}
              onClick={() => handleCellClick(index)}
              disabled={disabled || gameState.gameOver || !!cell || gameState.currentPlayer !== playerSymbol}
            >
              {cell}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>
            You are: <strong className={playerSymbol === "X" ? "text-primary" : "text-accent"}>{playerSymbol}</strong>
          </span>
          <span>Moves: {gameState.moves}</span>
        </div>
      </CardContent>
    </Card>
  )
}
