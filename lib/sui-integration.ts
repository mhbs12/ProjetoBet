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
      }
      return false
    }
    return true
  }

  async createBettingRoom(walletAddress: string, betAmount: number, signAndExecuteCallback: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_PACKAGE_ID.")
    }

    try {
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
      const amountInMist = BigInt(Math.floor(betAmount * 1000000000))
      
      // Split coins from gas to create the bet amount
      const [coin] = tx.splitCoins(tx.gas, [amountInMist])

      // Call the move function with correct arguments
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::teste2::criar_aposta`,
        arguments: [coin],
      })

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
      throw error
    }
  }

  async joinBettingRoom(treasuryId: string, betAmount: number, signAndExecuteCallback: any) {
    if (!this.validateContract()) {
      throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_PACKAGE_ID.")
    }

    try {
      const tx = new Transaction()
      
      // Set gas budget to avoid automatic calculation issues
      tx.setGasBudget(DEFAULT_GAS_BUDGET)

      // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
      const amountInMist = BigInt(Math.floor(betAmount * 1000000000))
      
      // Split coins from gas to create the bet amount
      const [coin] = tx.splitCoins(tx.gas, [amountInMist])

      // Call the move function with correct arguments order: treasury first, then coin
      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::teste2::entrar_aposta`,
        arguments: [tx.object(treasuryId), coin],
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
      console.error("Error joining betting room:", error)
      throw error
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

  async getTreasuryInfo(treasuryId: string) {
    try {
      const object = await this.client.getObject({
        id: treasuryId,
        options: { showContent: true },
      })

      if (object.data?.content?.dataType === "moveObject") {
        const fields = (object.data.content as any).fields
        const balance = Number.parseInt(fields.balance) / 1000000000 // Convert from MIST to SUI
        
        // The bet amount should be half the current balance (since first player already deposited)
        const betAmount = balance / 2
        
        return {
          balance,
          betAmount,
          treasuryId,
          isActive: balance > 0
        }
      }

      return null
    } catch (error) {
      console.error("Error getting treasury info:", error)
      return null
    }
  }
}

export const suiContract = new SuiGameContract()
