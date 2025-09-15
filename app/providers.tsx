"use client"

import type React from "react"
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getCurrentNetwork, getNetworkConfig, logNetworkConfig } from "@/lib/network-config"

const networks = getNetworkConfig()
const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  // Get the current network from environment variable
  const currentNetwork = getCurrentNetwork()
  
  // Log network configuration for debugging
  if (typeof window !== "undefined") {
    logNetworkConfig()
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork={currentNetwork}>
        <WalletProvider
          autoConnect={true}
          preferredWallets={["Slush Wallet", "Suiet Wallet", "Ethos Wallet", "Martian Wallet"]}
        >
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}
