import type { Room } from "@/types/game"

export interface GameProof {
  gameHash: string
  merkleRoot: string
  proof: string[]
  signature: string
  winner: string | null
  timestamp: number
}

export class WinnerVerification {
  static async generateGameProof(room: Room): Promise<GameProof> {
    const { gameState, id: roomId } = room

    // Generate game hash from all moves
    const gameData = {
      board: gameState.board,
      moves: gameState.moves,
      roomId,
      players: room.players,
      betAmount: room.betAmount,
    }

    const gameHash = await this.hashData(JSON.stringify(gameData))

    // Create Merkle tree for proof
    const leaves = [
      gameHash,
      await this.hashData(JSON.stringify(gameState.board)),
      await this.hashData(gameState.winner || "draw"),
      await this.hashData(roomId),
    ]

    const merkleRoot = await this.buildMerkleRoot(leaves)
    const proof = await this.generateMerkleProof(leaves, 0) // Proof for game hash

    // Generate signature (mock - use actual crypto in production)
    const signature = await this.signData(merkleRoot)

    return {
      gameHash,
      merkleRoot,
      proof,
      signature,
      winner: gameState.winner === "draw" ? null : gameState.winner,
      timestamp: Date.now(),
    }
  }

  static async verifyGameProof(proof: GameProof, room: Room): Promise<boolean> {
    try {
      // Verify Merkle proof
      const isValidProof = await this.verifyMerkleProof(proof.gameHash, proof.proof, proof.merkleRoot)

      if (!isValidProof) return false

      // Verify signature
      const isValidSignature = await this.verifySignature(proof.merkleRoot, proof.signature)

      if (!isValidSignature) return false

      // Verify game state matches
      const expectedWinner = room.gameState.winner === "draw" ? null : room.gameState.winner
      return proof.winner === expectedWinner
    } catch (error) {
      console.error("Proof verification failed:", error)
      return false
    }
  }

  private static async hashData(data: string): Promise<string> {
    // Use Web Crypto API for real hashing
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  private static async buildMerkleRoot(leaves: string[]): Promise<string> {
    if (leaves.length === 0) return ""
    if (leaves.length === 1) return leaves[0]

    const nextLevel: string[] = []
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i]
      const right = leaves[i + 1] || left
      const combined = await this.hashData(left + right)
      nextLevel.push(combined)
    }

    return this.buildMerkleRoot(nextLevel)
  }

  private static async generateMerkleProof(leaves: string[], index: number): Promise<string[]> {
    const proof: string[] = []
    let currentIndex = index
    let currentLevel = [...leaves]

    while (currentLevel.length > 1) {
      const nextLevel: string[] = []

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]
        const right = currentLevel[i + 1] || left

        if (i === currentIndex || i + 1 === currentIndex) {
          // Add sibling to proof
          if (i === currentIndex && i + 1 < currentLevel.length) {
            proof.push(right)
          } else if (i + 1 === currentIndex) {
            proof.push(left)
          }
        }

        const combined = await this.hashData(left + right)
        nextLevel.push(combined)
      }

      currentIndex = Math.floor(currentIndex / 2)
      currentLevel = nextLevel
    }

    return proof
  }

  private static async verifyMerkleProof(leaf: string, proof: string[], root: string): Promise<boolean> {
    let current = leaf

    for (const sibling of proof) {
      // Determine order and hash
      const combined =
        current < sibling ? await this.hashData(current + sibling) : await this.hashData(sibling + current)
      current = combined
    }

    return current === root
  }

  private static async signData(data: string): Promise<string> {
    // Mock signature - use actual crypto signing in production
    const hash = await this.hashData(data + "secret_key")
    return hash.substring(0, 32)
  }

  private static async verifySignature(data: string, signature: string): Promise<boolean> {
    // Mock verification - use actual crypto verification in production
    const expectedSignature = await this.signData(data)
    return signature === expectedSignature
  }
}
