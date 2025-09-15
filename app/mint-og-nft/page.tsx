"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { WalletConnect } from "@/components/wallet-connect"
import { Sparkles, Loader2, CheckCircle, XCircle, Coins, Trophy, Users, ArrowLeft } from "lucide-react"
import { mint, getMintStats, type MintResult } from "@/lib/og_nft"
import { useCurrentAccount } from "@mysten/dapp-kit"
import Link from "next/link"

export default function MintOGNFTPage() {
  const currentAccount = useCurrentAccount()
  const [isMinting, setIsMinting] = useState(false)
  const [mintResult, setMintResult] = useState<MintResult | null>(null)
  const mintStats = getMintStats()

  const handleMint = async () => {
    if (!currentAccount) {
      alert('Please connect your wallet first')
      return
    }

    setIsMinting(true)
    setMintResult(null)

    try {
      console.log('[Mint Page] Starting mint process...')
      const result = await mint()
      setMintResult(result)
      
      if (result.success) {
        console.log('[Mint Page] Mint successful:', result)
      } else {
        console.error('[Mint Page] Mint failed:', result.error)
      }
    } catch (error) {
      console.error('[Mint Page] Unexpected error:', error)
      setMintResult({
        success: false,
        error: 'Unexpected error occurred during minting'
      })
    } finally {
      setIsMinting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold gradient-text flex items-center gap-2">
                <Sparkles className="w-8 h-8" />
                Mint OG NFT
              </h1>
              <p className="text-muted-foreground text-lg mt-2">
                Mint exclusive OG NFTs from ProjetoBet
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <WalletConnect />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="text-center">
            <CardContent className="p-6">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Total Minted</h3>
              <p className="text-2xl font-bold">{mintStats.totalMinted.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Users className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h3 className="font-semibold mb-2">Available Supply</h3>
              <p className="text-2xl font-bold">{mintStats.availableSupply.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Coins className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Mint Price</h3>
              <p className="text-2xl font-bold">{mintStats.mintPrice} SUI</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Mint Section */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Mint Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Mint Your OG NFT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center p-6 border-2 border-dashed border-muted rounded-lg">
                <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">OG NFT Collection</h3>
                <p className="text-muted-foreground mb-4">
                  Exclusive NFTs with different rarities and unique designs
                </p>
                <div className="flex justify-center gap-2 mb-4">
                  <Badge variant="outline">Common</Badge>
                  <Badge variant="secondary">Rare</Badge>
                  <Badge variant="default">Epic</Badge>
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Legendary</Badge>
                </div>
              </div>

              {!currentAccount ? (
                <Alert>
                  <AlertTitle>Wallet Required</AlertTitle>
                  <AlertDescription>
                    Please connect your wallet to mint OG NFTs
                  </AlertDescription>
                </Alert>
              ) : (
                <Button 
                  onClick={handleMint} 
                  className="w-full"
                  size="lg"
                  disabled={isMinting}
                >
                  {isMinting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Minting OG NFT...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Mint OG NFT
                    </>
                  )}
                </Button>
              )}

              {isMinting && (
                <p className="text-xs text-muted-foreground text-center">
                  Please wait while your NFT is being minted on the blockchain...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Result Card */}
          <Card>
            <CardHeader>
              <CardTitle>Mint Result</CardTitle>
            </CardHeader>
            <CardContent>
              {!mintResult ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Mint OG NFT" to get started</p>
                </div>
              ) : mintResult.success ? (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Mint Successful!</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Your OG NFT has been successfully minted!
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">NFT ID</Label>
                      <p className="font-mono text-sm bg-muted p-2 rounded break-all">
                        {mintResult.nftId}
                      </p>
                    </div>
                    
                    {mintResult.transactionHash && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Transaction Hash</Label>
                        <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                          {mintResult.transactionHash}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <Button variant="outline" className="w-full" onClick={() => setMintResult(null)}>
                    Mint Another NFT
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800">Mint Failed</AlertTitle>
                    <AlertDescription className="text-red-700">
                      {mintResult.error || 'Unknown error occurred'}
                    </AlertDescription>
                  </Alert>
                  
                  <Button variant="outline" className="w-full" onClick={() => setMintResult(null)}>
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card className="text-center">
            <CardContent className="p-6">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Exclusive Design</h3>
              <p className="text-sm text-muted-foreground">
                Each OG NFT features unique artwork with different rarity levels
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Coins className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h3 className="font-semibold mb-2">SUI Blockchain</h3>
              <p className="text-sm text-muted-foreground">
                Minted on the secure and fast SUI blockchain network
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Users className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Community Access</h3>
              <p className="text-sm text-muted-foreground">
                Join the exclusive OG NFT holders community with special privileges
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

// Label component for form labels
function Label({ children, className = "", ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
      {children}
    </label>
  )
}