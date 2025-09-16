import { Transaction } from "@mysten/sui/transactions"
import { SuiClient } from "@mysten/sui/client"
import { getCurrentNetwork, getCurrentNetworkUrl, getNetworkInfo } from "@/lib/network-config"

const NETWORK = getCurrentNetwork()
const CONTRACT_PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID
const DEFAULT_GAS_BUDGET = parseInt(process.env.NEXT_PUBLIC_DEFAULT_GAS_BUDGET || "10000000") // 0.01 SUI default

export class SuiGameContract {
  private client: SuiClient

  constructor() {
    this.client = new SuiClient({ url: getCurrentNetworkUrl() })
    
    // Log network configuration for debugging
    if (typeof window !== "undefined") {
      const networkInfo = getNetworkInfo()
      console.log(`[v0] SUI Client initialized for network: ${networkInfo.network}`)
      console.log(`[v0] SUI Client URL: ${networkInfo.endpoint}`)
      console.log(`[v0] SUI Package ID: ${CONTRACT_PACKAGE_ID || 'NOT CONFIGURED'}`)
    }
  }

  private validateContract(): boolean {
    if (!CONTRACT_PACKAGE_ID) {
      if (typeof window !== "undefined") {
        console.error("[v0] SUI package ID not configured. Cannot execute blockchain transactions.")
        console.error("[v0] Please set NEXT_PUBLIC_SUI_PACKAGE_ID in your environment variables.")
        console.error("[v0] Example: NEXT_PUBLIC_SUI_PACKAGE_ID=0x1234567890abcdef1234567890abcdef12345678")
        console.error(`[v0] Current network: ${NETWORK}`)
        console.error(`[v0] Current SUI endpoint: ${getCurrentNetworkUrl()}`)
      }
      return false
    }
    return true
  }

  getNetworkInfo() {
    const networkInfo = getNetworkInfo()
    return {
      network: networkInfo.network,
      endpoint: networkInfo.endpoint,
      suiPackageId: CONTRACT_PACKAGE_ID,
      gasbudget: DEFAULT_GAS_BUDGET,
      isTestnet: networkInfo.isTestnet,
      isMainnet: networkInfo.isMainnet,
      isDevnet: networkInfo.isDevnet,
    }
  }

  async createRoom(walletAddress: string, betAmount: number, signAndExecuteTransaction: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_SUI_PACKAGE_ID environment variable.")
    }

    // Validate inputs
    if (!walletAddress) {
      throw new Error("Wallet address is required")
    }
    
    if (betAmount <= 0) {
      throw new Error("Bet amount must be greater than 0")
    }
    
    if (betAmount < 0.001) {
      throw new Error("Minimum bet amount is 0.001 SUI")
    }

    try {
      console.log(`[v0] Creating room using new Room system: wallet=${walletAddress}, amount=${betAmount} SUI`)
      
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Call the create_room function from the new Sui Move contract
      // This creates a Room object with the caller as player1
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::game::create_room`,
        arguments: [],
      })

      console.log(`[v0] Transaction prepared, calling smart contract: ${CONTRACT_PACKAGE_ID}::game::create_room`)

      // Execute the transaction using the modern dapp-kit pattern
      // The signAndExecuteTransaction is a mutate function that returns a promise
      return new Promise((resolve, reject) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result: any) => {
              console.log(`[v0] Room creation transaction successful with digest: ${result.digest}`)
              resolve(result)
            },
            onError: (error: any) => {
              console.error(`[v0] Room creation transaction failed:`, error)
              reject(error)
            },
          }
        )
      })
    } catch (error) {
      console.error("Error creating room:", error)
      
      // Provide more helpful error messages
      let userFriendlyMessage = "Failed to create room"
      
      if (error.message.includes("Contract not configured")) {
        userFriendlyMessage = "Smart contract not configured. Please contact the administrator."
      } else if (error.message.includes("Insufficient")) {
        userFriendlyMessage = "Insufficient SUI balance. Please add more SUI to your wallet."
      } else if (error.message.includes("Gas")) {
        userFriendlyMessage = "Transaction failed due to gas issues. Please try again."
      }
      
      throw new Error(userFriendlyMessage)
    }
  }

  async joinRoom(roomId: string, betAmount: number, signAndExecuteTransaction: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_SUI_PACKAGE_ID environment variable.")
    }

    // Validate inputs
    if (!roomId) {
      throw new Error("Room ID is required")
    }
    
    if (betAmount <= 0) {
      throw new Error("Bet amount must be greater than 0")
    }

    try {
      console.log(`[v0] Joining room using new Room system: roomId=${roomId}, amount=${betAmount} SUI`)
      
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Call the join_room function from the new Sui Move contract
      // This adds the caller as player2 to the existing Room object
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::game::join_room`,
        arguments: [tx.object(roomId)],
      })

      console.log(`[v0] Transaction prepared, calling smart contract: ${CONTRACT_PACKAGE_ID}::game::join_room with room ${roomId}`)

      // Execute the transaction using the modern dapp-kit pattern
      return new Promise((resolve, reject) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result: any) => {
              console.log(`[v0] Join room transaction successful with digest: ${result.digest}`)
              resolve(result)
            },
            onError: (error: any) => {
              console.error(`[v0] Join room transaction failed:`, error)
              reject(error)
            },
          }
        )
      })
    } catch (error) {
      console.error("Error joining room:", error)
      
      // Provide more helpful error messages
      let userFriendlyMessage = "Failed to join room"
      
      if (error.message.includes("Contract not configured")) {
        userFriendlyMessage = "Smart contract not configured. Please contact the administrator."
      } else if (error.message.includes("ERoomFull")) {
        userFriendlyMessage = "This room is already full. Please try joining a different room."
      } else if (error.message.includes("object")) {
        userFriendlyMessage = "Invalid room ID. The room may no longer exist."
      } else if (error.message.includes("Insufficient")) {
        userFriendlyMessage = "Insufficient SUI balance. Please add more SUI to your wallet."
      }
      
      throw new Error(userFriendlyMessage)
    }
  }

  async finishGame(treasuryId: string, winnerAddress: string, signAndExecuteTransaction: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_SUI_PACKAGE_ID.")
    }

    try {
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Call the move function with correct arguments order: winner_address first, then treasury
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::bet::finish_game`,
        arguments: [tx.pure.address(winnerAddress), tx.object(treasuryId)],
      })

      // Execute the transaction using the modern dapp-kit pattern
      return new Promise((resolve, reject) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result: any) => {
              console.log(`[v0] Finish game transaction successful with digest: ${result.digest}`)
              resolve(result)
            },
            onError: (error: any) => {
              console.error(`[v0] Finish game transaction failed:`, error)
              reject(error)
            },
          }
        )
      })
    } catch (error) {
      console.error("Error finishing game:", error)
      throw error
    }
  }

  /**
   * List all available Room objects from the blockchain
   */
  async listRooms() {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Cannot query rooms.")
    }

    try {
      console.log("[v0] Querying all Room objects from blockchain...")
      
      // Query all objects of the Room type
      const roomType = `${CONTRACT_PACKAGE_ID}::game::Room`
      
      const response = await this.client.getOwnedObjects({
        filter: {
          StructType: roomType
        },
        options: {
          showContent: true,
          showType: true,
        },
      })

      console.log(`[v0] Found ${response.data.length} Room objects`)

      const rooms = response.data
        .filter(obj => obj.data?.content?.dataType === "moveObject")
        .map(obj => {
          const content = obj.data?.content as any
          const fields = content.fields
          
          return {
            id: obj.data?.objectId,
            player1: fields.player1,
            player2: fields.player2?.vec?.[0] || null, // Option<address> is represented as {vec: [...]} or {vec: []}
            isFull: !!fields.player2?.vec?.[0],
            type: roomType,
          }
        })

      console.log("[v0] Processed rooms:", rooms)
      return rooms
    } catch (error) {
      console.error("Error listing rooms:", error)
      return []
    }
  }

  /**
   * Get detailed information about a specific Room object
   */
  async getRoomInfo(roomId: string) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Cannot query room.")
    }

    try {
      console.log(`[v0] Getting room info for: ${roomId}`)
      
      const object = await this.client.getObject({
        id: roomId,
        options: { showContent: true, showType: true },
      })

      if (!object.data) {
        console.warn(`[v0] Room object not found: ${roomId}`)
        throw new Error(`Room not found: ${roomId}`)
      }

      if (object.data.content?.dataType === "moveObject") {
        const fields = (object.data.content as any).fields
        
        if (!fields) {
          console.warn(`[v0] Invalid room structure:`, fields)
          throw new Error(`Invalid room structure`)
        }
        
        const roomInfo = {
          id: roomId,
          player1: fields.player1,
          player2: fields.player2?.vec?.[0] || null, // Option<address> handling
          isFull: !!fields.player2?.vec?.[0],
          isActive: true,
          type: object.data.type,
        }
        
        console.log(`[v0] Room info retrieved successfully:`, roomInfo)
        return roomInfo
      }

      console.warn(`[v0] Room object has unexpected data type:`, object.data.content?.dataType)
      throw new Error(`Invalid room object type`)
    } catch (error) {
      console.error(`[v0] Error getting room info:`, error)
      throw new Error(`Failed to get room info: ${error.message}`)
    }
  }

  /**
   * Get Room ID from transaction result (for room creation)
   */
  async getRoomFromTransaction(transactionDigest: string) {
    try {
      console.log(`[v0] Retrieving room ID from transaction:`, transactionDigest)
      
      const transaction = await this.client.getTransactionBlock({
        digest: transactionDigest,
        options: { showObjectChanges: true, showEffects: true },
      })

      if (transaction.objectChanges) {
        console.log(`[v0] Analyzing object changes for room:`, JSON.stringify(transaction.objectChanges, null, 2))
        
        // Look for created Room objects
        const roomType = `${CONTRACT_PACKAGE_ID}::game::Room`
        
        // Strategy 1: Look for objects with exact Room type
        let roomObject = transaction.objectChanges.find(
          (change: any) => change.type === "created" && 
          change.objectType === roomType
        )
        
        // Strategy 2: Look for objects containing "Room" in the type
        if (!roomObject) {
          roomObject = transaction.objectChanges.find(
            (change: any) => change.type === "created" && change.objectType && 
            change.objectType.includes("Room")
          )
        }
        
        // Strategy 3: Look for any shared object (Room is shared via transfer::share_object)
        if (!roomObject) {
          roomObject = transaction.objectChanges.find(
            (change: any) => change.type === "created" && change.objectId && 
            change.objectType && change.objectType.includes("::game::")
          )
        }
        
        if (roomObject?.objectId) {
          console.log(`[v0] Room ID found in transaction:`, roomObject.objectId)
          console.log(`[v0] Room object details:`, roomObject)
          return roomObject.objectId
        }
      }
      
      console.warn(`[v0] No room object found in transaction:`, transactionDigest)
      return null
    } catch (error) {
      console.error(`[v0] Error retrieving room from transaction:`, error)
      return null
    }
  }

  async getTreasuryBalance(treasuryId: string) {
    // Legacy method - redirect to room info for compatibility
    try {
      const roomInfo = await this.getRoomInfo(treasuryId)
      return roomInfo ? 1 : 0 // Simplified: room exists or not
    } catch (error) {
      console.error("Error getting room balance:", error)
      return 0
    }
  }

  async getTreasuryInfo(roomId: string, retries = 3) {
    // Legacy method - redirect to room info for compatibility
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[v0] Getting room info (compatibility mode) (attempt ${attempt}/${retries}):`, roomId)
        
        const roomInfo = await this.getRoomInfo(roomId)
        
        if (!roomInfo) {
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
            continue
          }
          throw new Error(`Room not found: ${roomId}`)
        }
        
        // Convert room info to legacy treasury format for compatibility
        const legacyInfo = {
          balance: 1, // Simplified
          betAmount: 0.1, // Default bet amount
          treasuryId: roomId,
          isActive: true,
          roomInfo // Include actual room info
        }
        
        console.log(`[v0] Room info retrieved successfully (compatibility mode):`, legacyInfo)
        return legacyInfo
      } catch (error) {
        console.error(`[v0] Error getting room info (attempt ${attempt}/${retries}):`, error)
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        
        throw new Error(`Failed to get room info after ${retries} attempts: ${error.message}`)
      }
    }
    
    return null
  }

  async getTreasuryFromTransaction(transactionDigest: string) {
    // Legacy method - redirect to room extraction for compatibility
    return this.getRoomFromTransaction(transactionDigest)
  }
}

export const suiContract = new SuiGameContract()
