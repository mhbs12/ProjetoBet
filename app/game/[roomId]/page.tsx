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
  const [isConnectedToGlobalSync, setIsConnectedToGlobalSync] = useState(false)

  useEffect(() => {
    if (!currentAccount) {
      router.push("/")
      return
    }

    const currentRoom = gameStateManager.getRoom(roomId)
    if (currentRoom) {
      setRoom(currentRoom)
      
      // Check if current user is the creator and mark them as present
      const isCreator = currentRoom.players.length > 0 && currentRoom.players[0] === currentAccount.address
      if (isCreator && !currentRoom.playersPresent.includes(currentAccount.address)) {
        console.log("[v0] Creator entering room, marking as present")
        const updatedRoom = gameStateManager.enterRoom(roomId, currentAccount.address)
        if (updatedRoom) {
          setRoom(updatedRoom)
        }
      }
      
      // Determine player symbol based on address
      const isPlayerX = currentRoom.players[0] === currentAccount.address
      setPlayerSymbol(isPlayerX ? "X" : "O")
    } else if (treasuryId) {
      // If no local room but we have treasury ID from URL, attempt to access the room
      console.log("[v0] No local room found but treasury ID provided, attempting to access room...")
      setAttemptingJoin(true)
      handleTreasuryBasedRoomAccess()
    } else {
      // No room found and no treasury ID provided
      console.error("[v0] Room not found and no treasury ID provided")
      alert("Room not found. Please check the room link or ID.")
      router.push("/")
      return
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

  const handleTreasuryBasedRoomAccess = async () => {
    if (!currentAccount || !treasuryId) return

    try {
      console.log("[v0] Accessing room via treasury ID:", treasuryId)
      
      // First, try to get or create the room using the treasury ID
      const accessedRoom = await gameStateManager.accessRoomByTreasury(
        roomId,
        treasuryId,
        currentAccount.address,
        signAndExecuteTransaction
      )

      setRoom(accessedRoom)
      
      // Determine player symbol based on position in players array
      const isPlayerX = accessedRoom.players[0] === currentAccount.address
      setPlayerSymbol(isPlayerX ? "X" : "O")
      
      console.log("[v0] Successfully accessed room via treasury ID")
    } catch (error) {
      console.error("[v0] Failed to access room via treasury:", error)
      
      // Provide more user-friendly error messages
      let userMessage = "Failed to access room"
      if (error.message.includes("not found")) {
        userMessage = "Room not found. The treasury may be invalid or the room may have expired."
      } else if (error.message.includes("full")) {
        userMessage = "This room is already full. Please try joining a different room."
      } else if (error.message.includes("already in room")) {
        userMessage = "You are already in this room."
      } else if (error.message.includes("Treasury")) {
        userMessage = "Unable to access room treasury. The treasury may be invalid or expired."
      } else if (error.message.includes("Transaction failed")) {
        userMessage = "Transaction failed. Please check your wallet connection and try again."
      } else {
        userMessage = `Failed to access room: ${error.message}`
      }
      
      alert(userMessage)
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

  const handleEnterRoom = () => {
    if (!currentAccount || !room) return
    
    console.log("[v0] Manually entering room")
    const updatedRoom = gameStateManager.enterRoom(roomId, currentAccount.address)
    if (updatedRoom) {
      setRoom(updatedRoom)
    }
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
            <p>{attemptingJoin ? "Accessing room..." : "Loading game..."}</p>
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
  
  // Check presence states
  const isCreator = room.players.length > 0 && room.players[0] === walletAddress
  const creatorAddress = room.players.length > 0 ? room.players[0] : null
  const isCreatorPresent = creatorAddress ? room.playersPresent.includes(creatorAddress) : false
  const hasSecondPlayer = room.players.length === 2
  const isSecondPlayerPresent = hasSecondPlayer ? room.playersPresent.includes(room.players[1]) : false
  
  // Determine waiting state message
  const getWaitingMessage = () => {
    if (!hasSecondPlayer) {
      return {
        title: "Waiting for Opponent",
        description: "Share this link with a friend to start playing!"
      }
    } else if (!isCreatorPresent) {
      return {
        title: "Waiting for Creator",
        description: "The room creator needs to enter the room for the game to begin."
      }
    } else if (!isSecondPlayerPresent) {
      return {
        title: "Waiting for Player 2",
        description: "The second player needs to be present for the game to begin."
      }
    }
    return {
      title: "Starting Game...",
      description: "Both players are present. Game starting..."
    }
  }

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
          <h1 className="text-2xl font-bold">
            {room.name || "Game Room"}
            {room.treasuryId && (
              <span className="text-lg font-normal text-muted-foreground ml-2">
                ({room.treasuryId.slice(0, 8)}...{room.treasuryId.slice(-4)})
              </span>
            )}
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {isWaitingForPlayer ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <h3 className="text-xl font-semibold mb-2">{getWaitingMessage().title}</h3>
                  <p className="text-muted-foreground mb-4">{getWaitingMessage().description}</p>
                  
                  {/* Show presence status */}
                  {hasSecondPlayer && (
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm font-semibold mb-2">Player Status:</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Creator (X): {creatorAddress?.slice(0, 8)}...{creatorAddress?.slice(-4)}</span>
                          <span className={`px-2 py-1 rounded text-xs ${isCreatorPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isCreatorPresent ? 'Present' : 'Not Present'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Player 2 (O): {room.players[1]?.slice(0, 8)}...{room.players[1]?.slice(-4)}</span>
                          <span className={`px-2 py-1 rounded text-xs ${isSecondPlayerPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isSecondPlayerPresent ? 'Present' : 'Not Present'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show Enter Room button for creators who aren't present */}
                  {isCreator && !isCreatorPresent && (
                    <Button onClick={handleEnterRoom} className="w-full mb-4">
                      Enter Room to Start Game
                    </Button>
                  )}
                  
                  {/* Share link section - only show if we still need a second player */}
                  {!hasSecondPlayer && (
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
                          <p className="text-xs text-muted-foreground">
                            Share this link or Treasury ID: <span className="font-mono">{room.treasuryId.slice(0, 12)}...{room.treasuryId.slice(-6)}</span>
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm">
                          <p className="text-amber-600 font-medium mb-2">⚠️ Treasury ID not available</p>
                          <p className="text-xs text-muted-foreground">
                            This room was created without a blockchain treasury. This may happen if:
                          </p>
                          <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                            <li>• Smart contract is not properly configured</li>
                            <li>• Transaction failed during room creation</li>
                            <li>• Network connectivity issues</li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2">
                            You can still play, but betting functionality will be limited.
                          </p>
                        </div>
                      )}
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
                {room.treasuryId && (
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold">Treasury ID</p>
                    <p className="font-mono text-xs break-all bg-muted p-2 rounded">{room.treasuryId}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Share this ID with other players to invite them
                    </p>
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
