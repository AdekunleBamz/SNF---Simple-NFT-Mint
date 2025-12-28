#!/usr/bin/env node
// NFT Marketplace Script
// Commands: mint, list, buy, cancel, status
// Uses wallets from wallets.json

import { 
  makeContractCall, 
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  getAddressFromPrivateKey,
  uintCV,
  principalCV
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { readFileSync } from 'fs';

// Configuration
const CONFIG = {
  NFT_CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  NFT_CONTRACT_NAME: 'simple-nft-v3',
  MARKETPLACE_CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  MARKETPLACE_CONTRACT_NAME: 'nft-marketplace',
  NETWORK: process.env.NETWORK || 'mainnet',
  WALLETS_FILE: './wallets.json',
  // Fees in microSTX
  MINT_FEE: 1000,      // 0.001 STX
  LIST_FEE: 1300,      // 0.0013 STX
  SALE_FEE: 1300,      // 0.0013 STX
};

function getNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

function getApiUrl() {
  return CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
}

// Load wallets
function loadWallets() {
  const data = JSON.parse(readFileSync(CONFIG.WALLETS_FILE, 'utf8'));
  return data.wallets;
}

// Get account nonce
async function getAccountNonce(address) {
  const response = await fetch(`${getApiUrl()}/extended/v1/address/${address}/nonces`);
  const data = await response.json();
  return data.possible_next_nonce;
}

// Get STX balance
async function getBalance(address) {
  const response = await fetch(`${getApiUrl()}/extended/v1/address/${address}/stx`);
  const data = await response.json();
  return parseInt(data.balance) / 1000000;
}

// Get NFTs owned by address
async function getNFTsOwned(address) {
  const response = await fetch(
    `${getApiUrl()}/extended/v1/tokens/nft/holdings?principal=${address}&asset_identifiers=${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}::simple-nft`
  );
  const data = await response.json();
  return data.results || [];
}

// Get listing info
async function getListingInfo(tokenId) {
  try {
    const response = await fetch(
      `${getApiUrl()}/v2/contracts/call-read/${CONFIG.MARKETPLACE_CONTRACT_ADDRESS}/${CONFIG.MARKETPLACE_CONTRACT_NAME}/get-listing`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: CONFIG.NFT_CONTRACT_ADDRESS,
          arguments: [`0x0100000000000000000000000000000000${tokenId.toString(16).padStart(32, '0')}`]
        })
      }
    );
    const data = await response.json();
    return data;
  } catch (e) {
    return null;
  }
}

// Get total minted
async function getTotalMinted() {
  try {
    const response = await fetch(
      `${getApiUrl()}/v2/contracts/call-read/${CONFIG.NFT_CONTRACT_ADDRESS}/${CONFIG.NFT_CONTRACT_NAME}/get-total-minted`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: CONFIG.NFT_CONTRACT_ADDRESS,
          arguments: []
        })
      }
    );
    const data = await response.json();
    if (data.okay) {
      const hex = data.result.replace('0x', '');
      if (hex.startsWith('01')) {
        return parseInt(hex.slice(2), 16);
      }
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

// ============================================================
// MINT NFT
// ============================================================
async function mintNFT(privateKey, nonce) {
  const network = getNetwork();
  
  const txOptions = {
    contractAddress: CONFIG.NFT_CONTRACT_ADDRESS,
    contractName: CONFIG.NFT_CONTRACT_NAME,
    functionName: 'mint',
    functionArgs: [],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000n,
    nonce: BigInt(nonce)
  };
  
  const tx = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction({ transaction: tx, network });
  return broadcastResponse;
}

// ============================================================
// LIST NFT
// ============================================================
async function listNFT(privateKey, tokenId, price, nonce) {
  const network = getNetwork();
  
  const txOptions = {
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'list-nft',
    functionArgs: [
      uintCV(tokenId),
      uintCV(price)
    ],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 15000n,
    nonce: BigInt(nonce)
  };
  
  const tx = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction({ transaction: tx, network });
  return broadcastResponse;
}

// ============================================================
// BUY NFT
// ============================================================
async function buyNFT(privateKey, tokenId, nonce) {
  const network = getNetwork();
  
  const txOptions = {
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'buy-nft',
    functionArgs: [
      uintCV(tokenId)
    ],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 15000n,
    nonce: BigInt(nonce)
  };
  
  const tx = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction({ transaction: tx, network });
  return broadcastResponse;
}

// ============================================================
// CANCEL LISTING
// ============================================================
async function cancelListing(privateKey, tokenId, nonce) {
  const network = getNetwork();
  
  const txOptions = {
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'cancel-listing',
    functionArgs: [
      uintCV(tokenId)
    ],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000n,
    nonce: BigInt(nonce)
  };
  
  const tx = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction({ transaction: tx, network });
  return broadcastResponse;
}

// ============================================================
// BULK OPERATIONS
// ============================================================

// Bulk mint from all wallets
async function bulkMint(count = 1) {
  const wallets = loadWallets();
  console.log('='.repeat(70));
  console.log('BULK MINT NFTs');
  console.log(`Contract: ${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}`);
  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Wallets: ${wallets.length}`);
  console.log(`Mints per wallet: ${count}`);
  console.log('='.repeat(70));
  
  const results = [];
  
  for (const wallet of wallets) {
    const address = getAddressFromPrivateKey(wallet.privateKey, CONFIG.NETWORK);
    let nonce = await getAccountNonce(address);
    
    console.log(`\nWallet ${wallet.id}: ${address}`);
    
    for (let i = 0; i < count; i++) {
      try {
        const result = await mintNFT(wallet.privateKey, nonce);
        if (result.error) {
          console.log(`  ❌ Mint ${i+1}: ${result.error}`);
          results.push({ wallet: wallet.id, success: false, error: result.error });
        } else {
          console.log(`  ✅ Mint ${i+1}: ${result.txid}`);
          results.push({ wallet: wallet.id, success: true, txid: result.txid });
          nonce++;
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        console.log(`  ❌ Mint ${i+1}: ${error.message}`);
        results.push({ wallet: wallet.id, success: false, error: error.message });
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log('='.repeat(70));
  
  return results;
}

// Bulk list - list NFTs from wallets
async function bulkList(price = 10000) {
  const wallets = loadWallets();
  console.log('='.repeat(70));
  console.log('BULK LIST NFTs');
  console.log(`Marketplace: ${CONFIG.MARKETPLACE_CONTRACT_ADDRESS}.${CONFIG.MARKETPLACE_CONTRACT_NAME}`);
  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Price: ${price / 1000000} STX`);
  console.log('='.repeat(70));
  
  const results = [];
  
  for (const wallet of wallets) {
    const address = getAddressFromPrivateKey(wallet.privateKey, CONFIG.NETWORK);
    const nfts = await getNFTsOwned(address);
    
    console.log(`\nWallet ${wallet.id}: ${address}`);
    console.log(`  NFTs owned: ${nfts.length}`);
    
    if (nfts.length === 0) continue;
    
    let nonce = await getAccountNonce(address);
    
    for (const nft of nfts) {
      const tokenId = parseInt(nft.value.repr.replace('u', ''));
      try {
        const result = await listNFT(wallet.privateKey, tokenId, price, nonce);
        if (result.error) {
          console.log(`  ❌ List #${tokenId}: ${result.error}`);
          results.push({ wallet: wallet.id, tokenId, success: false, error: result.error });
        } else {
          console.log(`  ✅ List #${tokenId}: ${result.txid}`);
          results.push({ wallet: wallet.id, tokenId, success: true, txid: result.txid });
          nonce++;
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        console.log(`  ❌ List #${tokenId}: ${error.message}`);
        results.push({ wallet: wallet.id, tokenId, success: false, error: error.message });
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log('='.repeat(70));
  
  return results;
}

// Buy NFT with specific wallet
async function buyWithWallet(walletId, tokenId) {
  const wallets = loadWallets();
  const wallet = wallets.find(w => w.id === walletId);
  
  if (!wallet) {
    console.log(`❌ Wallet ${walletId} not found`);
    return;
  }
  
  const address = getAddressFromPrivateKey(wallet.privateKey, CONFIG.NETWORK);
  const nonce = await getAccountNonce(address);
  
  console.log('='.repeat(70));
  console.log('BUY NFT');
  console.log(`Buyer: ${address}`);
  console.log(`Token ID: ${tokenId}`);
  console.log('='.repeat(70));
  
  try {
    const result = await buyNFT(wallet.privateKey, tokenId, nonce);
    if (result.error) {
      console.log(`❌ Buy failed: ${result.error}`);
    } else {
      console.log(`✅ Buy successful: ${result.txid}`);
    }
    return result;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

// Show status of all wallets
async function showStatus() {
  const wallets = loadWallets();
  const totalMinted = await getTotalMinted();
  
  console.log('='.repeat(70));
  console.log('NFT MARKETPLACE STATUS');
  console.log(`NFT Contract: ${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}`);
  console.log(`Marketplace: ${CONFIG.MARKETPLACE_CONTRACT_ADDRESS}.${CONFIG.MARKETPLACE_CONTRACT_NAME}`);
  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Total NFTs Minted: ${totalMinted}`);
  console.log('='.repeat(70));
  console.log('\nWALLET BALANCES & NFTs:');
  
  let totalSTX = 0;
  let totalNFTs = 0;
  
  for (const wallet of wallets) {
    const address = getAddressFromPrivateKey(wallet.privateKey, CONFIG.NETWORK);
    const balance = await getBalance(address);
    const nfts = await getNFTsOwned(address);
    
    totalSTX += balance;
    totalNFTs += nfts.length;
    
    console.log(`\nWallet ${wallet.id}: ${address}`);
    console.log(`  STX: ${balance.toFixed(6)}`);
    console.log(`  NFTs: ${nfts.length}`);
    if (nfts.length > 0) {
      const tokenIds = nfts.map(n => n.value.repr.replace('u', '')).join(', ');
      console.log(`  Token IDs: ${tokenIds}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('TOTALS');
  console.log(`Total STX across wallets: ${totalSTX.toFixed(6)}`);
  console.log(`Total NFTs across wallets: ${totalNFTs}`);
  console.log('='.repeat(70));
}

// ============================================================
// CLI
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'mint': {
        const count = parseInt(args[1]) || 1;
        await bulkMint(count);
        break;
      }
      
      case 'list': {
        const price = parseInt(args[1]) || 10000; // Default 0.01 STX
        await bulkList(price);
        break;
      }
      
      case 'buy': {
        const walletId = parseInt(args[1]);
        const tokenId = parseInt(args[2]);
        if (!walletId || !tokenId) {
          console.log('Usage: node marketplace-script.js buy <wallet-id> <token-id>');
          process.exit(1);
        }
        await buyWithWallet(walletId, tokenId);
        break;
      }
      
      case 'status': {
        await showStatus();
        break;
      }
      
      default:
        console.log('NFT Marketplace Script');
        console.log('======================');
        console.log('');
        console.log('Commands:');
        console.log('  node marketplace-script.js mint [count]');
        console.log('    Mint NFTs from all wallets (default: 1 per wallet)');
        console.log('');
        console.log('  node marketplace-script.js list [price-in-microstx]');
        console.log('    List all NFTs owned by wallets (default price: 10000 = 0.01 STX)');
        console.log('');
        console.log('  node marketplace-script.js buy <wallet-id> <token-id>');
        console.log('    Buy a specific NFT with a specific wallet');
        console.log('');
        console.log('  node marketplace-script.js status');
        console.log('    Show wallet balances and NFT holdings');
        console.log('');
        console.log('Fees:');
        console.log(`  Mint: ${CONFIG.MINT_FEE / 1000000} STX`);
        console.log(`  List: ${CONFIG.LIST_FEE / 1000000} STX`);
        console.log(`  Sale: ${CONFIG.SALE_FEE / 1000000} STX (deducted from price)`);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
