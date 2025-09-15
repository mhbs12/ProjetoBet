# SUI TicTacToe Betting Platform

A decentralized TicTacToe betting platform built on the SUI blockchain. Players can create rooms, place bets in SUI cryptocurrency, and play against each other with automatic prize distribution via smart contracts.

## Features

- **Real SUI Integration**: Native blockchain betting with smart contracts
- **Free OG NFT Minting**: Mint unlimited OG NFTs directly on SUI blockchain at no cost
- **Secure Betting**: Cryptographic proof system ensures fair play
- **Instant Payouts**: Automatic prize distribution to winners
- **Room System**: Create or join betting rooms with custom stakes
- **Wallet Integration**: Support for SUI Wallet and Suiet

## Quick Start

1. **Clone and Install**
   \`\`\`bash
   git clone <repository>
   cd tictactoe-betting
   npm install
   \`\`\`

2. **Deploy Smart Contract**
   - Follow the [Deployment Guide](DEPLOYMENT.md)
   - Get your contract package ID

3. **Configure Environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your contract package IDs
   NEXT_PUBLIC_CONTRACT_PACKAGE_ID=0xYOUR_BETTING_PACKAGE_ID_HERE
   NEXT_PUBLIC_OG_NFT_PACKAGE_ID=0xYOUR_OG_NFT_PACKAGE_ID_HERE
   ```

   **⚠️ Important**: The application requires valid contract package IDs to work. You must:
   1. Deploy your smart contracts to SUI network
   2. Copy the package IDs from the deployment output
   3. Set them in the `.env.local` file
   
   - `NEXT_PUBLIC_CONTRACT_PACKAGE_ID`: For the betting/game functionality
   - `NEXT_PUBLIC_OG_NFT_PACKAGE_ID`: For the free OG NFT minting functionality
   
   Without these configurations, transactions will fail with an error.

4. **Run Application**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Connect Wallet & Play**
   - Install [SUI Wallet](https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)
   - Get devnet SUI from [Discord faucet](https://discord.gg/sui) or [Devnet Faucet](https://faucet.devnet.sui.io/)
   - Mint free OG NFTs at `/mint-og-nft`
   - Create betting rooms, invite friends, play & win!

## How It Works

### Smart Contract Functions

#### Betting Contracts
1. **`criar_aposta`**: Creates a new betting room with treasury
2. **`entrar_aposta`**: Allows second player to join and match bet
3. **`finish_game`**: Distributes total prize to winner

#### OG NFT Contract
1. **`og_nft::mint`**: Mints free OG NFTs with unlimited supply (no rarity system)

### Game Flow

1. **Room Creation**: Player 1 creates room and deposits bet
2. **Room Joining**: Player 2 joins room and matches bet
3. **Game Play**: Players take turns in TicTacToe
4. **Prize Distribution**: Winner automatically receives total prize

### Security Features

- **Escrow System**: Bets held in smart contract treasury
- **Cryptographic Verification**: Game results verified on-chain
- **Automatic Distribution**: No manual intervention needed
- **Tamper-Proof**: Blockchain ensures game integrity

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Blockchain**: SUI Network, Move language
- **Wallet**: SUI Wallet SDK (@mysten/sui.js)

## Smart Contract

```move
module 0x0::teste2 {
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    // ... (contract implementation)
}


## Troubleshooting

### Transaction Errors

If you're experiencing transaction failures when creating or joining betting rooms:

1. **"Contract not configured"**
   - Ensure `NEXT_PUBLIC_CONTRACT_PACKAGE_ID` is set in `.env.local`
   - Verify the package ID is from a successfully deployed contract
   - Restart the development server after changing environment variables

2. **"Insufficient SUI balance"**
   - Make sure your wallet has enough SUI for both the bet amount and gas fees
   - Use the devnet faucet to get more SUI: https://faucet.devnet.sui.io/ or https://discord.gg/sui

3. **"Transaction failed" or wallet errors**
   - Check that your wallet is properly connected
   - Ensure you're on the correct network (devnet)
   - Try refreshing the page and reconnecting your wallet

4. **Room creation fails**
   - Verify your contract has the `criar_aposta` function
   - Check that the bet amount is valid (minimum 0.001 SUI)
   - Ensure sufficient wallet balance for bet + gas fees

5. **Cannot join room**
   - Verify the room ID or share link is correct
   - Check that the treasury still exists and is valid
   - Ensure you have sufficient balance to match the bet
