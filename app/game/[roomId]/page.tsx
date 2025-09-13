"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GameBoard } from "@/components/game-board"
import { WalletConnect } from "@/components/wallet-connect"
import { ArrowLeft, Coins, Users, Clock, Loader2, Copy } from "lucide-react"
import { gameStateManager } from "@/lib/game-state"
import type { GameRoom } from "@/lib/game-state"
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import Link from "next/link"

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string
  const treasuryId = searchParams.get('treasury')
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [room, setRoom] = useState<GameRoom | null>(null)
  const [playerSymbol, setPlayerSymbol] = useState<"X" | "O">("X")
  const [finishingGame, setFinishingGame] = useState(false)
  const [attemptingJoin, setAttemptingJoin] = useState(false)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)

  useEffect(() => {
    if (!currentAccount) {
      router.push("/")
      return
    }

    const currentRoom = gameStateManager.getRoom(roomId)
    if (currentRoom) {
      setRoom(currentRoom)
      // Determine player symbol based on address
      const isPlayerX = currentRoom.players[0] === currentAccount.address
      setPlayerSymbol(isPlayerX ? "X" : "O")
    } else if (treasuryId) {
      // If no local room but we have treasury ID from URL, attempt to join
      console.log("[v0] No local room found but treasury ID provided, attempting to join...")
      setAttemptingJoin(true)
      handleAutoJoin()
    }

    // Subscribe to room updates
    const unsubscribe = gameStateManager.subscribeToRoom(roomId, (updatedRoom) => {
      console.log("[v0] Room updated:", updatedRoom)
      setRoom(updatedRoom)

      // Handle automatic game finishing when there's a winner
      if (updatedRoom.gameState === "finished" && updatedRoom.winner && !finishingGame) {
        handleGameFinish(updatedRoom)
      }
    })

    return unsubscribe
  }, [roomId, router, currentAccount, treasuryId])

  const handleAutoJoin = async () => {
    if (!currentAccount || !treasuryId) return

    try {
      console.log("[v0] Auto-joining room with treasury ID:", treasuryId)
      const joinedRoom = await gameStateManager.joinRoom(
        roomId,
        currentAccount.address,
        signAndExecuteTransaction,
        treasuryId
      )

      setRoom(joinedRoom)
      // The joining player is always "O" since they're the second player
      setPlayerSymbol("O")
    } catch (error) {
      console.error("[v0] Failed to auto-join room:", error)
      alert(`Failed to join room: ${error.message}`)
      router.push("/")
    } finally {
      setAttemptingJoin(false)
    }
  }

  const copyShareLink = () => {
    if (!room?.treasuryId) return
    
    const shareUrl = gameStateManager.generateRoomShareUrl(room.id, room.treasuryId, typeof window !== 'undefined' ? window.location.origin : '')
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
    })
  }

  const handleGameFinish = async (gameRoom: GameRoom) => {
    if (!currentAccount || !gameRoom.winner) return

    setFinishingGame(true)
    try {
      console.log("[v0] Finishing game and distributing prize...")

      await gameStateManager.finishGame(roomId, gameRoom.winner, signAndExecuteTransaction)

      console.log("[v0] Prize distributed successfully!")
    } catch (error) {
      console.error("[v0] Failed to finish game:", error)
    } finally {
      setFinishingGame(false)
    }
  }

  const handleMove = (position: number) => {
    if (!room || !currentAccount) return

    console.log("[v0] Making move at position:", position)

    const updatedRoom = gameStateManager.makeMove(roomId, position, currentAccount.address)
    if (updatedRoom) {
      setRoom(updatedRoom)
    }
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>{attemptingJoin ? "Joining room..." : "Loading game..."}</p>
            {treasuryId && (
              <p className="text-xs text-muted-foreground mt-2">
                Treasury: {treasuryId.slice(0, 8)}...{treasuryId.slice(-4)}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    )
  }

  const isWaitingForPlayer = room.gameState === "waiting"
  const isGameOver = room.gameState === "finished"
  const walletAddress = currentAccount?.address
  const isWinner = room.winner === walletAddress
  const isDraw = room.winner === null && isGameOver

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Lobby
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Room {room.id}</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {isWaitingForPlayer ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <h3 className="text-xl font-semibold mb-2">Waiting for Opponent</h3>
                  <p className="text-muted-foreground mb-4">Share this link with a friend to start playing!</p>
                  <div className="bg-muted p-3 rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Share this link:</p>
                    {room.treasuryId ? (
                      <div className="space-y-2">
                        <p className="font-mono text-sm break-all">
                          {gameStateManager.generateRoomShareUrl(room.id, room.treasuryId, typeof window !== 'undefined' ? window.location.origin : '')}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={copyShareLink}
                          className="w-full"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          {copiedToClipboard ? "Copied!" : "Copy Link"}
                        </Button>
                      </div>
                    ) : (
                      <p className="font-mono text-lg font-bold">{room.id}</p>
                    )}
                  </div>
                  {room.treasuryId && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Treasury Created:</p>
                      <p className="font-mono text-xs break-all">{room.treasuryId}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <GameBoard
                gameState={{
                  board: room.board,
                  currentPlayer: room.currentPlayer === walletAddress ? playerSymbol : playerSymbol === "X" ? "O" : "X",
                  gameOver: isGameOver,
                  winner: room.winner
                    ? room.winner === walletAddress
                      ? playerSymbol
                      : playerSymbol === "X"
                        ? "O"
                        : "X"
                    : null,
                }}
                onMove={handleMove}
                playerSymbol={playerSymbol}
              />
            )}

            {isGameOver && !isWaitingForPlayer && (
              <Card className="mt-6">
                <CardContent className="p-6 text-center">
                  <div
                    className={`text-2xl font-bold mb-4 ${
                      isDraw
                        ? "text-muted-foreground"
                        : isWinner
                          ? "text-accent winner-celebration"
                          : "text-destructive"
                    }`}
                  >
                    {isDraw ? "It's a Draw!" : isWinner ? "You Won!" : "You Lost!"}
                  </div>

                  {!isDraw && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Coins className="w-5 h-5 text-accent" />
                      <span className="text-lg">Prize: {isWinner ? room.betAmount * 2 : 0} SUI</span>
                    </div>
                  )}

                  {finishingGame && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Distributing prize on SUI blockchain...</span>
                    </div>
                  )}

                  <Button onClick={() => router.push("/")} className="w-full">
                    Return to Lobby
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <WalletConnect />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Room Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Room ID</p>
                  <p className="font-mono text-sm">{room.id}</p>
                </div>

                {room.treasuryId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Treasury ID</p>
                    <p className="font-mono text-xs break-all">{room.treasuryId}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-accent" />
                  <span>Bet: {room.betAmount} SUI each</span>
                </div>

                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  <span>Total Prize: {room.betAmount * 2} SUI</span>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Players:</p>
                  {room.players.map((playerAddress, index) => (
                    <div key={playerAddress} className="flex items-center justify-between text-sm">
                      <span className={index === 0 ? "text-primary" : "text-accent"}>
                        {index === 0 ? "X" : "O"}: {playerAddress.slice(0, 8)}...{playerAddress.slice(-4)}
                      </span>
                      {playerAddress === walletAddress && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                  ))}
                  {room.players.length === 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-accent text-muted-foreground">O: Waiting for player...</span>
                      <Badge variant="secondary" className="text-xs">
                        Empty
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <Badge variant={room.gameState === "playing" ? "default" : "secondary"}>
                    {room.gameState === "waiting"
                      ? "Waiting for Players"
                      : room.gameState === "playing"
                        ? "Game Active"
                        : "Game Finished"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
