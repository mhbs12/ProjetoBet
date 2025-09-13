"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { WalletConnect } from "@/components/wallet-connect"
import { Plus, Users, Coins, Trophy, Shield, Loader2, AlertTriangle, Search, Clock } from "lucide-react"
import { gameStateManager } from "@/lib/game-state"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"

export default function HomePage() {
  const router = useRouter()
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const [rooms, setRooms] = useState<any[]>([])
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [myRooms, setMyRooms] = useState<any[]>([])
  const [roomSearchQuery, setRoomSearchQuery] = useState("")
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomBet, setNewRoomBet] = useState("0.1")
  const [joinRoomId, setJoinRoomId] = useState("")
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [joiningRoom, setJoiningRoom] = useState(false)
  const [isContractConfigured, setIsContractConfigured] = useState(true)

  // Check if contract is properly configured
  useEffect(() => {
    const packageId = process.env.NEXT_PUBLIC_CONTRACT_PACKAGE_ID
    setIsContractConfigured(!!packageId)
    
    if (!packageId) {
      console.warn("[v0] Contract package ID not configured")
    }

    // Create mock rooms for demonstration purposes
    // TODO: Remove this in production - rooms will be loaded from the blockchain
    createMockRooms()
  }, [])

  // Update wallet state when account changes
  useEffect(() => {
    if (currentAccount) {
      console.log("[v0] Account connected:", currentAccount.address)
      loadAvailableRooms()
      loadMyRooms()
    } else {
      console.log("[v0] Account disconnected")
      // Keep mock rooms for demonstration even when wallet is disconnected
      const available = gameStateManager.getAvailableRooms()
      setAvailableRooms(available)
      setMyRooms([])
    }
  }, [currentAccount])

  // Load available rooms
  const loadAvailableRooms = () => {
    const available = gameStateManager.getAvailableRooms()
    console.log("[v0] Loaded available rooms:", available)
    setAvailableRooms(available)
  }

  // Load rooms created by current wallet
  const loadMyRooms = () => {
    if (currentAccount) {
      const myCreatedRooms = gameStateManager.getRoomsCreatedByWallet(currentAccount.address)
      console.log("[v0] Loaded my rooms:", myCreatedRooms)
      setMyRooms(myCreatedRooms)
    }
  }

  // Create mock rooms for testing (TODO: Remove in production)
  const createMockRooms = () => {
    const mockRooms = [
      {
        id: "test1",
        name: "High Stakes Game",
        treasuryId: "0x123abc",
        betAmount: 1.0,
        players: ["0xplayer1"],
        gameState: "waiting" as const,
        board: Array(9).fill(null),
        currentPlayer: "0xplayer1",
        createdAt: Date.now() - 60000
      },
      {
        id: "test2", 
        name: "Beginner's Room",
        treasuryId: "0x456def",
        betAmount: 0.1,
        players: ["0xplayer2"],
        gameState: "waiting" as const,
        board: Array(9).fill(null),
        currentPlayer: "0xplayer2",
        createdAt: Date.now() - 30000
      },
      {
        id: "test3",
        name: "Quick Match",
        treasuryId: "0x789ghi",
        betAmount: 0.5,
        players: ["0xplayer3"],
        gameState: "waiting" as const,
        board: Array(9).fill(null),
        currentPlayer: "0xplayer3",
        createdAt: Date.now() - 120000
      }
    ]
    
    // Add mock rooms to the game state manager for testing
    mockRooms.forEach(room => {
      gameStateManager.roomsMap.set(room.id, room)
    })
    
    // Update the available rooms state
    const available = gameStateManager.getAvailableRooms()
    setAvailableRooms(available)
  }

  // Filter available rooms based on search query
  const filteredAvailableRooms = roomSearchQuery.trim()
    ? gameStateManager.searchRooms(roomSearchQuery).filter(room => room.gameState === "waiting")
    : availableRooms

  const createRoom = async () => {
    if (!newRoomName.trim() || !newRoomBet || !currentAccount) return

    setCreatingRoom(true)
    try {
      console.log("[v0] Creating room with modern SUI transaction...")

      const roomId = Math.random().toString(36).substr(2, 9)
      const betAmount = Number.parseFloat(newRoomBet)

      const room = await gameStateManager.createRoom(
        roomId,
        newRoomName.trim(),
        betAmount,
        currentAccount.address,
        signAndExecuteTransaction,
      )

      setRooms((prev) => [...prev, room])
      setNewRoomName("")
      setNewRoomBet("0.1")
      loadAvailableRooms() // Refresh available rooms
      loadMyRooms() // Refresh my rooms

      console.log("[v0] Room created successfully, redirecting...")
      router.push(`/game/${roomId}`)
    } catch (error) {
      console.error("[v0] Failed to create room:", error)
      alert(`Failed to create room: ${error.message}`)
    } finally {
      setCreatingRoom(false)
    }
  }

  const joinRoom = async () => {
    if (!joinRoomId.trim() || !currentAccount) return

    setJoiningRoom(true)
    try {
      console.log("[v0] Joining room with modern SUI transaction...")

      // Extract treasury ID from URL if the input is a full URL
      let roomIdToJoin = joinRoomId.trim()
      let treasuryIdFromUrl: string | undefined

      if (joinRoomId.includes('/game/') && joinRoomId.includes('treasury=')) {
        const url = new URL(joinRoomId)
        const pathParts = url.pathname.split('/')
        roomIdToJoin = pathParts[pathParts.length - 1]
        treasuryIdFromUrl = url.searchParams.get('treasury') || undefined
        console.log("[v0] Extracted room ID:", roomIdToJoin, "treasury:", treasuryIdFromUrl)
      }

      const room = await gameStateManager.joinRoom(
        roomIdToJoin,
        currentAccount.address,
        signAndExecuteTransaction,
        treasuryIdFromUrl
      )

      setRooms((prev) => [...prev, room])
      setJoinRoomId("")
      loadAvailableRooms() // Refresh available rooms
      loadMyRooms() // Refresh my rooms

      console.log("[v0] Joined room successfully, redirecting...")
      router.push(`/game/${roomIdToJoin}${treasuryIdFromUrl ? `?treasury=${treasuryIdFromUrl}` : ''}`)
    } catch (error) {
      console.error("[v0] Failed to join room:", error)
      
      // Provide more user-friendly error messages
      let userMessage = "Failed to join room"
      if (error.message.includes("not found")) {
        userMessage = "Room not found. Please check the room ID or share link and try again."
      } else if (error.message.includes("full")) {
        userMessage = "This room is already full. Please try joining a different room."
      } else if (error.message.includes("already in room")) {
        userMessage = "You are already in this room."
      } else if (error.message.includes("Treasury")) {
        userMessage = "Unable to access room treasury. The room may be invalid or expired."
      } else if (error.message.includes("Transaction failed")) {
        userMessage = "Transaction failed. Please check your wallet connection and try again."
      } else if (error.message.includes("Failed to retrieve room information")) {
        userMessage = "Unable to retrieve room information. Please check your internet connection and try again."
      } else {
        userMessage = `Failed to join room: ${error.message}`
      }
      
      alert(userMessage)
    } finally {
      setJoiningRoom(false)
    }
  }

  const joinRoomDirectly = async (room: any) => {
    if (!currentAccount) return

    setJoiningRoom(true)
    try {
      console.log("[v0] Joining room directly:", room.id)

      const joinedRoom = await gameStateManager.joinRoom(
        room.id,
        currentAccount.address,
        signAndExecuteTransaction,
        room.treasuryId
      )

      setRooms((prev) => [...prev, joinedRoom])
      loadAvailableRooms() // Refresh available rooms
      loadMyRooms() // Refresh my rooms

      console.log("[v0] Joined room successfully, redirecting...")
      router.push(`/game/${room.id}${room.treasuryId ? `?treasury=${room.treasuryId}` : ''}`)
    } catch (error) {
      console.error("[v0] Failed to join room:", error)
      
      // Provide more user-friendly error messages
      let userMessage = "Failed to join room"
      if (error.message.includes("not found")) {
        userMessage = "Room not found. Please try refreshing the page."
      } else if (error.message.includes("full")) {
        userMessage = "This room is already full. Please try a different room."
      } else if (error.message.includes("already in room")) {
        userMessage = "You are already in this room."
      } else if (error.message.includes("Treasury")) {
        userMessage = "Unable to access room treasury. The room may be invalid."
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

          <div className="flex justify-center mb-8">
            <WalletConnect />
          </div>

          {/* Show Available Rooms even without wallet connection for demonstration */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Available Rooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="roomSearch">Search Rooms</Label>
                  <Input
                    id="roomSearch"
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    placeholder="Search by room name or ID..."
                    className="mb-4"
                  />
                </div>
                
                {filteredAvailableRooms.length > 0 ? (
                  <div className="space-y-3">
                    {filteredAvailableRooms.map((room) => (
                      <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex-1">
                          <h4 className="font-semibold">{room.name}</h4>
                          <p className="text-sm text-muted-foreground">Room ID: {room.id}</p>
                          {room.treasuryId && (
                            <p className="text-xs text-muted-foreground">Treasury: {room.treasuryId.slice(0, 8)}...</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              <Coins className="w-3 h-3 mr-1" />
                              {room.betAmount} SUI
                            </Badge>
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" />
                              Waiting for player
                            </Badge>
                            <Badge variant="outline">
                              <Users className="w-3 h-3 mr-1" />
                              {room.players.length}/2
                            </Badge>
                          </div>
                        </div>
                        <div className="ml-4">
                          <Button disabled variant="outline">
                            Connect Wallet to Join
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {roomSearchQuery.trim() ? (
                      <p>No rooms found matching "{roomSearchQuery}"</p>
                    ) : (
                      <p>No available rooms at the moment. Connect your wallet to create one!</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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

          <div className="flex justify-center mb-8">
            <WalletConnect />
          </div>

          {!isContractConfigured && (
            <Alert className="mb-8 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Smart Contract Not Configured</AlertTitle>
              <AlertDescription className="text-amber-700">
                To use the betting functionality, you need to deploy a smart contract and set the{" "}
                <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_CONTRACT_PACKAGE_ID</code> environment variable.
                See the{" "}
                <a href="/DEPLOYMENT.md" className="underline font-medium">deployment guide</a>{" "}
                for instructions.
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
                Create Room
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter room name"
                  disabled={creatingRoom}
                />
              </div>
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
              <Button onClick={createRoom} className="w-full" disabled={!newRoomName.trim() || creatingRoom || !isContractConfigured}>
                {creatingRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Room...
                  </>
                ) : (
                  "Create Room & Enter"
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
                Join Room
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="roomId">Room ID or Share Link</Label>
                <Input
                  id="roomId"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Enter room ID or paste share link"
                  disabled={joiningRoom}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You can paste either the room ID or the full share link with treasury information
                </p>
              </div>
              <Button onClick={joinRoom} className="w-full" disabled={!joinRoomId.trim() || joiningRoom || !isContractConfigured}>
                {joiningRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining Room...
                  </>
                ) : (
                  "Join Room"
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
                Cryptographic proof system ensures fair play and secure prize distribution
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

        {/* Available Rooms Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Available Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="roomSearch">Search Rooms</Label>
                <Input
                  id="roomSearch"
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                  placeholder="Search by room name or ID..."
                  className="mb-4"
                />
              </div>
              
              {filteredAvailableRooms.length > 0 ? (
                <div className="space-y-3">
                  {filteredAvailableRooms.map((room) => (
                    <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <h4 className="font-semibold">{room.name}</h4>
                        <p className="text-sm text-muted-foreground">Room ID: {room.id}</p>
                        {room.treasuryId && (
                          <p className="text-xs text-muted-foreground">Treasury: {room.treasuryId.slice(0, 8)}...</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            <Coins className="w-3 h-3 mr-1" />
                            {room.betAmount} SUI
                          </Badge>
                          <Badge variant="secondary">
                            <Clock className="w-3 h-3 mr-1" />
                            Waiting for player
                          </Badge>
                          <Badge variant="outline">
                            <Users className="w-3 h-3 mr-1" />
                            {room.players.length}/2
                          </Badge>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Button 
                          onClick={() => joinRoomDirectly(room)} 
                          disabled={joiningRoom || !isContractConfigured}
                          variant="default"
                        >
                          {joiningRoom ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Joining...
                            </>
                          ) : (
                            "Join Room"
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {roomSearchQuery.trim() ? (
                    <p>No rooms found matching "{roomSearchQuery}"</p>
                  ) : (
                    <p>No available rooms at the moment. Create one above!</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* My Rooms Section */}
        {myRooms.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                My Rooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myRooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-semibold">{room.name}</h4>
                      <p className="text-sm text-muted-foreground">Room ID: {room.id}</p>
                      {room.treasuryId && (
                        <p className="text-xs text-muted-foreground">Treasury: {room.treasuryId.slice(0, 8)}...</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">
                          <Coins className="w-3 h-3 mr-1" />
                          {room.betAmount} SUI
                        </Badge>
                        <Badge variant={room.gameState === "playing" ? "default" : room.gameState === "waiting" ? "secondary" : "outline"}>
                          {room.gameState === "waiting" ? "Waiting for player" : 
                           room.gameState === "playing" ? "Game in progress" : 
                           "Game finished"}
                        </Badge>
                        <Badge variant="outline">
                          <Users className="w-3 h-3 mr-1" />
                          {room.players.length}/2
                        </Badge>
                      </div>
                    </div>
                    <div className="ml-4">
                      <Link href={`/game/${room.id}${room.treasuryId ? `?treasury=${room.treasuryId}` : ''}`}>
                        <Button variant="default">
                          {room.gameState === "waiting" ? "Enter Room" : 
                           room.gameState === "playing" ? "Continue Game" : 
                           "View Results"}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {rooms.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Rooms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-semibold">{room.name || `Room ${room.id}`}</h4>
                      <p className="text-sm text-muted-foreground">Room ID: {room.id}</p>
                      {room.treasuryId && (
                        <p className="text-xs text-muted-foreground">Treasury: {room.treasuryId.slice(0, 8)}...</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">
                          <Coins className="w-3 h-3 mr-1" />
                          {room.betAmount} SUI
                        </Badge>
                        <Badge variant={room.gameState === "playing" ? "default" : "secondary"}>{room.gameState}</Badge>
                      </div>
                    </div>
                    <Link href={`/game/${room.id}`}>
                      <Button>{room.gameState === "waiting" ? "Enter Room" : "Continue Game"}</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
