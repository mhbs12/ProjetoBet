import { Transaction } from "@mysten/sui/transactions"
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"

const NETWORK = "testnet" // Change to 'mainnet' for production
const CONTRACT_PACKAGE_ID = process.env.NEXT_PUBLIC_CONTRACT_PACKAGE_ID

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

      const [coin] = tx.splitCoins(tx.gas, [betAmount * 1000000000])

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

      const [coin] = tx.splitCoins(tx.gas, [betAmount * 1000000000])

      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::teste2::entrar_aposta`,
        arguments: [treasuryId, coin],
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

      tx.moveCall({
        target: `${CONTRACT_PACKAGE_ID}::teste2::finish_game`,
        arguments: [winnerAddress, treasuryId],
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
}

export const suiContract = new SuiGameContract()
