"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { WalletConnect } from "@/components/wallet-connect"
import { Plus, Users, Coins, Trophy, Shield, Loader2, AlertTriangle, Copy } from "lucide-react"
import { simpleRoomManager } from "@/lib/simple-room-manager"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"

export default function HomePage() {
  const router = useRouter()
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const [newRoomBet, setNewRoomBet] = useState("0.1")
  const [joinRoomId, setJoinRoomId] = useState("")
  const [joinBetAmount, setJoinBetAmount] = useState("0.1")
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [joiningRoom, setJoiningRoom] = useState(false)
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null)
  const [showRoomDialog, setShowRoomDialog] = useState(false)
  const [isContractConfigured, setIsContractConfigured] = useState(true)
  const [copiedRoomId, setCopiedRoomId] = useState(false)
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  const copyRoomId = (roomId: string) => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedRoomId(true)
      setTimeout(() => setCopiedRoomId(false), 2000)
    })
  }

  const enterMyRoom = (roomId: string) => {
    setShowRoomDialog(false)
    router.push(`/game/${roomId}`)
  }

  // Load available rooms from blockchain
  const loadAvailableRooms = async () => {
    if (!currentAccount?.address) {
      console.warn("[v0] Cannot load rooms - wallet not connected or address not available")
      setAvailableRooms([])
      return
    }
    
    setLoadingRooms(true)
    try {
      const rooms = await simpleRoomManager.listAvailableRooms(currentAccount.address)
      setAvailableRooms(rooms.filter(room => room.gameState === "waiting")) // Only show waiting rooms
      console.log("[v0] Loaded available rooms:", rooms)
    } catch (error) {
      console.error("[v0] Failed to load available rooms:", error)
      
      // Show user-friendly error message
      if (error.message && error.message.includes("Invalid wallet address")) {
        console.error("[v0] Wallet connection issue detected")
        // Clear available rooms on wallet error
        setAvailableRooms([])
      }
    } finally {
      setLoadingRooms(false)
    }
  }

  // Check if contract is properly configured and handle URL parameters
  useEffect(() => {
    const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || ""
    setIsContractConfigured(packageId.length > 0)
    
    if (!packageId) {
      console.warn("[v0] Contract package ID not configured")
    }
    
    // Check for join parameter in URL
    const urlParams = new URLSearchParams(window.location.search)
    const joinParam = urlParams.get('join')
    if (joinParam) {
      setJoinRoomId(joinParam)
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Load available rooms when wallet is connected and address is available
  useEffect(() => {
    if (currentAccount?.address) {
      console.log("[v0] Wallet connected with address:", currentAccount.address)
      loadAvailableRooms()
    } else {
      console.log("[v0] Wallet not connected, clearing available rooms")
      setAvailableRooms([])
      setLoadingRooms(false)
    }
  }, [currentAccount?.address])

  // Refresh rooms periodically when wallet is connected
  useEffect(() => {
    if (!currentAccount?.address) return
    
    const interval = setInterval(() => {
      if (currentAccount?.address) {
        loadAvailableRooms()
      }
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [currentAccount?.address])

  const createRoom = async () => {
    if (!newRoomBet || !currentAccount) return

    setCreatingRoom(true)
    try {
      console.log("[v0] Creating room with new Room system...")

      const betAmount = Number.parseFloat(newRoomBet)
      
      // Create room and get room ID
      const roomId = await simpleRoomManager.createRoom(
        currentAccount.address,
        betAmount,
        signAndExecuteTransaction,
      )
      
      // Show room ID dialog for sharing
      setCreatedRoomId(roomId)
      setShowRoomDialog(true)
      
      setNewRoomBet("0.1")

      console.log("[v0] Room created successfully with Room ID:", roomId)
      
      // Refresh available rooms list
      loadAvailableRooms()
    } catch (error) {
      console.error("[v0] Failed to create room:", error)
      alert(`Failed to create room: ${error.message}`)
    } finally {
      setCreatingRoom(false)
    }
  }

  const joinRoom = async () => {
    if (!joinRoomId.trim() || !currentAccount || !joinBetAmount) return

    const betAmount = Number.parseFloat(joinBetAmount)
    if (betAmount <= 0) {
      alert("Bet amount must be greater than 0")
      return
    }

    setJoiningRoom(true)
    try {
      console.log("[v0] Joining room with room ID:", joinRoomId)

      const room = await simpleRoomManager.joinRoom(
        joinRoomId.trim(),
        currentAccount.address,
        betAmount,
        signAndExecuteTransaction
      )
      
      setJoinRoomId("")
      setJoinBetAmount("0.1")

      console.log("[v0] Joined room successfully, redirecting...")
      router.push(`/game/${joinRoomId.trim()}`)
    } catch (error) {
      console.error("[v0] Failed to join room:", error)
      
      let userMessage = "Failed to join room"
      if (error.message.includes("not found")) {
        userMessage = "Room not found. Please check the Room ID and try again."
      } else if (error.message.includes("full")) {
        userMessage = "This room is already full. Please try joining a different room."
      } else if (error.message.includes("already in room")) {
        userMessage = "You are already in this room."
      } else if (error.message.includes("ERoomFull")) {
        userMessage = "This room is already full. Please try joining a different room."
      } else if (error.message.includes("Transaction failed")) {
        userMessage = "Transaction failed. Please check your wallet connection and try again."
      } else {
        userMessage = `Failed to join room: ${error.message}`
      }
      
      alert(userMessage)
    } finally {
      setJoiningRoom(false)
    }
  }

  const joinAvailableRoom = async (roomId: string) => {
    const betAmount = Number.parseFloat(joinBetAmount)
    if (betAmount <= 0) {
      alert("Please set a valid bet amount first")
      return
    }

    setJoiningRoom(true)
    try {
      console.log("[v0] Joining available room:", roomId)

      await simpleRoomManager.joinRoom(
        roomId,
        currentAccount!.address,
        betAmount,
        signAndExecuteTransaction
      )

      console.log("[v0] Joined available room successfully, redirecting...")
      router.push(`/game/${roomId}`)
    } catch (error) {
      console.error("[v0] Failed to join available room:", error)
      alert(`Failed to join room: ${error.message}`)
      // Refresh rooms list in case the room was filled by someone else
      loadAvailableRooms()
    } finally {
      setJoiningRoom(false)
    }
  }

  if (!currentAccount) {
    return (
      <main className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 gradient-text">SUI TicTacToe Betting</h1>
            <p className="text-muted-foreground text-lg">Play TicTacToe with real SUI cryptocurrency bets</p>
          </div>

          <div className="flex flex-col items-center gap-4 mb-8">
            <WalletConnect />
            <Link href="/mint-og-nft">
              <Button variant="outline" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Mint Free OG NFT
              </Button>
            </Link>
          </div>

          <div className="text-center py-8 text-muted-foreground">
            <p>Connect your wallet to create or join rooms</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 gradient-text">SUI TicTacToe Betting</h1>
          <p className="text-muted-foreground text-lg mb-6">Play TicTacToe with real SUI cryptocurrency bets</p>

          <div className="flex flex-col items-center gap-4 mb-8">
            <WalletConnect />
            <Link href="/mint-og-nft">
              <Button variant="outline" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Mint Free OG NFT
              </Button>
            </Link>
          </div>

          {!isContractConfigured && (
            <Alert className="mb-8 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Smart Contract Not Configured</AlertTitle>
              <AlertDescription className="text-amber-700">
                To use the betting functionality, you need to deploy a smart contract and set the{" "}
                <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUI_PACKAGE_ID</code> environment variable.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Create Room */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Criar Nova Sala
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="betAmount">Bet Amount (SUI)</Label>
                <Input
                  id="betAmount"
                  type="number"
                  value={newRoomBet}
                  onChange={(e) => setNewRoomBet(e.target.value)}
                  placeholder="0.1"
                  min="0.01"
                  step="0.01"
                  disabled={creatingRoom}
                />
              </div>
              <Button onClick={createRoom} className="w-full" disabled={creatingRoom || !isContractConfigured}>
                {creatingRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Room...
                  </>
                ) : (
                  "Criar Sala"
                )}
              </Button>
              {!isContractConfigured && (
                <p className="text-xs text-muted-foreground text-center text-amber-600">
                  Smart contract must be configured to create rooms
                </p>
              )}
              {creatingRoom && (
                <p className="text-xs text-muted-foreground text-center">
                  Please confirm the transaction in your wallet...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Join Room */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Entrar em Sala
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="roomId">Código da Sala (Room ID)</Label>
                <Input
                  id="roomId"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Cole o ID da sala aqui"
                  disabled={joiningRoom}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite o ID da sala que você recebeu do criador
                </p>
              </div>
              <div>
                <Label htmlFor="joinBetAmount">Your Bet Amount (SUI)</Label>
                <Input
                  id="joinBetAmount"
                  type="number"
                  value={joinBetAmount}
                  onChange={(e) => setJoinBetAmount(e.target.value)}
                  placeholder="0.1"
                  min="0.01"
                  step="0.01"
                  disabled={joiningRoom}
                />
              </div>
              <Button onClick={joinRoom} className="w-full" disabled={!joinRoomId.trim() || !joinBetAmount || joiningRoom || !isContractConfigured}>
                {joiningRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining Room...
                  </>
                ) : (
                  "Entrar na Sala"
                )}
              </Button>
              {!isContractConfigured && (
                <p className="text-xs text-muted-foreground text-center text-amber-600">
                  Smart contract must be configured to join rooms
                </p>
              )}
              {joiningRoom && (
                <p className="text-xs text-muted-foreground text-center">
                  Please confirm the transaction in your wallet...
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Available Rooms Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Salas Disponíveis
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadAvailableRooms}
                disabled={loadingRooms}
              >
                {loadingRooms ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Atualizar"
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRooms ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Carregando salas...</p>
              </div>
            ) : availableRooms.length > 0 ? (
              <div className="space-y-4">
                {availableRooms.map((room) => (
                  <div key={room.roomId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-semibold">Sala criada por: {room.creator.slice(0, 6)}...{room.creator.slice(-4)}</p>
                      <p className="text-sm text-muted-foreground">
                        Jogadores: {room.players.length}/2 • Estado: {room.gameState === "waiting" ? "Aguardando" : "Jogando"}
                      </p>
                      <p className="text-xs text-muted-foreground">ID: {room.roomId.slice(0, 8)}...</p>
                    </div>
                    <Button 
                      onClick={() => joinAvailableRoom(room.roomId)}
                      disabled={joiningRoom || room.gameState !== "waiting"}
                      size="sm"
                    >
                      {room.gameState === "waiting" ? "Entrar" : "Cheia"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma sala disponível no momento.</p>
                <p className="text-sm mt-2">Crie uma nova sala ou tente atualizar.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="text-center">
            <CardContent className="p-6">
              <Shield className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Secure Betting</h3>
              <p className="text-sm text-muted-foreground">
                Smart contract ensures fair play and secure prize distribution
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Coins className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h3 className="font-semibold mb-2">SUI Integration</h3>
              <p className="text-sm text-muted-foreground">
                Native SUI blockchain integration with smart contract verification
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Instant Payouts</h3>
              <p className="text-sm text-muted-foreground">
                Automatic prize distribution to winners via smart contracts
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Room ID Success Dialog */}
      <Dialog open={showRoomDialog} onOpenChange={setShowRoomDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Sala Criada com Sucesso!
            </DialogTitle>
            <DialogDescription>
              Sua sala foi criada na blockchain. Compartilhe o código da sala abaixo para convidar outros jogadores:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <Label className="text-sm font-semibold">Código da Sala (Room ID)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 p-2 bg-background rounded border text-sm font-mono break-all">
                  {createdRoomId}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createdRoomId && copyRoomId(createdRoomId)}
                >
                  <Copy className="w-4 h-4" />
                  {copiedRoomId ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Os jogadores usam este código para entrar na sua sala e começar o jogo.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowRoomDialog(false)
                  setCreatedRoomId(null)
                  // Stay on the lobby page - user can create or join other rooms
                }}
              >
                Ficar no Lobby
              </Button>
              <Button 
                className="flex-1"
                onClick={() => createdRoomId && enterMyRoom(createdRoomId)}
              >
                Entrar na Sala
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}