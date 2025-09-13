"use client"

import type React from "react"
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit"
import { getFullnodeUrl } from "@mysten/sui/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const networks = {
  devnet: { url: getFullnodeUrl("devnet") },
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
}

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="devnet">
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
