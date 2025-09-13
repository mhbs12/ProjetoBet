# SUI TicTacToe Betting - Deployment Guide

## Prerequisites

1. **Install SUI CLI**
   \`\`\`bash
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
   \`\`\`

2. **Create SUI Wallet**
   \`\`\`bash
   sui client new-address ed25519
   sui client switch --address <your-address>
   \`\`\`

3. **Get Testnet SUI**
   - Visit: https://discord.gg/sui
   - Use `!faucet <your-address>` in #testnet-faucet channel

## Deploy Your Smart Contract

1. **Prepare Your Contract**
   - Use your existing Move contract with functions: `criar_aposta`, `entrar_aposta`, `finish_game`
   - Ensure the module name is `teste2` as expected by the frontend

2. **Deploy to Testnet**
   \`\`\`bash
   sui client publish --gas-budget 20000000
   \`\`\`

3. **Save Package ID**
   - Copy the Package ID from deployment output
   - You'll need this to configure the frontend

## Frontend Configuration

1. **Set Package ID**
   - After deploying your contract, add the Package ID to environment variables
   - In Vercel: Go to Project Settings → Environment Variables
   - Add: `NEXT_PUBLIC_CONTRACT_PACKAGE_ID=<your-package-id>`

2. **Network Configuration**
   \`\`\`bash
   # For testnet (default)
   NEXT_PUBLIC_SUI_NETWORK=testnet
   
   # For mainnet (production)
   NEXT_PUBLIC_SUI_NETWORK=mainnet
   \`\`\`

## Testing the Application

1. **Install SUI Wallet**
   - Chrome Extension: [Sui Wallet](https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)
   - Alternative: [Suiet Wallet](https://suiet.app/)

2. **Connect Wallet**
   - Open the application
   - Click "Connect Wallet"
   - Approve connection in wallet extension

3. **Get Testnet SUI**
   - Use Discord faucet or testnet faucet website
   - Ensure you have at least 1 SUI for testing

4. **Create and Play**
   - Create a room with a small bet (0.1 SUI)
   - Share room ID with another player
   - Play TicTacToe and verify prize distribution

## Production Deployment

1. **Switch to Mainnet**
   \`\`\`bash
   # In .env.local
   NEXT_PUBLIC_SUI_NETWORK=mainnet
   \`\`\`

2. **Deploy to Mainnet**
   \`\`\`bash
   sui client switch --env mainnet
   sui client publish --gas-budget 20000000
   \`\`\`

3. **Update Package ID**
   - Update `.env.local` with mainnet package ID

## Contract Integration

The frontend automatically calls your contract functions:

1. **Creating Room**: Calls `criar_aposta(coin, amount)` 
   - Creates Treasury object
   - Returns treasury ID for room identification

2. **Joining Room**: Calls `entrar_aposta(treasury, coin, amount)`
   - Uses treasury ID from room creation
   - Adds second player's bet to treasury

3. **Game Finish**: Calls `finish_game(winner_address, treasury)`
   - Transfers entire treasury balance to winner
   - Automatically called when game ends

## Troubleshooting

### Common Issues

1. **"Wallet not detected"**
   - Install SUI wallet extension
   - Refresh page after installation

2. **"Insufficient gas"**
   - Get more SUI from faucet
   - Increase gas budget in transactions

3. **"Contract not found"**
   - Verify package ID in `.env.local`
   - Ensure contract is deployed to correct network

4. **"Transaction failed"**
   - Check wallet has sufficient balance
   - Verify contract functions are called correctly

### Debug Mode

Enable debug logging:
\`\`\`javascript
// In browser console
localStorage.setItem('debug', 'sui:*')
\`\`\`

## Security Considerations

1. **Testnet Only**: Current configuration is for testnet only
2. **Smart Contract Audit**: Audit contract before mainnet deployment
3. **Private Keys**: Never share private keys or seed phrases
4. **Gas Limits**: Set appropriate gas limits for transactions

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify wallet connection and balance
3. Ensure contract is properly deployed
4. Test with small amounts first
