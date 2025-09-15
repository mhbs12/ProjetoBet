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
  const [joinTreasuryId, setJoinTreasuryId] = useState("")
  const [joinBetAmount, setJoinBetAmount] = useState("0.1")
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [joiningRoom, setJoiningRoom] = useState(false)
  const [createdTreasuryId, setCreatedTreasuryId] = useState<string | null>(null)
  const [showTreasuryDialog, setShowTreasuryDialog] = useState(false)
  const [isContractConfigured, setIsContractConfigured] = useState(true)
  const [copiedTreasuryId, setCopiedTreasuryId] = useState(false)

  const copyTreasuryId = (treasuryId: string) => {
    navigator.clipboard.writeText(treasuryId).then(() => {
      setCopiedTreasuryId(true)
      setTimeout(() => setCopiedTreasuryId(false), 2000)
    })
  }

  const enterMyRoom = (treasuryId: string) => {
    setShowTreasuryDialog(false)
    router.push(`/game/${treasuryId}`)
  }

  // Check if contract is properly configured
  useEffect(() => {
    const packageId = process.env.NEXT_PUBLIC_CONTRACT_PACKAGE_ID
    setIsContractConfigured(!!packageId)
    
    if (!packageId) {
      console.warn("[v0] Contract package ID not configured")
    }
  }, [])

  const createRoom = async () => {
    if (!newRoomBet || !currentAccount) return

    setCreatingRoom(true)
    try {
      console.log("[v0] Creating room with simplified treasury ID system...")

      const betAmount = Number.parseFloat(newRoomBet)
      
      // Validate bet amount
      if (betAmount <= 0 || betAmount < 0.001) {
        throw new Error("Bet amount must be at least 0.001 SUI")
      }
      
      // Create room and get treasury ID as room code
      const treasuryId = await simpleRoomManager.createRoom(
        currentAccount.address,
        betAmount,
        signAndExecuteTransaction,
      )
      
      // Validate treasury ID before proceeding
      if (!treasuryId || typeof treasuryId !== 'string') {
        throw new Error("Failed to extract treasury ID from transaction. The room may have been created but cannot be accessed. Please try again.")
      }
      
      // Show treasury ID dialog for sharing
      setCreatedTreasuryId(treasuryId)
      setShowTreasuryDialog(true)
      
      setNewRoomBet("0.1")

      console.log("[v0] Room created successfully with Treasury ID (room code):", treasuryId)
    } catch (error) {
      console.error("[v0] Failed to create room:", error)
      
      // Provide user-friendly error messages
      let userMessage = "Failed to create room"
      if (error.message.includes("treasury ID")) {
        userMessage = "Transaction succeeded but failed to extract room code. Please try again or contact support."
      } else if (error.message.includes("Contract not configured")) {
        userMessage = "Smart contract not configured. Please contact the administrator."
      } else if (error.message.includes("Insufficient")) {
        userMessage = "Insufficient SUI balance. Please add more SUI to your wallet."
      } else if (error.message.includes("Bet amount")) {
        userMessage = error.message
      } else {
        userMessage = `Failed to create room: ${error.message}`
      }
      
      alert(userMessage)
    } finally {
      setCreatingRoom(false)
    }
  }

  const joinRoom = async () => {
    if (!joinTreasuryId.trim() || !currentAccount || !joinBetAmount) return

    const betAmount = Number.parseFloat(joinBetAmount)
    if (betAmount <= 0) {
      alert("Bet amount must be greater than 0")
      return
    }

    setJoiningRoom(true)
    try {
      console.log("[v0] Joining room with treasury ID (room code):", joinTreasuryId)

      const room = await simpleRoomManager.joinRoom(
        joinTreasuryId.trim(),
        currentAccount.address,
        betAmount,
        signAndExecuteTransaction
      )
      
      setJoinTreasuryId("")
      setJoinBetAmount("0.1")

      console.log("[v0] Joined room successfully, redirecting...")
      router.push(`/game/${joinTreasuryId.trim()}`)
    } catch (error) {
      console.error("[v0] Failed to join room:", error)
      
      let userMessage = "Failed to join room"
      if (error.message.includes("not found")) {
        userMessage = "Room code not found. Please check the Treasury ID and try again."
      } else if (error.message.includes("full")) {
        userMessage = "This room is already full. Please try joining a different room."
      } else if (error.message.includes("already in room")) {
        userMessage = "You are already in this room."
      } else if (error.message.includes("Treasury")) {
        userMessage = "Unable to access room. The room code may be invalid or expired."
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
                <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_CONTRACT_PACKAGE_ID</code> environment variable.
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
                <Label htmlFor="treasuryId">Código da Sala (Treasury ID)</Label>
                <Input
                  id="treasuryId"
                  value={joinTreasuryId}
                  onChange={(e) => setJoinTreasuryId(e.target.value)}
                  placeholder="Cole o código da sala aqui"
                  disabled={joiningRoom}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite o código da sala que você recebeu do criador
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
              <Button onClick={joinRoom} className="w-full" disabled={!joinTreasuryId.trim() || !joinBetAmount || joiningRoom || !isContractConfigured}>
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

      {/* Treasury ID Success Dialog */}
      <Dialog open={showTreasuryDialog} onOpenChange={setShowTreasuryDialog}>
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
              <Label className="text-sm font-semibold">Código da Sala (Treasury ID)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 p-2 bg-background rounded border text-sm font-mono break-all">
                  {createdTreasuryId}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createdTreasuryId && copyTreasuryId(createdTreasuryId)}
                >
                  <Copy className="w-4 h-4" />
                  {copiedTreasuryId ? "Copied!" : "Copy"}
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
                onClick={() => setShowTreasuryDialog(false)}
              >
                Ficar no Lobby
              </Button>
              <Button 
                className="flex-1"
                onClick={() => createdTreasuryId && enterMyRoom(createdTreasuryId)}
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