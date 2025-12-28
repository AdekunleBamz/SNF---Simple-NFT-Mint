#!/usr/bin/env node
// Bulk NFT Minting Script
// Uses all wallets from wallets.json to mint NFTs

import { 
  makeContractCall, 
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  getAddressFromPrivateKey
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { readFileSync } from 'fs';

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  CONTRACT_NAME: 'simple-nft-v3',
  NETWORK: process.env.NETWORK || 'mainnet',
  WALLETS_FILE: './wallets.json'
};

function getNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

// Load wallets
function loadWallets() {
  const data = JSON.parse(readFileSync(CONFIG.WALLETS_FILE, 'utf8'));
  return data.wallets;
}

// Get account nonce
async function getAccountNonce(address) {
  const apiUrl = CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
  
  const response = await fetch(`${apiUrl}/extended/v1/address/${address}/nonces`);
  const data = await response.json();
  return data.possible_next_nonce;
}

// Get STX balance
async function getBalance(address) {
  const apiUrl = CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
  
  const response = await fetch(`${apiUrl}/extended/v1/address/${address}/stx`);
  const data = await response.json();
  return parseInt(data.balance) / 1000000;
}

// Get total minted from contract
async function getTotalMinted() {
  const apiUrl = CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
  
  try {
    const response = await fetch(
      `${apiUrl}/v2/contracts/call-read/${CONFIG.CONTRACT_ADDRESS}/${CONFIG.CONTRACT_NAME}/get-total-minted`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: CONFIG.CONTRACT_ADDRESS,
          arguments: []
        })
      }
    );
    const data = await response.json();
    if (data.okay) {
      // Parse the Clarity value
      const hex = data.result.replace('0x', '');
      // uint is encoded as 01 + 16 bytes big-endian
      if (hex.startsWith('01')) {
        return parseInt(hex.slice(2), 16);
      }
    }
  } catch (e) {
    console.error('Error fetching minted count:', e.message);
  }
  return 0;
}

// Mint NFT from a wallet
async function mintNFT(privateKey, walletId) {
  const network = getNetwork();
  const networkType = CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  const address = getAddressFromPrivateKey(privateKey, networkType);
  
  // Get nonce
  const nonce = await getAccountNonce(address);
  
  const txOptions = {
    contractAddress: CONFIG.CONTRACT_ADDRESS,
    contractName: CONFIG.CONTRACT_NAME,
    functionName: 'mint',
    functionArgs: [],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000n, // 0.01 STX fee
    nonce: BigInt(nonce)
  };
  
  const tx = await makeContractCall(txOptions);
  const result = await broadcastTransaction({ transaction: tx, network });
  
  return result;
}

// Check balances of all wallets
async function checkBalances() {
  const wallets = loadWallets();
  console.log('\n=== Wallet Balances ===\n');
  
  let totalBalance = 0;
  let walletsWithBalance = 0;
  
  for (const wallet of wallets) {
    const balance = await getBalance(wallet.address);
    totalBalance += balance;
    if (balance > 0.011) walletsWithBalance++; // Need at least 0.001 mint + 0.01 fee
    
    const status = balance > 0.011 ? '✅' : '❌';
    console.log(`${status} Wallet ${wallet.id}: ${wallet.address.slice(0, 10)}... - ${balance.toFixed(6)} STX`);
  }
  
  console.log(`\nTotal: ${totalBalance.toFixed(6)} STX across ${wallets.length} wallets`);
  console.log(`Wallets ready to mint: ${walletsWithBalance}/${wallets.length}`);
}

// Mint from all wallets
async function mintFromAllWallets(mintsPerWallet = 1) {
  const wallets = loadWallets();
  
  console.log('\n=== Bulk NFT Minting ===\n');
  console.log(`Contract: ${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`);
  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Wallets: ${wallets.length}`);
  console.log(`Mints per wallet: ${mintsPerWallet}`);
  console.log(`Total mints: ${wallets.length * mintsPerWallet}`);
  
  const startMinted = await getTotalMinted();
  console.log(`\nCurrent total minted: ${startMinted}`);
  console.log('\n--- Starting mints ---\n');
  
  const results = [];
  
  for (const wallet of wallets) {
    const balance = await getBalance(wallet.address);
    const minRequired = (0.001 + 0.01) * mintsPerWallet; // mint price + fee per mint
    
    if (balance < minRequired) {
      console.log(`⏭️  Wallet ${wallet.id}: Skipping (${balance.toFixed(6)} STX < ${minRequired} STX required)`);
      results.push({ walletId: wallet.id, success: false, reason: 'Insufficient balance' });
      continue;
    }
    
    for (let i = 0; i < mintsPerWallet; i++) {
      try {
        console.log(`🔄 Wallet ${wallet.id}: Minting NFT ${i + 1}/${mintsPerWallet}...`);
        const result = await mintNFT(wallet.privateKey, wallet.id);
        
        if (result.error) {
          console.log(`   ❌ Failed: ${result.error} - ${result.reason || ''}`);
          results.push({ walletId: wallet.id, mint: i + 1, success: false, error: result.error });
        } else {
          console.log(`   ✅ TX: ${result.txid}`);
          results.push({ walletId: wallet.id, mint: i + 1, success: true, txid: result.txid });
        }
        
        // Small delay between mints
        if (i < mintsPerWallet - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        results.push({ walletId: wallet.id, mint: i + 1, success: false, error: error.message });
      }
    }
    
    // Delay between wallets
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Summary
  console.log('\n=== Summary ===\n');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  if (successful > 0) {
    console.log('\nSuccessful transactions:');
    const explorerBase = CONFIG.NETWORK === 'mainnet'
      ? 'https://explorer.hiro.so/txid/'
      : 'https://explorer.hiro.so/txid/?chain=testnet&txid=';
    
    results.filter(r => r.success).forEach(r => {
      console.log(`  Wallet ${r.walletId}: ${explorerBase}${r.txid}`);
    });
  }
}

// Main CLI
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  console.log('╔═══════════════════════════════════════╗');
  console.log('║       Simple NFT Bulk Minter          ║');
  console.log('╚═══════════════════════════════════════╝');
  
  switch (command) {
    case 'balances':
      await checkBalances();
      break;
      
    case 'mint':
      const mintsPerWallet = parseInt(arg) || 1;
      await mintFromAllWallets(mintsPerWallet);
      break;
      
    case 'status':
      const minted = await getTotalMinted();
      console.log(`\nTotal NFTs minted: ${minted}`);
      console.log(`Contract: ${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`);
      break;
      
    default:
      console.log(`
Usage: node bulk-mint.js <command> [args]

Commands:
  balances           Check STX balances of all wallets
  mint [count]       Mint NFTs from all wallets (default: 1 per wallet)
  status             Show total NFTs minted from contract

Examples:
  node bulk-mint.js balances
  node bulk-mint.js mint           # Mint 1 NFT from each wallet
  node bulk-mint.js mint 3         # Mint 3 NFTs from each wallet
  node bulk-mint.js status

Environment:
  NETWORK=mainnet|testnet (default: mainnet)
`);
  }
}

main().catch(console.error);
