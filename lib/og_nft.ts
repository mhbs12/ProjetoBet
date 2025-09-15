/**
 * OG NFT Module
 * 
 * This module handles the minting functionality for OG NFTs using SUI Move blockchain
 */

import { Transaction } from "@mysten/sui/transactions"
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK as "devnet" | "testnet" | "mainnet") || "devnet"
const OG_NFT_PACKAGE_ID = process.env.NEXT_PUBLIC_OG_NFT_PACKAGE_ID
const DEFAULT_GAS_BUDGET = parseInt(process.env.NEXT_PUBLIC_DEFAULT_GAS_BUDGET || "10000000") // 0.01 SUI default

export interface MintResult {
  success: boolean;
  nftId?: string;
  transactionHash?: string;
  error?: string;
}

/**
 * Validates that the OG NFT package ID is configured
 */
function validateOGNFTPackage(): boolean {
  if (!OG_NFT_PACKAGE_ID) {
    if (typeof window !== "undefined") {
      console.error("[OG NFT] Package ID not configured. Cannot execute NFT minting transactions.")
      console.error("[OG NFT] Please set NEXT_PUBLIC_OG_NFT_PACKAGE_ID in your environment variables.")
      console.error("[OG NFT] Example: NEXT_PUBLIC_OG_NFT_PACKAGE_ID=0x1234567890abcdef1234567890abcdef12345678")
    }
    return false
  }
  return true
}

/**
 * Mint function for OG NFTs
 * This function calls the actual og_nft::mint function on the SUI blockchain
 * The NFT is free, has unlimited supply, and no rarity system
 */
export async function mint(signAndExecuteTransaction: any): Promise<MintResult> {
  try {
    console.log('[OG NFT] Starting real blockchain mint process...');
    
    if (!validateOGNFTPackage()) {
      throw new Error("OG NFT package not configured. Please set NEXT_PUBLIC_OG_NFT_PACKAGE_ID environment variable.")
    }

    if (!signAndExecuteTransaction) {
      throw new Error("Wallet connection required. Please connect your wallet first.")
    }

    // Create transaction for minting
    const tx = new Transaction()
    
    // Set gas budget to avoid automatic calculation issues
    tx.setGasBudget(DEFAULT_GAS_BUDGET)

    // Call the og_nft::mint function
    // Since the NFT is free and has no parameters, we just call the mint function
    tx.moveCall({
      target: `${OG_NFT_PACKAGE_ID}::og_nft::mint`,
      arguments: [], // No arguments needed for free mint with no parameters
    })

    console.log(`[OG NFT] Transaction prepared, calling smart contract: ${OG_NFT_PACKAGE_ID}::og_nft::mint`)

    // Execute the transaction using the modern dapp-kit pattern
    return new Promise((resolve, reject) => {
      signAndExecuteTransaction(
        {
          transaction: tx,
        },
        {
          onSuccess: (result: any) => {
            console.log(`[OG NFT] Mint transaction successful with digest: ${result.digest}`)
            
            // Try to extract NFT ID from the transaction result
            let nftId: string | undefined
            
            if (result.objectChanges) {
              const createdNFT = result.objectChanges.find(
                (change: any) => change.type === "created" && 
                change.objectType && 
                change.objectType.includes("::og_nft::")
              )
              
              if (createdNFT?.objectId) {
                nftId = createdNFT.objectId
                console.log(`[OG NFT] NFT created with ID: ${nftId}`)
              }
            }
            
            resolve({
              success: true,
              nftId,
              transactionHash: result.digest,
            })
          },
          onError: (error: any) => {
            console.error(`[OG NFT] Mint transaction failed:`, error)
            
            // Provide more helpful error messages
            let userFriendlyMessage = "Failed to mint OG NFT"
            
            if (error.message.includes("package") || error.message.includes("module")) {
              userFriendlyMessage = "OG NFT smart contract not found. Please check the package configuration."
            } else if (error.message.includes("Insufficient")) {
              userFriendlyMessage = "Insufficient SUI balance for gas fees. Please add more SUI to your wallet."
            } else if (error.message.includes("Gas")) {
              userFriendlyMessage = "Transaction failed due to gas issues. Please try again."
            }
            
            reject(new Error(userFriendlyMessage))
          },
        }
      )
    })
    
  } catch (error) {
    console.error('[OG NFT] Mint failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get mint statistics
 * Since the NFT is free and unlimited, we show appropriate stats
 */
export function getMintStats() {
  return {
    totalMinted: "∞", // Unlimited minting
    availableSupply: "∞", // Unlimited supply
    mintPrice: 0, // Free
  };
}

/**
 * Get network and package info for debugging
 */
export function getOGNFTInfo() {
  return {
    network: NETWORK,
    endpoint: getFullnodeUrl(NETWORK),
    packageId: OG_NFT_PACKAGE_ID,
    gasbudget: DEFAULT_GAS_BUDGET
  }
}