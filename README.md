# SUI TicTacToe Betting Platform

A decentralized TicTacToe betting platform built on the SUI blockchain. Players can create rooms, place bets in SUI cryptocurrency, and play against each other with automatic prize distribution via smart contracts.

## Features

- **Real SUI Integration**: Native blockchain betting with smart contracts
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
   \`\`\`bash
   cp .env.local.example .env.local
   # Edit .env.local with your contract package ID
   NEXT_PUBLIC_CONTRACT_PACKAGE_ID=0xYOUR_PACKAGE_ID_HERE
   \`\`\`

4. **Run Application**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Connect Wallet & Play**
   - Install [SUI Wallet](https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)
   - Get testnet SUI from [Discord faucet](https://discord.gg/sui)
   - Create room, invite friend, play & win!

## How It Works

### Smart Contract Functions

1. **`criar_aposta`**: Creates a new betting room with treasury
2. **`entrar_aposta`**: Allows second player to join and match bet
3. **`finish_game`**: Distributes total prize to winner

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
