// NFT Mint App - Uses Stacks wallet extensions for connection
// Stacks transactions built manually with @stacks/transactions

import {
  deserializeCV,
  cvToValue
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

// Configuration
const CONFIG = {
  // NFT Contract - UPDATE THIS after deployment
  CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  CONTRACT_NAME: 'simple-nft-v2',
  
  // Network
  NETWORK: 'mainnet', // 'mainnet' or 'testnet'
  
  // Mint price in microSTX
  MINT_PRICE: 1000 // 0.001 STX
};

// DOM Elements
const elements = {
  connectBtn: document.getElementById('connect-btn'),
  mintBtn: document.getElementById('mint-btn'),
  disconnectBtn: document.getElementById('disconnect-btn'),
  notConnected: document.getElementById('not-connected'),
  connected: document.getElementById('connected'),
  walletAddress: document.getElementById('wallet-address'),
  status: document.getElementById('status'),
  minted: document.getElementById('minted')
};

// State
let provider = null;
let userAddress = null;

// Get network object
function getNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

// Show status message
function showStatus(message, type = 'info') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');
}

// Hide status
function hideStatus() {
  elements.status.classList.add('hidden');
}

// Update UI based on connection state
function updateUI() {
  if (userAddress) {
    elements.notConnected.classList.add('hidden');
    elements.connected.classList.remove('hidden');
    elements.walletAddress.textContent = `${userAddress.slice(0, 8)}...${userAddress.slice(-8)}`;
  } else {
    elements.notConnected.classList.remove('hidden');
    elements.connected.classList.add('hidden');
  }
}

// Detect available Stacks wallet
function detectWallet() {
  // Check for Leather wallet (new name)
  if (window.LeatherProvider) {
    return { name: 'Leather', provider: window.LeatherProvider };
  }
  
  // Check for StacksProvider (generic, used by multiple wallets)
  if (window.StacksProvider) {
    return { name: 'Stacks Wallet', provider: window.StacksProvider };
  }
  
  // Check for Xverse
  if (window.XverseProviders?.StacksProvider) {
    return { name: 'Xverse', provider: window.XverseProviders.StacksProvider };
  }
  
  // Check for Hiro Wallet (legacy)
  if (window.HiroWalletProvider) {
    return { name: 'Hiro Wallet', provider: window.HiroWalletProvider };
  }
  
  return null;
}

// Connect wallet
async function connectWallet() {
  showStatus('Detecting wallet...', 'info');
  
  const wallet = detectWallet();
  
  if (!wallet) {
    showStatus('No Stacks wallet detected. Please install Leather or Xverse wallet.', 'error');
    elements.status.innerHTML = 'No Stacks wallet detected. Install <a href="https://leather.io" target="_blank">Leather</a> or <a href="https://www.xverse.app" target="_blank">Xverse</a>';
    return;
  }
  
  showStatus(`Connecting to ${wallet.name}...`, 'info');
  
  try {
    provider = wallet.provider;
    
    // Request connection / get addresses
    let response;
    try {
      response = await provider.request({ method: 'stx_getAddresses' });
    } catch (e) {
      // Some wallets use getAddresses without stx_ prefix
      response = await provider.request({ method: 'getAddresses' });
    }
    
    console.log('Wallet response:', response);
    
    // Handle different response formats
    let address = null;
    
    if (response?.result?.addresses) {
      // Leather format
      const stxAddress = response.result.addresses.find(a => a.type === 'stacks' || a.symbol === 'STX');
      address = stxAddress?.address;
    } else if (response?.addresses) {
      // Standard format
      address = response.addresses[0]?.address;
    } else if (Array.isArray(response)) {
      // Array format
      address = response[0]?.address || response[0];
    } else if (typeof response === 'string') {
      address = response;
    }
    
    if (!address) {
      throw new Error('Could not get address from wallet');
    }
    
    userAddress = address;
    updateUI();
    showStatus(`Connected to ${wallet.name}!`, 'success');
    setTimeout(hideStatus, 2000);
    fetchMintedCount();
    
  } catch (error) {
    console.error('Connection error:', error);
    const errorMsg = error?.message || error?.toString() || 'User rejected or unknown error';
    showStatus(`Connection failed: ${errorMsg}`, 'error');
  }
}

// Disconnect wallet
function disconnectWallet() {
  userAddress = null;
  provider = null;
  updateUI();
  hideStatus();
}

// Fetch minted count from contract
async function fetchMintedCount() {
  try {
    const apiUrl = CONFIG.NETWORK === 'mainnet' 
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';
    
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
    if (data.okay && data.result) {
      const cv = deserializeCV(data.result);
      const value = cvToValue(cv);
      elements.minted.textContent = value.toLocaleString();
    }
  } catch (error) {
    console.error('Failed to fetch minted count:', error);
    elements.minted.textContent = '0';
  }
}

// Mint NFT
async function mintNFT() {
  if (!userAddress || !provider) {
    showStatus('Please connect your wallet first', 'error');
    return;
  }
  
  elements.mintBtn.disabled = true;
  showStatus('Please approve the transaction in your wallet...', 'info');
  
  try {
    // Request contract call through wallet
    const response = await provider.request({
      method: 'stx_callContract',
      params: {
        contract: `${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`,
        functionName: 'mint',
        functionArgs: [],
        network: CONFIG.NETWORK,
        postConditionMode: 'allow'
      }
    });
    
    console.log('Mint response:', response);
    
    // Handle different response formats
    const txId = response?.result?.txId || response?.txId || response?.result;
    
    if (txId) {
      const explorerUrl = CONFIG.NETWORK === 'mainnet'
        ? `https://explorer.hiro.so/txid/${txId}`
        : `https://explorer.hiro.so/txid/${txId}?chain=testnet`;
      
      elements.status.className = 'status success';
      elements.status.innerHTML = `NFT minted! <a href="${explorerUrl}" target="_blank">View on Explorer</a>`;
      elements.status.classList.remove('hidden');
      
      // Refresh minted count after a delay
      setTimeout(fetchMintedCount, 10000);
    } else {
      showStatus('Transaction submitted', 'success');
    }
  } catch (error) {
    console.error('Mint failed:', error);
    const errorMsg = error?.message || error?.toString() || 'Transaction rejected or failed';
    showStatus(`Mint failed: ${errorMsg}`, 'error');
  } finally {
    elements.mintBtn.disabled = false;
  }
}

// Event listeners
elements.connectBtn.addEventListener('click', connectWallet);
elements.mintBtn.addEventListener('click', mintNFT);
elements.disconnectBtn.addEventListener('click', disconnectWallet);

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  fetchMintedCount();
  
  // Check if wallet is already connected (some wallets persist connection)
  const wallet = detectWallet();
  if (wallet) {
    console.log(`${wallet.name} wallet detected`);
  }
});
