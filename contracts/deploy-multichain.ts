#!/usr/bin/env node

/**
 * Multi-Chain Deployment Script for Bantah On-Chain Challenges
 * Deploys all contracts to Base Sepolia, Polygon Amoy, and Arbitrum Sepolia
 * 
 * Usage: npx ts-node deploy-multichain.ts [base-sepolia|polygon-amoy|arbitrum-sepolia|all]
 * 
 * Requires environment variables:
 * - ADMIN_PRIVATE_KEY: Private key of admin account
 */

import * as ethers from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, "../.env.local") });

interface ChainInfo {
  name: string;
  id: number;
  rpcUrl: string;
  blockExplorer: string;
  envPrefix: string;
}

const CHAINS: Record<string, ChainInfo> = {
  "base-sepolia": {
    name: "Base Sepolia",
    id: 84532,
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    envPrefix: "BASE",
  },
  "polygon-amoy": {
    name: "Polygon Amoy",
    id: 80002,
    rpcUrl: "https://rpc-amoy.polygon.technology",
    blockExplorer: "https://amoy.polygonscan.com",
    envPrefix: "POLYGON",
  },
  "arbitrum-sepolia": {
    name: "Arbitrum Sepolia",
    id: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
    envPrefix: "ARBITRUM",
  },
};

// Read contract ABIs
const readABI = (contractName: string): any => {
  let abiPath = path.join(__dirname, "artifacts", "src", `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(abiPath)) {
    abiPath = path.join(__dirname, "artifacts", `${contractName}.json`);
  }
  if (!fs.existsSync(abiPath)) {
    console.error(`⚠️  Contract ${contractName}.json not found. Have you compiled contracts?`);
    console.error(`Run: npx hardhat compile`);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  return artifact.abi;
};

// Read compiled bytecode
const readBytecode = (contractName: string): string => {
  let artifactPath = path.join(__dirname, "artifacts", "src", `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    artifactPath = path.join(__dirname, "artifacts", `${contractName}.json`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  return artifact.bytecode;
};

async function deployToChain(chainKey: string) {
  const chain = CHAINS[chainKey];
  if (!chain) {
    console.error(`❌ Unknown chain: ${chainKey}`);
    console.error(`Supported chains: ${Object.keys(CHAINS).join(", ")}`);
    process.exit(1);
  }

  try {
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      console.error("❌ ADMIN_PRIVATE_KEY not set in environment");
      process.exit(1);
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const wallet = new ethers.Wallet(adminPrivateKey, provider);

    console.log(`\n🚀 Deploying Bantah On-Chain Challenge System`);
    console.log(`📍 Network: ${chain.name} (Chain ID: ${chain.id})`);
    console.log(`👤 Deployer: ${wallet.address}`);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} Native Token\n`);

    if (balance === 0n) {
      console.error("❌ No balance on deployer account. Get testnet tokens from faucet");
      process.exit(1);
    }

    const deployments: Record<string, string> = {};

    // Step 1: Deploy ChallengeEscrow (needed for ChallengeFactory)
    console.log("📋 Step 1/4: Deploying ChallengeEscrow.sol...");
    const challengeEscrowBytecode = readBytecode("ChallengeEscrow");
    const challengeEscrowABI = readABI("ChallengeEscrow");
    
    const challengeEscrowFactory = new ethers.ContractFactory(challengeEscrowABI, challengeEscrowBytecode, wallet);
    const challengeEscrow = await challengeEscrowFactory.deploy(wallet.address);
    await challengeEscrow.waitForDeployment();
    const escrowAddress = await challengeEscrow.getAddress();
    deployments.escrow = escrowAddress;
    console.log(`✅ ChallengeEscrow deployed: ${escrowAddress}\n`);

    // Step 2: Deploy ChallengeFactory
    console.log("📋 Step 2/4: Deploying ChallengeFactory.sol...");
    const factoryBytecode = readBytecode("ChallengeFactory");
    const factoryABI = readABI("ChallengeFactory");
    
    const factoryFactory = new ethers.ContractFactory(factoryABI, factoryBytecode, wallet);
    const platformFeeRecipient = wallet.address;
    const challengeFactory = await factoryFactory.deploy(
      escrowAddress,
      wallet.address,
      platformFeeRecipient
    );
    await challengeFactory.waitForDeployment();
    const factoryAddress = await challengeFactory.getAddress();
    deployments.factory = factoryAddress;
    console.log(`✅ ChallengeFactory deployed: ${factoryAddress}\n`);

    // Update ChallengeEscrow to point to the real factory
    const challengeEscrowInstance = new ethers.Contract(escrowAddress, challengeEscrowABI, wallet);
    const setChallengeFactoryTx = await challengeEscrowInstance.setChallengeFactory(factoryAddress);
    await setChallengeFactoryTx.wait();
    console.log(`✅ Updated ChallengeEscrow to use ChallengeFactory\n`);

    // All setup complete (BantahPoints and PointsEscrow are now off-chain)

    // Output results
    const envPrefix = chain.envPrefix;
    const envContent = `# Bantah On-Chain Challenge System - ${chain.name}
# Generated by deploy-multichain.ts on ${new Date().toISOString()}
# Chain ID: ${chain.id}
# NOTE: BantahPoints are now managed off-chain in the database

VITE_${envPrefix}_RPC=${chain.rpcUrl}
VITE_${envPrefix}_CHAIN_ID=${chain.id}

# Smart Contracts
VITE_${envPrefix}_CHALLENGE_FACTORY_ADDRESS=${factoryAddress}
VITE_${envPrefix}_CHALLENGE_ESCROW_ADDRESS=${escrowAddress}

# Block Explorer
VITE_${envPrefix}_BLOCK_EXPLORER=${chain.blockExplorer}
`;

    const envFileName = `.env.${chainKey}`;
    fs.writeFileSync(envFileName, envContent);
    console.log("✅ Deployment Complete!\n");
    console.log("📄 Contract Addresses:");
    console.log(`   ChallengeFactory: ${factoryAddress}`);
    console.log(`   ChallengeEscrow: ${escrowAddress}\n`);
    console.log(`📝 Environment variables saved to ${envFileName}`);
    console.log(`💡 Next steps:`);
    console.log(`   1. Copy variables from ${envFileName} to root .env.local`);
    console.log(`   2. Verify contracts on block explorer (optional)`);
    console.log(`   3. Test creating challenges with native token and stablecoins\n`);

  } catch (error) {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let chainsToDeploy: string[] = [];

  if (args.length === 0 || args[0] === "all") {
    chainsToDeploy = Object.keys(CHAINS);
  } else {
    chainsToDeploy = args;
  }

  console.log(`\n🌍 Multi-Chain Deployment Script`);
  console.log(`🔗 Chains to deploy: ${chainsToDeploy.join(", ")}\n`);

  for (const chainKey of chainsToDeploy) {
    try {
      await deployToChain(chainKey);
    } catch (error) {
      console.error(`Failed to deploy to ${chainKey}:`, error);
    }
  }

  console.log("\n✅ All deployments completed!");
}

main().catch(console.error);
