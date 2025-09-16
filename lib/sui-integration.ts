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
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
      throw new Error("Valid wallet address is required. Please ensure your wallet is connected.")
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
        target: `${CONTRACT_PACKAGE_ID}::twoproom::create_room`,
        arguments: [],
      })

      console.log(`[v0] Transaction prepared, calling smart contract: ${CONTRACT_PACKAGE_ID}::twoproom::create_room`)

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
      } else if (error.message.includes("Invalid Sui address") || error.message.includes("wallet address")) {
        userFriendlyMessage = "Invalid wallet connection. Please reconnect your wallet and try again."
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
        target: `${CONTRACT_PACKAGE_ID}::twoproom::join_room`,
        arguments: [tx.object(roomId)],
      })

      console.log(`[v0] Transaction prepared, calling smart contract: ${CONTRACT_PACKAGE_ID}::twoproom::join_room with room ${roomId}`)

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
        target: `${CONTRACT_PACKAGE_ID}::main::finish_game`,
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
   * Validate a Sui address format
   */
  private isValidSuiAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false
    }
    
    // Basic validation - Sui addresses should be hex strings starting with 0x and 64 characters total
    const cleanAddress = address.trim()
    if (!cleanAddress.startsWith('0x')) {
      return false
    }
    
    // Check if it's a valid hex string of correct length (32 bytes = 64 hex chars + 0x prefix)
    const hexPart = cleanAddress.slice(2)
    if (hexPart.length !== 64) {
      return false
    }
    
    // Check if all characters are valid hex
    return /^[0-9a-fA-F]+$/.test(hexPart)
  }

  /**
   * Normalize a Sui address to ensure consistent format
   */
  private normalizeSuiAddress(address: string): string {
    if (!address) return address
    
    const cleanAddress = address.trim().toLowerCase()
    
    // If it doesn't start with 0x, add it
    if (!cleanAddress.startsWith('0x')) {
      return '0x' + cleanAddress.padStart(64, '0')
    }
    
    // If it's too short, pad with zeros
    if (cleanAddress.length < 66) {
      const hexPart = cleanAddress.slice(2)
      return '0x' + hexPart.padStart(64, '0')
    }
    
    return cleanAddress
  }

  /**
   * List all available Room objects from the blockchain
   * Note: This method requires a wallet address to query rooms because Sui requires an owner parameter
   */
  async listRooms(walletAddress?: string) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Cannot query rooms.")
    }

    if (!walletAddress) {
      console.warn("[v0] Cannot list rooms without wallet address - wallet connection required")
      return []
    }

    // Validate and normalize the wallet address before proceeding
    if (!this.isValidSuiAddress(walletAddress)) {
      console.error("[v0] Invalid wallet address format:", walletAddress)
      console.warn("[v0] Returning empty room list due to invalid address")
      return [] // Return empty array instead of throwing error to prevent UI crashes
    }

    const normalizedAddress = this.normalizeSuiAddress(walletAddress)
    
    try {
      console.log("[v0] Querying Room objects from blockchain for address:", normalizedAddress)
      
      // Query all objects of the Room type owned by the current user
      // Note: In Sui, we can only query objects owned by a specific address
      // For a complete room listing, we would need to use a different approach like indexing
      const roomType = `${CONTRACT_PACKAGE_ID}::twoproom::Room`
      
      const response = await this.client.getOwnedObjects({
        owner: normalizedAddress,
        filter: {
          StructType: roomType
        },
        options: {
          showContent: true,
          showType: true,
        },
      })

      console.log(`[v0] Found ${response.data.length} Room objects owned by user`)

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
      
      // Check if the error is due to invalid address
      if (error.message && error.message.includes("Invalid Sui address")) {
        console.error("[v0] Invalid wallet address provided:", walletAddress)
        console.error("[v0] Normalized address was:", normalizedAddress)
        console.warn("[v0] Returning empty room list due to address validation error")
        return [] // Return empty array instead of throwing error to prevent UI crashes
      }
      
      // For other errors, also return empty array to maintain stability
      console.warn("[v0] Returning empty room list due to query error")
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
   * Enhanced with multiple extraction strategies and better error handling
   */
  async getRoomFromTransaction(transactionDigest: string) {
    if (!transactionDigest) {
      console.error(`[v0] No transaction digest provided`)
      return null
    }

    try {
      console.log(`[v0] Retrieving room ID from transaction:`, transactionDigest)
      
      const transaction = await this.client.getTransactionBlock({
        digest: transactionDigest,
        options: { 
          showObjectChanges: true, 
          showEffects: true,
          showInput: true,
          showEvents: true 
        },
      })

      console.log(`[v0] Transaction details:`, {
        digest: transactionDigest,
        status: transaction.effects?.status,
        objectChangesCount: transaction.objectChanges?.length || 0,
        eventsCount: transaction.events?.length || 0
      })

      if (transaction.objectChanges && transaction.objectChanges.length > 0) {
        console.log(`[v0] Analyzing object changes for room:`, JSON.stringify(transaction.objectChanges, null, 2))
        
        // Look for created Room objects with multiple strategies
        const roomType = `${CONTRACT_PACKAGE_ID}::twoproom::Room`
        let roomObject = null
        
        // Strategy 1: Look for objects with exact Room type
        roomObject = transaction.objectChanges.find(
          (change: any) => change.type === "created" && 
          change.objectType === roomType
        )
        
        if (roomObject) {
          console.log(`[v0] Strategy 1 success - exact Room type match:`, roomObject)
        }
        
        // Strategy 2: Look for objects containing "Room" in the type (case insensitive)
        if (!roomObject) {
          roomObject = transaction.objectChanges.find(
            (change: any) => change.type === "created" && change.objectType && 
            change.objectType.toLowerCase().includes("room")
          )
          if (roomObject) {
            console.log(`[v0] Strategy 2 success - Room in type name:`, roomObject)
          }
        }
        
        // Strategy 3: Look for objects from the twoproom module 
        if (!roomObject) {
          roomObject = transaction.objectChanges.find(
            (change: any) => change.type === "created" && change.objectType && 
            change.objectType.includes("::twoproom::")
          )
          if (roomObject) {
            console.log(`[v0] Strategy 3 success - twoproom module:`, roomObject)
          }
        }
        
        // Strategy 4: Look for any created object that might be a Room (fallback)
        if (!roomObject) {
          roomObject = transaction.objectChanges.find(
            (change: any) => change.type === "created" && change.objectId
          )
          if (roomObject) {
            console.log(`[v0] Strategy 4 (fallback) - any created object:`, roomObject)
          }
        }
        
        // Strategy 5: Look for shared objects (Room objects are often shared)
        if (!roomObject) {
          roomObject = transaction.objectChanges.find(
            (change: any) => (change.type === "created" || change.type === "mutated") && 
            change.objectId && change.sender
          )
          if (roomObject) {
            console.log(`[v0] Strategy 5 success - shared object:`, roomObject)
          }
        }
        
        if (roomObject?.objectId) {
          console.log(`[v0] Room ID extracted successfully:`, roomObject.objectId)
          console.log(`[v0] Room object full details:`, roomObject)
          
          // Validate the extracted object ID
          if (this.isValidObjectId(roomObject.objectId)) {
            return roomObject.objectId
          } else {
            console.error(`[v0] Extracted object ID is invalid:`, roomObject.objectId)
          }
        } else {
          console.warn(`[v0] No room object found in object changes`)
        }
      } else {
        console.warn(`[v0] No object changes found in transaction`)
      }

      // Check transaction events as an additional strategy
      if (transaction.events && transaction.events.length > 0) {
        console.log(`[v0] Checking transaction events for room creation:`, transaction.events)
        
        for (const event of transaction.events) {
          if (event.type && event.type.includes("Room") && event.parsedJson) {
            console.log(`[v0] Found room-related event:`, event)
            // Try to extract room ID from event data
            const eventData = event.parsedJson as any
            if (eventData.room_id || eventData.id) {
              const roomId = eventData.room_id || eventData.id
              console.log(`[v0] Room ID found in event:`, roomId)
              if (this.isValidObjectId(roomId)) {
                return roomId
              }
            }
          }
        }
      }
      
      console.error(`[v0] Failed to extract room ID from transaction using all strategies`)
      console.error(`[v0] Transaction digest:`, transactionDigest)
      console.error(`[v0] Available object changes:`, transaction.objectChanges?.map(c => ({
        type: c.type,
        objectType: (c as any).objectType,
        objectId: (c as any).objectId
      })))
      
      return null
    } catch (error) {
      console.error(`[v0] Error retrieving room from transaction:`, error)
      console.error(`[v0] Transaction digest:`, transactionDigest)
      return null
    }
  }

  /**
   * Validate if a string is a valid Sui object ID
   */
  private isValidObjectId(objectId: string): boolean {
    if (!objectId || typeof objectId !== 'string') {
      return false
    }
    
    const cleanId = objectId.trim()
    
    // Sui object IDs should be hex strings starting with 0x
    if (!cleanId.startsWith('0x')) {
      return false
    }
    
    // Check if it's a valid hex string (allow different lengths as object IDs can vary)
    const hexPart = cleanId.slice(2)
    if (hexPart.length === 0) {
      return false
    }
    
    // Check if all characters are valid hex
    return /^[0-9a-fA-F]+$/.test(hexPart)
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
