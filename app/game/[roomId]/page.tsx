"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GameBoard } from "@/components/game-board"
import { WalletConnect } from "@/components/wallet-connect"
import { ArrowLeft, Coins, Users, Clock, Loader2, Copy, Wifi, WifiOff } from "lucide-react"
import { simpleRoomManager } from "@/lib/simple-room-manager"
import type { SimpleRoom } from "@/lib/simple-room-manager"
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useWebSocketRoomSync } from "@/hooks/use-websocket-room"
import Link from "next/link"

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  // The roomId in the URL is the Room object ID from blockchain
  const roomId = params.roomId as string
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [room, setRoom] = useState<SimpleRoom | null>(null)
  const [playerSymbol, setPlayerSymbol] = useState<"X" | "O">("X")
  const [finishingGame, setFinishingGame] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)

  // WebSocket integration for real-time room sync
  const { 
    connected: wsConnected, 
    connectionReady: wsConnectionReady,
    roomState: wsRoomState, 
    error: wsError,
    connectionId: wsConnectionId,
    broadcastRoomUpdate 
  } = useWebSocketRoomSync(roomId)

  // Helper function to convert SimpleRoom to GameState
  const createGameStateFromRoom = (room: SimpleRoom) => {
    const moves = room.board.filter(cell => cell !== null).length
    const currentPlayerSymbol = room.currentPlayer === room.players[0] ? "X" : "O"
    
    let winner: "X" | "O" | "draw" | null = null
    if (room.winner) {
      winner = room.winner === room.players[0] ? "X" : "O"
    } else if (room.gameState === "finished" && !room.winner) {
      winner = "draw"
    }

    return {
      board: room.board,
      currentPlayer: currentPlayerSymbol,
      gameOver: room.gameState === "finished",
      winner,
      moves,
    }
  }

  // Update room state when WebSocket receives updates
  useEffect(() => {
    if (wsRoomState && wsRoomState.roomId === roomId) {
      console.log("[v0] WebSocket room state update received:", wsRoomState)
      setRoom(wsRoomState)
      
      // Update player symbol based on position in players array
      const isPlayerX = wsRoomState.players[0] === currentAccount?.address
      setPlayerSymbol(isPlayerX ? "X" : "O")

      // Handle automatic game finishing when there's a winner
      if (wsRoomState.gameState === "finished" && wsRoomState.winner && !finishingGame) {
        handleGameFinish(wsRoomState)
      }
    }
  }, [wsRoomState, roomId, currentAccount, finishingGame])

  useEffect(() => {
    if (!currentAccount?.address) {
      console.log("[v0] No wallet address available, redirecting to home")
      router.push("/")
      return
    }

    console.log("[v0] Wallet address available, loading room:", currentAccount.address)
    loadRoom()
  }, [roomId, currentAccount?.address])

  const loadRoom = async () => {
    setLoading(true)
    try {
      console.log("[v0] Loading room with WebSocket state - connected:", wsConnected, "ready:", wsConnectionReady, "connectionId:", wsConnectionId)
      
      // Try to get the room using room ID with blockchain fallback
      const currentRoom = await simpleRoomManager.getOrLoadRoom(roomId)
      
      if (currentRoom) {
        setRoom(currentRoom)
        // Determine player symbol based on position in players array
        const isPlayerX = currentRoom.players[0] === currentAccount?.address
        setPlayerSymbol(isPlayerX ? "X" : "O")
        console.log("[v0] Room loaded successfully")
        
        // If current player is not in the room but room exists, they might need to join
        if (currentAccount && !currentRoom.players.includes(currentAccount.address)) {
          console.log("[v0] Current player not in room, they may need to join")
        } else if (currentAccount && currentRoom.players.includes(currentAccount.address)) {
          // Player is already in room, ensure state synchronization via WebSocket
          console.log("[v0] Player is in room, ensuring WebSocket state sync")
          
          // Wait for WebSocket connection to be ready before attempting room entry
          const maxWaitTime = 10000 // 10 seconds
          const waitStartTime = Date.now()
          
          const waitForConnection = async (): Promise<boolean> => {
            while (Date.now() - waitStartTime < maxWaitTime) {
              if (wsConnectionReady) {
                console.log("[v0] WebSocket connection ready, proceeding with room entry")
                return true
              }
              console.log("[v0] Waiting for WebSocket connection to be ready...")
              await new Promise(resolve => setTimeout(resolve, 500))
            }
            console.warn("[v0] WebSocket connection timeout, proceeding anyway")
            return false
          }

          const connectionReady = await waitForConnection()
          
          // Use enterRoom to ensure proper state synchronization
          const syncedRoom = await simpleRoomManager.enterRoom(roomId, currentAccount.address)
          if (syncedRoom) {
            setRoom(syncedRoom)
            console.log("[v0] Room state synchronized successfully", connectionReady ? "(with WebSocket)" : "(without WebSocket)")
          } else {
            console.warn("[v0] Failed to synchronize room state")
          }
        }
      } else {
        // Room not found locally or on blockchain
        console.log("[v0] Room not found anywhere for room ID:", roomId)
        setRoom(null)
      }

      // Subscribe to room updates
      const unsubscribe = simpleRoomManager.subscribeToRoom(roomId, (updatedRoom) => {
        console.log("[v0] Room updated via subscription:", updatedRoom)
        setRoom(updatedRoom)

        // Handle automatic game finishing when there's a winner
        if (updatedRoom.gameState === "finished" && updatedRoom.winner && !finishingGame) {
          handleGameFinish(updatedRoom)
        }
      })

      return unsubscribe
    } catch (error) {
      console.error("[v0] Failed to load room:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
    })
  }

  const handleGameFinish = async (gameRoom: SimpleRoom) => {
    if (!currentAccount || !gameRoom.winner) return

    setFinishingGame(true)
    try {
      console.log("[v0] Finishing game and distributing prize...")

      await simpleRoomManager.finishGame(roomId, gameRoom.winner, signAndExecuteTransaction)

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

    // Validate move before attempting
    if (room.gameState !== "playing") {
      console.log("[v0] Cannot move: Game is not in playing state")
      return
    }

    if (room.currentPlayer !== currentAccount.address) {
      console.log("[v0] Cannot move: Not your turn")
      return
    }

    if (room.board[position] !== null) {
      console.log("[v0] Cannot move: Position already occupied")
      return
    }

    const updatedRoom = simpleRoomManager.makeMove(roomId, position, currentAccount.address)
    if (updatedRoom) {
      setRoom(updatedRoom)
      console.log("[v0] Move successful, room updated")
      // The room manager will automatically broadcast the update via WebSocket
    } else {
      console.warn("[v0] Move failed - room manager returned null")
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading room...</p>
            <p className="text-xs text-muted-foreground mt-2">
              Room ID: {roomId.slice(0, 8)}...{roomId.slice(-4)}
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">Room Not Found</h3>
            <p className="text-muted-foreground mb-4">
              This room doesn't exist or you don't have access to it.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Room ID: {roomId.slice(0, 8)}...{roomId.slice(-4)}
            </p>
            <Button onClick={() => router.push("/")}>
              Return to Lobby
            </Button>
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
  
  // Check if current user is in the room
  const isPlayerInRoom = room.players.includes(walletAddress || "")
  const hasSecondPlayer = room.players.length === 2

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
            Sala de Jogo
            <span className="text-lg font-normal text-muted-foreground ml-2">
              ({roomId.slice(0, 8)}...{roomId.slice(-4)})
            </span>
          </h1>
          
          {/* Real-time connection status */}
          <div className="flex items-center gap-2 text-sm">
            {wsConnected && wsConnectionReady ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Conectado em tempo real</span>
                {wsConnectionId && (
                  <span className="text-xs text-muted-foreground">({wsConnectionId.slice(-6)})</span>
                )}
              </>
            ) : wsConnected && !wsConnectionReady ? (
              <>
                <Wifi className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-600">Conectando...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-orange-500" />
                <span className="text-orange-600">Reconectando...</span>
              </>
            )}
            {wsError && (
              <span className="text-red-600 text-xs">({wsError})</span>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {!isPlayerInRoom ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Sala Encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    Esta sala existe mas você ainda não entrou nela. Clique no botão abaixo para participar do jogo.
                  </p>
                  
                  <div className="bg-muted p-4 rounded-lg mb-4">
                    <p className="text-sm font-semibold mb-2">Informações da Sala:</p>
                    <p className="text-sm">Valor da Aposta: {room.betAmount} SUI</p>
                    <p className="text-sm">Jogadores: {room.players.length}/2</p>
                    <p className="text-sm">Status: {room.gameState === "waiting" ? "Aguardando" : room.gameState === "playing" ? "Em andamento" : "Finalizado"}</p>
                  </div>
                  
                  {room.gameState === "waiting" && room.players.length < 2 && (
                    <Button 
                      onClick={() => {
                        // Navigate back to home to join via the join interface
                        router.push(`/?join=${roomId}`)
                      }}
                      className="mr-2"
                    >
                      Entrar na Sala
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline"
                    onClick={() => router.push("/")}
                  >
                    Voltar ao Lobby
                  </Button>
                </CardContent>
              </Card>
            ) : isWaitingForPlayer ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  {!hasSecondPlayer ? (
                    <>
                      <h3 className="text-xl font-semibold mb-2">Aguardando Oponente</h3>
                      <p className="text-muted-foreground mb-4">
                        Compartilhe o código da sala com um amigo para começar a jogar!
                      </p>
                      
                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <p className="text-sm font-semibold mb-2">Código da Sala:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 bg-background rounded border text-sm font-mono break-all">
                            {roomId}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyRoomCode}
                          >
                            <Copy className="w-4 h-4" />
                            {copiedToClipboard ? "Copiado!" : "Copiar"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Os jogadores usam este código para entrar na sua sala.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-semibold mb-2">Iniciando Jogo...</h3>
                      <p className="text-muted-foreground mb-4">
                        Ambos os jogadores estão na sala. O jogo vai começar automaticamente!
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Turn indicator */}
                {!isGameOver && (
                  <Card className="mb-4">
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          room.currentPlayer === currentAccount?.address 
                            ? 'bg-green-500 animate-pulse' 
                            : 'bg-gray-400'
                        }`} />
                        <span className={`font-semibold ${
                          room.currentPlayer === currentAccount?.address 
                            ? 'text-green-600' 
                            : 'text-gray-600'
                        }`}>
                          {room.currentPlayer === currentAccount?.address 
                            ? `Sua vez (${playerSymbol})` 
                            : `Vez do oponente (${playerSymbol === 'X' ? 'O' : 'X'})`
                          }
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <GameBoard
                  gameState={createGameStateFromRoom(room)}
                  onMove={handleMove}
                  playerSymbol={playerSymbol}
                />
              </>
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
                    {isDraw ? "Empate!" : isWinner ? "Você Ganhou!" : "Você Perdeu!"}
                  </div>

                  {!isDraw && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Coins className="w-5 h-5 text-accent" />
                      <span className="text-lg">Prêmio: {isWinner ? room.betAmount * 2 : 0} SUI</span>
                    </div>
                  )}

                  {finishingGame && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Distribuindo prêmio na blockchain SUI...</span>
                    </div>
                  )}

                  <Button onClick={() => router.push("/")} className="w-full">
                    Voltar ao Lobby
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
                  Informações da Sala
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold">Código da Sala (Room ID)</p>
                  <p className="font-mono text-xs break-all bg-muted p-2 rounded">{roomId}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compartilhe este código com outros jogadores para convidá-los
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-accent" />
                  <span>Aposta: {room.betAmount} SUI cada</span>
                </div>

                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  <span>Prêmio Total: {room.betAmount * 2} SUI</span>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Jogadores:</p>
                  {room.players.map((playerAddress, index) => (
                    <div key={playerAddress} className="flex items-center justify-between text-sm">
                      <span className={index === 0 ? "text-primary" : "text-accent"}>
                        {index === 0 ? "X" : "O"}: {playerAddress.slice(0, 8)}...{playerAddress.slice(-4)}
                      </span>
                      {playerAddress === walletAddress && (
                        <Badge variant="outline" className="text-xs">
                          Você
                        </Badge>
                      )}
                    </div>
                  ))}
                  {room.players.length === 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-accent text-muted-foreground">O: Aguardando jogador...</span>
                      <Badge variant="secondary" className="text-xs">
                        Vazio
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <Badge variant={room.gameState === "playing" ? "default" : "secondary"}>
                    {room.gameState === "waiting"
                      ? "Aguardando Jogadores"
                      : room.gameState === "playing"
                        ? "Jogo Ativo"
                        : "Jogo Finalizado"}
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
