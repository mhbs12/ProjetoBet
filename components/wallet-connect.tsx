"use client"

import { useCurrentAccount, useDisconnectWallet, useConnectWallet, useWallets } from "@mysten/dapp-kit"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wallet, LogOut, Coins } from "lucide-react"
import { useEffect } from "react"

export function WalletConnect() {
  const currentAccount = useCurrentAccount()
  const { mutate: disconnect } = useDisconnectWallet()
  const connectWalletMutation = useConnectWallet()
  const wallets = useWallets()

  useEffect(() => {
    console.log("[v0] Current account:", currentAccount)
    console.log("[v0] Wallet connection state:", !!currentAccount)
    console.log(
      "[v0] Available wallets:",
      wallets.map((w) => w.name),
    )
  }, [currentAccount, wallets])

  const handleConnect = async () => {
    console.log("[v0] Connect button clicked")

    try {
      if (wallets.length > 0) {
        console.log("[v0] Attempting to connect to:", wallets[0].name)
        // Use the connect mutation with correct API for dapp-kit v0.18.0
        connectWalletMutation.mutate(
          { wallet: wallets[0] },
          {
            onSuccess: () => {
              console.log("[v0] Wallet connected successfully")
            },
            onError: (error) => {
              console.error("[v0] Wallet connection failed:", error)
            },
          },
        )
      } else {
        console.log("[v0] No wallets available")
      }
    } catch (error) {
      console.error("[v0] Connection error:", error)
    }
  }

  if (!currentAccount) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Connect SUI Wallet</h3>
          <p className="text-muted-foreground mb-4">Connect your SUI wallet to start playing and betting</p>

          <Button onClick={handleConnect} disabled={connectWalletMutation.isPending || wallets.length === 0} className="w-full">
            {connectWalletMutation.isPending ? "Connecting..." : "Connect Wallet"}
          </Button>

          {wallets.length === 0 && (
            <p className="text-xs text-red-500 mt-2">No SUI wallets detected. Please install a SUI wallet extension.</p>
          )}

          <p className="text-xs text-muted-foreground mt-3">
            Supports all SUI wallets including Slush, Suiet, Ethos, and Martian
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <Badge variant="secondary">Connected</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              console.log("[v0] Disconnect button clicked")
              disconnect()
            }}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Address</p>
            <p className="font-mono text-sm">
              {currentAccount.address?.slice(0, 6)}...{currentAccount.address?.slice(-4)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-accent" />
            <span className="font-semibold">Connected to SUI</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
