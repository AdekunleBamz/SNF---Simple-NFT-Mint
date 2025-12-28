const {
  makeSTXTokenTransfer,
  broadcastTransaction,
  AnchorMode,
  getAddressFromPrivateKey,
  AddressVersion,
} = require("@stacks/transactions");
const { STACKS_MAINNET, STACKS_TESTNET } = require("@stacks/network");
const { generateWallet } = require("@stacks/wallet-sdk");
const fs = require("fs");
require("dotenv").config();

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  // Source wallet - can be private key OR mnemonic
  SOURCE_PRIVATE_KEY: process.env.SOURCE_PRIVATE_KEY,
  SOURCE_MNEMONIC: process.env.SOURCE_MNEMONIC || process.env.STACKS_MNEMONIC,
  
  // Network
  NETWORK: process.env.NETWORK || "mainnet",
  
  // Transaction settings
  BASE_FEE: BigInt(process.env.BASE_FEE || 2000), // Lower fee for simple transfers
  DELAY_BETWEEN_TXS_MS: parseInt(process.env.DELAY_MS || 1000),
};

// ============================================================
// HELPERS
// ============================================================
function getNetwork() {
  return CONFIG.NETWORK === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;
}

function getApiUrl() {
  return CONFIG.NETWORK === "mainnet"
    ? "https://api.mainnet.hiro.so"
    : "https://api.testnet.hiro.so";
}

/**
 * Get private key from mnemonic or direct key
 */
async function getSourcePrivateKey() {
  if (CONFIG.SOURCE_PRIVATE_KEY && CONFIG.SOURCE_PRIVATE_KEY.length === 66) {
    // Already a private key (64 hex chars + '01' suffix)
    return CONFIG.SOURCE_PRIVATE_KEY;
  }
  
  if (CONFIG.SOURCE_MNEMONIC) {
    // Derive from mnemonic
    const wallet = await generateWallet({
      secretKey: CONFIG.SOURCE_MNEMONIC,
      password: "",
    });
    return wallet.accounts[0].stxPrivateKey;
  }
  
  if (CONFIG.SOURCE_PRIVATE_KEY) {
    // Try treating it as a mnemonic
    try {
      const wallet = await generateWallet({
        secretKey: CONFIG.SOURCE_PRIVATE_KEY,
        password: "",
      });
      return wallet.accounts[0].stxPrivateKey;
    } catch (e) {
      throw new Error("Invalid SOURCE_PRIVATE_KEY - not a valid private key or mnemonic");
    }
  }
  
  throw new Error(
    "No source wallet configured. Add to .env:\n" +
    "  SOURCE_MNEMONIC=your 12 or 24 word phrase\n" +
    "  OR\n" +
    "  SOURCE_PRIVATE_KEY=your_hex_private_key"
  );
}

async function getCurrentNonce(address) {
  const response = await fetch(
    `${getApiUrl()}/extended/v1/address/${address}/nonces`
  );
  const data = await response.json();
  return BigInt(data.possible_next_nonce);
}

async function getSTXBalance(address) {
  const response = await fetch(
    `${getApiUrl()}/extended/v1/address/${address}/balances`
  );
  const data = await response.json();
  return BigInt(data.stx?.balance || 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// LOAD WALLETS
// ============================================================
function loadWallets() {
  const content = fs.readFileSync("wallets.json", "utf-8");
  return JSON.parse(content).wallets;
}

// ============================================================
// TRANSFER FUNCTION
// ============================================================
async function transferSTX(privateKey, recipient, amount, nonce, memo = "") {
  const network = getNetwork();

  const txOptions = {
    recipient,
    amount: BigInt(amount),
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: CONFIG.BASE_FEE,
    nonce,
    memo,
  };

  const transaction = await makeSTXTokenTransfer(txOptions);
  const broadcastResponse = await broadcastTransaction({ transaction, network });
  return broadcastResponse;
}

// ============================================================
// BULK TRANSFER EXECUTION
// ============================================================
async function distributeFunds(amountPerWallet) {
  // Get private key (from mnemonic or direct)
  const sourcePrivateKey = await getSourcePrivateKey();

  const wallets = loadWallets();
  const results = [];

  // Get source address from private key
  const sourceAddress = getAddressFromPrivateKey(
    sourcePrivateKey,
    CONFIG.NETWORK
  );

  console.log("=".repeat(70));
  console.log("STX DISTRIBUTION TO WALLETS");
  console.log("=".repeat(70));
  console.log(`Source wallet: ${sourceAddress}`);
  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Amount per wallet: ${amountPerWallet} microSTX (${(parseInt(amountPerWallet) / 1e6).toFixed(6)} STX)`);
  console.log(`Total wallets: ${wallets.length}`);
  console.log(`Total to distribute: ${parseInt(amountPerWallet) * wallets.length} microSTX (${(parseInt(amountPerWallet) * wallets.length / 1e6).toFixed(6)} STX)`);
  console.log("=".repeat(70));

  // Check source balance
  const sourceBalance = await getSTXBalance(sourceAddress);
  const totalNeeded = BigInt(amountPerWallet) * BigInt(wallets.length) + CONFIG.BASE_FEE * BigInt(wallets.length);
  
  console.log(`\nSource balance: ${(Number(sourceBalance) / 1e6).toFixed(6)} STX`);
  console.log(`Total needed (including fees): ${(Number(totalNeeded) / 1e6).toFixed(6)} STX`);

  if (sourceBalance < totalNeeded) {
    throw new Error(
      `Insufficient balance! Need ${(Number(totalNeeded) / 1e6).toFixed(6)} STX but only have ${(Number(sourceBalance) / 1e6).toFixed(6)} STX`
    );
  }

  // Get starting nonce
  let nonce = await getCurrentNonce(sourceAddress);
  console.log(`Starting nonce: ${nonce}\n`);

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    console.log(`[${i + 1}/${wallets.length}] Sending to Wallet ${wallet.id}`);
    console.log(`  Recipient: ${wallet.address}`);
    console.log(`  Amount: ${(parseInt(amountPerWallet) / 1e6).toFixed(6)} STX`);
    console.log(`  Nonce: ${nonce}`);

    try {
      const result = await transferSTX(
        sourcePrivateKey,
        wallet.address,
        amountPerWallet,
        nonce,
        `Fund wallet ${wallet.id}`
      );

      if (result.error) {
        throw new Error(result.reason || result.error);
      }

      console.log(`  ✅ Success! TxID: ${result.txid}`);
      console.log(
        `  Explorer: https://explorer.hiro.so/txid/${result.txid}?chain=${CONFIG.NETWORK}`
      );

      results.push({
        walletId: wallet.id,
        address: wallet.address,
        status: "success",
        txid: result.txid,
        amount: amountPerWallet,
      });

      nonce++;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
      results.push({
        walletId: wallet.id,
        address: wallet.address,
        status: "failed",
        error: error.message,
        amount: amountPerWallet,
      });
    }

    // Delay between transfers
    if (i < wallets.length - 1) {
      await sleep(CONFIG.DELAY_BETWEEN_TXS_MS);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("DISTRIBUTION SUMMARY");
  console.log("=".repeat(70));

  const successful = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log(`Total transfers: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total distributed: ${(successful * parseInt(amountPerWallet) / 1e6).toFixed(6)} STX`);

  // Save results
  const resultsFile = `transfer-results-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultsFile}`);

  return results;
}

// ============================================================
// CLI INTERFACE
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "distribute": {
        const amountSTX = args[1];
        if (!amountSTX) {
          console.log("Usage: node transfer-stx.js distribute <amount-in-stx>");
          console.log("Example: node transfer-stx.js distribute 0.1");
          console.log("  This sends 0.1 STX to each of the 15 wallets");
          process.exit(1);
        }
        
        // Convert STX to microSTX
        const amountMicroSTX = Math.floor(parseFloat(amountSTX) * 1e6).toString();
        await distributeFunds(amountMicroSTX);
        break;
      }

      case "check": {
        const wallets = loadWallets();
        console.log("=".repeat(70));
        console.log("WALLET BALANCES");
        console.log("=".repeat(70));
        
        let totalBalance = 0n;
        for (const wallet of wallets) {
          const balance = await getSTXBalance(wallet.address);
          totalBalance += balance;
          console.log(`Wallet ${wallet.id}: ${wallet.address}`);
          console.log(`  Balance: ${(Number(balance) / 1e6).toFixed(6)} STX\n`);
        }
        console.log(`Total across all wallets: ${(Number(totalBalance) / 1e6).toFixed(6)} STX`);
        break;
      }

      case "source": {
        const sourcePrivateKey = await getSourcePrivateKey();
        const sourceAddress = getAddressFromPrivateKey(
          sourcePrivateKey,
          CONFIG.NETWORK
        );
        const balance = await getSTXBalance(sourceAddress);
        console.log(`Source wallet: ${sourceAddress}`);
        console.log(`Balance: ${(Number(balance) / 1e6).toFixed(6)} STX`);
        break;
      }

      default:
        console.log("STX Transfer Script");
        console.log("===================");
        console.log("");
        console.log("Commands:");
        console.log("  node transfer-stx.js distribute <amount-in-stx>");
        console.log("    Send STX to all 15 wallets from source wallet");
        console.log("    Example: node transfer-stx.js distribute 0.1");
        console.log("");
        console.log("  node transfer-stx.js check");
        console.log("    Check STX balances of all 15 wallets");
        console.log("");
        console.log("  node transfer-stx.js source");
        console.log("    Show source wallet address and balance");
        console.log("");
        console.log("Setup:");
        console.log("  Add to your .env file:");
        console.log('    SOURCE_MNEMONIC="your 12 or 24 word mnemonic phrase"');
        console.log("    OR");
        console.log("    SOURCE_PRIVATE_KEY=your_hex_private_key");
        console.log("");
        console.log("  The source wallet must have enough STX for all transfers + fees.");
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();

module.exports = {
  distributeFunds,
  transferSTX,
  loadWallets,
};
