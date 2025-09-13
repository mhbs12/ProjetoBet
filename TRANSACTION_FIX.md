# Transaction Confirmation Fix

## Issue
Transaction digest `0xb9e60fca7ff21f13a0756b0a7a4184278eecd662ff73dd2ad96e5ee33b60e8a0` was not confirming bet creation.

## Root Cause
The SUI integration code was using an incorrect callback pattern for the modern `@mysten/dapp-kit` library. The code was trying to pass transaction options in the wrong format and using nested callbacks instead of the expected Promise-based pattern.

## Solution
Updated the transaction handling in two key files:

### 1. `lib/sui-integration.ts`
**Before:**
```typescript
// Incorrect - trying to pass options in transactionData object
const transactionData = {
  transaction: tx,
  options: {
    showEffects: true,
    showObjectChanges: true,
  },
}
return signAndExecuteCallback(transactionData)
```

**After:**
```typescript
// Correct - using Promise-based callback with proper structure
return new Promise((resolve, reject) => {
  signAndExecuteTransaction(
    {
      transaction: tx,
    },
    {
      onSuccess: (result: any) => {
        console.log(`[v0] Transaction successful with digest: ${result.digest}`)
        resolve(result)
      },
      onError: (error: any) => {
        console.error(`[v0] Transaction failed:`, error)
        reject(error)
      },
    }
  )
})
```

### 2. `lib/game-state.ts`
**Before:**
```typescript
// Complex nested callback pattern
const result = await new Promise<any>((resolve, reject) => {
  try {
    suiContract.createBettingRoom(creatorAddress, betAmount, (transactionData: any) => {
      signAndExecute(transactionData, {
        onSuccess: (result: any) => { /* ... */ },
        onError: (error: any) => { /* ... */ }
      })
    })
  } catch (error) {
    reject(error)
  }
})
```

**After:**
```typescript
// Direct async/await pattern
try {
  const result = await suiContract.createBettingRoom(creatorAddress, betAmount, signAndExecute)
  // Handle result directly
} catch (error) {
  // Handle error
}
```

## Changes Made

1. **Fixed Transaction Execution Pattern**: Updated all three transaction methods (`createBettingRoom`, `joinBettingRoom`, `finishGame`) to use the correct Promise-based pattern expected by `useSignAndExecuteTransaction`.

2. **Simplified Game State Management**: Removed complex nested callbacks and used direct async/await for cleaner code.

3. **Improved Error Handling**: Better error messages and consistent error handling across all transaction methods.

4. **Enhanced Logging**: Added detailed console logging for transaction success/failure tracking.

## Expected Behavior After Fix

1. **Creating Bets**: When users create a betting room, the transaction should now properly confirm and return a treasury object ID.

2. **Joining Bets**: Users joining existing rooms should see successful transaction confirmation.

3. **Game Completion**: Prize distribution transactions should execute correctly when games end.

4. **Error Handling**: Users should see clear, helpful error messages if transactions fail.

## Testing
- Application builds successfully without errors
- Development server runs without console errors
- Transaction flow is properly structured for SUI dapp-kit integration
- Error handling provides clear feedback to users

## Transaction Flow
1. User initiates bet creation/joining
2. Transaction is prepared with proper gas budget and coin splitting
3. Smart contract method is called with correct arguments
4. Transaction is executed via wallet using dapp-kit pattern
5. Success/error callbacks handle the response appropriately
6. Game state is updated based on transaction result

This fix ensures that SUI transactions are properly confirmed and handled according to the modern dapp-kit standards.