"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GameBoard } from "@/components/game-board"
import { WalletConnect } from "@/components/wallet-connect"
import { ArrowLeft, Coins, Users, Clock, Loader2, Copy } from "lucide-react"
import { simpleRoomManager } from "@/lib/simple-room-manager"
import type { SimpleRoom } from "@/lib/simple-room-manager"
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import Link from "next/link"

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  // The roomId in the URL is actually the treasuryId (room code)
  const treasuryId = params.roomId as string
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [room, setRoom] = useState<SimpleRoom | null>(null)
  const [playerSymbol, setPlayerSymbol] = useState<"X" | "O">("X")
  const [finishingGame, setFinishingGame] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)

  useEffect(() => {
    if (!currentAccount) {
      router.push("/")
      return
    }

    loadRoom()
  }, [treasuryId, currentAccount])

  const loadRoom = async () => {
    setLoading(true)
    try {
      // Try to get the room using treasury ID
      const currentRoom = simpleRoomManager.getRoom(treasuryId)
      
      if (currentRoom) {
        setRoom(currentRoom)
        // Determine player symbol based on position in players array
        const isPlayerX = currentRoom.players[0] === currentAccount?.address
        setPlayerSymbol(isPlayerX ? "X" : "O")
        console.log("[v0] Room loaded successfully")
      } else {
        // Room not found locally, this might be a new room or we need to join
        console.log("[v0] Room not found locally for treasury ID:", treasuryId)
        setRoom(null)
      }

      // Subscribe to room updates
      const unsubscribe = simpleRoomManager.subscribeToRoom(treasuryId, (updatedRoom) => {
        console.log("[v0] Room updated:", updatedRoom)
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
    navigator.clipboard.writeText(treasuryId).then(() => {
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
    })
  }

  const handleGameFinish = async (gameRoom: SimpleRoom) => {
    if (!currentAccount || !gameRoom.winner) return

    setFinishingGame(true)
    try {
      console.log("[v0] Finishing game and distributing prize...")

      await simpleRoomManager.finishGame(treasuryId, gameRoom.winner, signAndExecuteTransaction)

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

    const updatedRoom = simpleRoomManager.makeMove(treasuryId, position, currentAccount.address)
    if (updatedRoom) {
      setRoom(updatedRoom)
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
              Room Code: {treasuryId.slice(0, 8)}...{treasuryId.slice(-4)}
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
              Room Code: {treasuryId.slice(0, 8)}...{treasuryId.slice(-4)}
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
              ({treasuryId.slice(0, 8)}...{treasuryId.slice(-4)})
            </span>
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {isWaitingForPlayer ? (
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
                            {treasuryId}
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
                  <p className="text-sm text-muted-foreground font-semibold">Código da Sala (Treasury ID)</p>
                  <p className="font-mono text-xs break-all bg-muted p-2 rounded">{treasuryId}</p>
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
