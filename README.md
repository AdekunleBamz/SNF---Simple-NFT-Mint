# Simple NFT Mint

A minimal NFT minting platform on the Stacks blockchain with a 0.001 STX mint fee.

## Features

- 🎨 Simple NFT with sequential IDs
- 💰 0.001 STX mint price
- 🔗 Wallet connection via browser extensions (Leather, Xverse)
- ⚡ Vite-powered frontend

## Project Structure

```
nft-mint/
├── contracts/
│   └── simple-nft.clar    # Clarity smart contract
├── src/
│   └── main.js            # Frontend application
├── index.html             # Main HTML file
├── vite.config.js         # Vite configuration
└── package.json
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy the Contract

Deploy `contracts/simple-nft.clar` to Stacks mainnet/testnet using:
- [Hiro Platform](https://platform.hiro.so/)
- [Clarinet](https://github.com/hirosystems/clarinet)

### 3. Update Configuration

Edit `src/main.js` to set your deployed contract address:

```javascript
const CONFIG = {
  CONTRACT_ADDRESS: 'YOUR_DEPLOYED_ADDRESS',
  CONTRACT_NAME: 'simple-nft-v2',
  NETWORK: 'mainnet'
};
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Contract Details

### Functions

| Function | Description |
|----------|-------------|
| `mint` | Mint a new NFT (costs 0.001 STX) |
| `transfer` | Transfer NFT to another address |
| `get-owner` | Get owner of a token ID |
| `get-total-minted` | Get total NFTs minted |
| `get-mint-price` | Get mint price (1000 microSTX) |

### Constants

- **Mint Price**: 0.001 STX (1000 microSTX)
- **Max Supply**: 10,000 NFTs
- **Token Name**: Simple NFT
- **Token Symbol**: SNFT

## Wallet Support

The frontend supports these Stacks wallets:
- [Leather](https://leather.io/) (formerly Hiro Wallet)
- [Xverse](https://www.xverse.app/)

## Building for Production

```bash
npm run build
npm run preview
```

## License

ISC
