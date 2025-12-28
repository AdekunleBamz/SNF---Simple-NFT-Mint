#!/usr/bin/env node
// Deploy Marketplace Contract
// Deploys nft-marketplace.clar to Stacks mainnet/testnet

import { 
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  getAddressFromPrivateKey
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';
import 'dotenv/config';

// Configuration
const CONFIG = {
  NETWORK: process.env.NETWORK || 'mainnet',
  MNEMONIC: process.env.STACKS_MNEMONIC || process.env.SOURCE_MNEMONIC,
  PRIVATE_KEY: process.env.STACKS_PRIVATE_KEY || process.env.SOURCE_PRIVATE_KEY,
};

function getNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

function getApiUrl() {
  return CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
}

async function getPrivateKey() {
  if (CONFIG.PRIVATE_KEY && CONFIG.PRIVATE_KEY.length === 66) {
    return CONFIG.PRIVATE_KEY;
  }
  
  if (CONFIG.MNEMONIC) {
    const wallet = await generateWallet({
      secretKey: CONFIG.MNEMONIC,
      password: '',
    });
    return wallet.accounts[0].stxPrivateKey;
  }
  
  throw new Error('No mnemonic or private key configured in .env');
}

async function getAccountNonce(address) {
  const response = await fetch(`${getApiUrl()}/extended/v1/address/${address}/nonces`);
  const data = await response.json();
  return data.possible_next_nonce;
}

async function deployContract(contractName, contractPath) {
  const privateKey = await getPrivateKey();
  const network = getNetwork();
  const address = getAddressFromPrivateKey(privateKey, CONFIG.NETWORK);
  const nonce = await getAccountNonce(address);
  
  console.log('='.repeat(70));
  console.log('DEPLOY CONTRACT');
  console.log(`Contract: ${contractName}`);
  console.log(`File: ${contractPath}`);
  console.log(`Deployer: ${address}`);
  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Nonce: ${nonce}`);
  console.log('='.repeat(70));
  
  const codeBody = readFileSync(contractPath, 'utf8');
  
  const txOptions = {
    contractName: contractName,
    codeBody: codeBody,
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 100000n, // 0.1 STX fee for deployment
    nonce: BigInt(nonce),
    clarityVersion: 3,
  };
  
  console.log('\nDeploying...');
  
  const tx = await makeContractDeploy(txOptions);
  const broadcastResponse = await broadcastTransaction({ transaction: tx, network });
  
  if (broadcastResponse.error) {
    console.log(`\n❌ Deployment failed: ${broadcastResponse.error}`);
    if (broadcastResponse.reason) {
      console.log(`Reason: ${broadcastResponse.reason}`);
    }
  } else {
    console.log(`\n✅ Deployment submitted!`);
    console.log(`TX ID: ${broadcastResponse.txid}`);
    console.log(`\nExplorer: https://explorer.hiro.so/txid/${broadcastResponse.txid}?chain=${CONFIG.NETWORK}`);
    console.log(`\nContract will be available at:`);
    console.log(`  ${address}.${contractName}`);
  }
  
  return broadcastResponse;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'nft':
        await deployContract('simple-nft-v3', './contracts/simple-nft-v3.clar');
        break;
        
      case 'marketplace':
        await deployContract('nft-marketplace', './contracts/nft-marketplace.clar');
        break;
        
      case 'all':
        console.log('Deploying NFT contract...\n');
        await deployContract('simple-nft-v3', './contracts/simple-nft-v3.clar');
        console.log('\n\nWaiting 5 seconds before deploying marketplace...\n');
        await new Promise(r => setTimeout(r, 5000));
        await deployContract('nft-marketplace', './contracts/nft-marketplace.clar');
        break;
        
      default:
        console.log('Deploy Contracts Script');
        console.log('=======================');
        console.log('');
        console.log('Commands:');
        console.log('  node deploy-marketplace.js nft');
        console.log('    Deploy simple-nft-v3.clar');
        console.log('');
        console.log('  node deploy-marketplace.js marketplace');
        console.log('    Deploy nft-marketplace.clar');
        console.log('');
        console.log('  node deploy-marketplace.js all');
        console.log('    Deploy both contracts');
        console.log('');
        console.log('Make sure your .env has STACKS_MNEMONIC or STACKS_PRIVATE_KEY set.');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
