export class SUIWallet {
  private static instance: SUIWallet
  private connected = false
  private address: string | null = null

  constructor() {}

  static getInstance(): SUIWallet {
    if (!SUIWallet.instance) {
      SUIWallet.instance = new SUIWallet()
    }
    return SUIWallet.instance
  }

  getState() {
    return {
      connected: this.connected,
      address: this.address,
      signAndExecuteTransactionBlock: this.connected ? this.signAndExecuteTransactionBlock.bind(this) : null,
    }
  }

  setConnectionState(connected: boolean, address: string | null = null) {
    this.connected = connected
    this.address = address
  }

  async executeTransaction(account: string, transactionData: any): Promise<any> {
    try {
      console.log("[v0] Executing SUI transaction for account:", account)

      if (typeof window === "undefined") {
        throw new Error("Window not available (SSR)")
      }

      const wallet = (window as any).slush || (window as any).suiWallet || (window as any).suiet

      if (!wallet) {
        throw new Error("No SUI wallet found")
      }

      const result = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: transactionData,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })

      console.log("[v0] Transaction successful:", result)
      return result
    } catch (error) {
      console.error("[v0] Transaction failed:", error)
      throw error
    }
  }

  async getBalance(address: string): Promise<number> {
    try {
      console.log("[v0] Getting balance for:", address)
      return 10.5 // Mock balance
    } catch (error) {
      console.error("[v0] Failed to get balance:", error)
      return 0
    }
  }

  async getConnectedAccount(): Promise<string | null> {
    try {
      if (typeof window === "undefined") {
        return null
      }

      const wallet = (window as any).slush || (window as any).suiWallet || (window as any).suiet
      if (!wallet) return null

      const accounts = await wallet.getAccounts()
      return accounts && accounts.length > 0 ? accounts[0] : null
    } catch (error) {
      return null
    }
  }

  async signAndExecuteTransactionBlock(transactionData: any): Promise<any> {
    if (typeof window === "undefined") {
      throw new Error("Window not available (SSR)")
    }

    const wallet = (window as any).slush || (window as any).suiWallet || (window as any).suiet
    if (!wallet) {
      throw new Error("No SUI wallet found")
    }

    return await wallet.signAndExecuteTransactionBlock(transactionData)
  }
}

export const suiWallet = SUIWallet.getInstance()
