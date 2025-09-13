import { Transaction } from "@mysten/sui/transactions"
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK as "testnet" | "mainnet") || "testnet"
const CONTRACT_PACKAGE_ID = process.env.NEXT_PUBLIC_CONTRACT_PACKAGE_ID
const DEFAULT_GAS_BUDGET = parseInt(process.env.NEXT_PUBLIC_DEFAULT_GAS_BUDGET || "10000000") // 0.01 SUI default

export class SuiGameContract {
  private client: SuiClient

  constructor() {
    this.client = new SuiClient({ url: getFullnodeUrl(NETWORK) })
  }

  private validateContract(): boolean {
    if (!CONTRACT_PACKAGE_ID) {
      if (typeof window !== "undefined") {
        console.error("[v0] Contract package ID not configured. Cannot execute blockchain transactions.")
        console.error("[v0] Please set NEXT_PUBLIC_CONTRACT_PACKAGE_ID in your environment variables.")
        console.error("[v0] Example: NEXT_PUBLIC_CONTRACT_PACKAGE_ID=0x1234567890abcdef1234567890abcdef12345678")
      }
      return false
    }
    return true
  }

  async createBettingRoom(walletAddress: string, betAmount: number, signAndExecuteCallback: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_PACKAGE_ID environment variable.")
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
      console.log(`[v0] Creating betting room: wallet=${walletAddress}, amount=${betAmount} SUI`)
      
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
      const amountInMist = BigInt(Math.floor(betAmount * 1000000000))
      
      console.log(`[v0] Converting ${betAmount} SUI to ${amountInMist} MIST`)
      
      // Split coins from gas to create the bet amount
      const [coin] = tx.splitCoins(tx.gas, [amountInMist])

      // Call the move function with correct arguments
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::teste2::criar_aposta`,
        arguments: [coin],
      })

      console.log(`[v0] Transaction prepared, calling smart contract: ${CONTRACT_PACKAGE_ID}::teste2::criar_aposta`)

      // Call the callback with the transaction object for modern dapp-kit
      const transactionData = {
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      }

      return signAndExecuteCallback(transactionData)
    } catch (error) {
      console.error("Error creating betting room:", error)
      
      // Provide more helpful error messages
      let userFriendlyMessage = "Failed to create betting room"
      
      if (error.message.includes("Contract not configured")) {
        userFriendlyMessage = "Smart contract not configured. Please contact the administrator."
      } else if (error.message.includes("Insufficient")) {
        userFriendlyMessage = "Insufficient SUI balance. Please add more SUI to your wallet."
      } else if (error.message.includes("Gas")) {
        userFriendlyMessage = "Transaction failed due to gas issues. Please try again with a smaller amount."
      } else if (error.message.includes("splitCoins")) {
        userFriendlyMessage = "Unable to prepare bet amount. Please check your wallet balance."
      }
      
      throw new Error(userFriendlyMessage)
    }
  }

  async joinBettingRoom(treasuryId: string, betAmount: number, signAndExecuteCallback: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_PACKAGE_ID environment variable.")
    }

    // Validate inputs
    if (!treasuryId) {
      throw new Error("Treasury ID is required")
    }
    
    if (betAmount <= 0) {
      throw new Error("Bet amount must be greater than 0")
    }

    try {
      console.log(`[v0] Joining betting room: treasury=${treasuryId}, amount=${betAmount} SUI`)
      
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
      const amountInMist = BigInt(Math.floor(betAmount * 1000000000))
      
      console.log(`[v0] Converting ${betAmount} SUI to ${amountInMist} MIST`)
      
      // Split coins from gas to create the bet amount
      const [coin] = tx.splitCoins(tx.gas, [amountInMist])

      // Call the move function with correct arguments order: treasury first, then coin
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::teste2::entrar_aposta`,
        arguments: [tx.object(treasuryId), coin],
      })

      console.log(`[v0] Transaction prepared, calling smart contract: ${CONTRACT_PACKAGE_ID}::teste2::entrar_aposta`)

      // Call the callback with the transaction object for modern dapp-kit
      const transactionData = {
        transaction: tx,
        options: {
          showEffects: true,
        },
      }

      return signAndExecuteCallback(transactionData)
    } catch (error) {
      console.error("Error joining betting room:", error)
      
      // Provide more helpful error messages
      let userFriendlyMessage = "Failed to join betting room"
      
      if (error.message.includes("Contract not configured")) {
        userFriendlyMessage = "Smart contract not configured. Please contact the administrator."
      } else if (error.message.includes("Insufficient")) {
        userFriendlyMessage = "Insufficient SUI balance. Please add more SUI to your wallet."
      } else if (error.message.includes("Gas")) {
        userFriendlyMessage = "Transaction failed due to gas issues. Please try again."
      } else if (error.message.includes("splitCoins")) {
        userFriendlyMessage = "Unable to prepare bet amount. Please check your wallet balance."
      } else if (error.message.includes("object")) {
        userFriendlyMessage = "Invalid treasury ID. The room may no longer exist."
      }
      
      throw new Error(userFriendlyMessage)
    }
  }

  async finishGame(treasuryId: string, winnerAddress: string, signAndExecuteCallback: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_PACKAGE_ID.")
    }

    try {
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Call the move function with correct arguments order: winner_address first, then treasury
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::teste2::finish_game`,
        arguments: [tx.pure.address(winnerAddress), tx.object(treasuryId)],
      })

      // Call the callback with the transaction object for modern dapp-kit
      const transactionData = {
        transaction: tx,
        options: {
          showEffects: true,
        },
      }

      return signAndExecuteCallback(transactionData)
    } catch (error) {
      console.error("Error finishing game:", error)
      throw error
    }
  }

  async getTreasuryBalance(treasuryId: string) {
    try {
      const object = await this.client.getObject({
        id: treasuryId,
        options: { showContent: true },
      })

      if (object.data?.content?.dataType === "moveObject") {
        const fields = (object.data.content as any).fields
        return Number.parseInt(fields.balance) / 1000000000 // Convert from MIST to SUI
      }

      return 0
    } catch (error) {
      console.error("Error getting treasury balance:", error)
      return 0
    }
  }

  async getTreasuryInfo(treasuryId: string, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[v0] Getting treasury info (attempt ${attempt}/${retries}):`, treasuryId)
        
        const object = await this.client.getObject({
          id: treasuryId,
          options: { showContent: true },
        })

        if (!object.data) {
          console.warn(`[v0] Treasury object not found: ${treasuryId}`)
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
            continue
          }
          throw new Error(`Treasury not found: ${treasuryId}`)
        }

        if (object.data.content?.dataType === "moveObject") {
          const fields = (object.data.content as any).fields
          
          if (!fields || !fields.balance) {
            console.warn(`[v0] Invalid treasury structure:`, fields)
            throw new Error(`Invalid treasury structure: missing balance field`)
          }
          
          const balance = Number.parseInt(fields.balance) / 1000000000 // Convert from MIST to SUI
          
          if (balance <= 0) {
            console.warn(`[v0] Treasury has no balance:`, balance)
            throw new Error(`Treasury is empty or invalid`)
          }
          
          // The bet amount should be half the current balance (since first player already deposited)
          const betAmount = balance / 2
          
          const treasuryInfo = {
            balance,
            betAmount,
            treasuryId,
            isActive: balance > 0
          }
          
          console.log(`[v0] Treasury info retrieved successfully:`, treasuryInfo)
          return treasuryInfo
        }

        console.warn(`[v0] Treasury object has unexpected data type:`, object.data.content?.dataType)
        throw new Error(`Invalid treasury object type`)
      } catch (error) {
        console.error(`[v0] Error getting treasury info (attempt ${attempt}/${retries}):`, error)
        
        if (attempt < retries) {
          // Exponential backoff: wait 1s, 2s, 3s between retries
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        
        // On final attempt, throw a more descriptive error
        throw new Error(`Failed to get treasury info after ${retries} attempts: ${error.message}`)
      }
    }
    
    return null
  }
}

export const suiContract = new SuiGameContract()
