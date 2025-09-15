/**
 * Network Configuration Utility
 * 
 * This module provides centralized network configuration for the entire application
 * ensuring that all parts of the app respect the NEXT_PUBLIC_SUI_NETWORK environment variable
 */

import { getFullnodeUrl } from "@mysten/sui/client"

export type SuiNetwork = "devnet" | "testnet" | "mainnet"

/**
 * Get the current network from environment variable with devnet as fallback
 */
export function getCurrentNetwork(): SuiNetwork {
  const network = process.env.NEXT_PUBLIC_SUI_NETWORK as SuiNetwork
  
  // Validate the network value
  if (network && ["devnet", "testnet", "mainnet"].includes(network)) {
    return network
  }
  
  // Default to devnet if not set or invalid
  console.warn(`[Network Config] Invalid or missing NEXT_PUBLIC_SUI_NETWORK: ${network}. Defaulting to devnet.`)
  return "devnet"
}

/**
 * Get the full node URL for the current network
 */
export function getCurrentNetworkUrl(): string {
  const network = getCurrentNetwork()
  return getFullnodeUrl(network)
}

/**
 * Get network configuration for all available networks
 */
export function getNetworkConfig() {
  return {
    devnet: { url: getFullnodeUrl("devnet") },
    testnet: { url: getFullnodeUrl("testnet") },
    mainnet: { url: getFullnodeUrl("mainnet") },
  }
}

/**
 * Get network info for debugging and display purposes
 */
export function getNetworkInfo() {
  const currentNetwork = getCurrentNetwork()
  const networkUrl = getCurrentNetworkUrl()
  
  return {
    network: currentNetwork,
    endpoint: networkUrl,
    isTestnet: currentNetwork === "testnet",
    isMainnet: currentNetwork === "mainnet",
    isDevnet: currentNetwork === "devnet",
  }
}

/**
 * Log network configuration for debugging
 */
export function logNetworkConfig() {
  const info = getNetworkInfo()
  console.log(`[Network Config] Current network: ${info.network}`)
  console.log(`[Network Config] Endpoint: ${info.endpoint}`)
  console.log(`[Network Config] Environment variable: ${process.env.NEXT_PUBLIC_SUI_NETWORK || 'not set'}`)
}