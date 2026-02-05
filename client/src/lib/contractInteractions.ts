import { Contract, BrowserProvider, parseUnits, formatUnits } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { PrivyClient } from "@privy-io/react-auth";

// Contract ABIs
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
];

const CHALLENGE_FACTORY_ABI = [
  "function createP2PChallenge(address participant, address paymentToken, uint256 stakeAmount, uint256 pointsReward, string metadataURI) public returns (uint256)",
  "function acceptP2PChallenge(uint256 challengeId, uint256 participantSide, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) public payable",
  "function stakeAndCreateP2PChallenge(address participant,address paymentToken,uint256 stakeAmount,uint256 creatorSide,uint256 pointsReward,string metadataURI,uint256 permitDeadline,uint8 v,bytes32 r,bytes32 s) public payable returns (uint256)",
  "function claimStake(uint256 challengeId) public",
  "function challenges(uint256) public view returns (uint256 id, uint8 challengeType, address creator, address participant, address paymentToken, uint256 stakeAmount, uint256 pointsReward, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt, string metadataURI)",
];

interface ContractAddresses {
  usdc: string;
  challengeFactory: string;
}

/**
 * Approve USDC spending
 */
export async function approveUSDC(
  privyWallet: any,
  usdcAddress: string,
  spenderAddress: string,
  amountInUSDC: number
): Promise<string> {
  if (!privyWallet) throw new Error("Privy wallet not connected");

  try {
    // Create provider from Privy embedded wallet
    const provider = new BrowserProvider(privyWallet.getEthereumProvider());
    const signer = await provider.getSigner();

    // USDC has 6 decimals
    const amountInWei = parseUnits(amountInUSDC.toString(), 6);

    const usdcContract = new Contract(usdcAddress, ERC20_ABI, signer);
    const tx = await usdcContract.approve(spenderAddress, amountInWei);
    const receipt = await tx.wait();

    if (!receipt) throw new Error("Approval failed");
    return receipt.transactionHash;
  } catch (error) {
    console.error("USDC approval error:", error);
    throw error;
  }
}

/**
 * Get USDC balance
 */
export async function getUSDCBalance(
  privyWallet: any,
  usdcAddress: string,
  userAddress: string
): Promise<string> {
  try {
    const provider = new BrowserProvider(privyWallet.getEthereumProvider());
    const usdcContract = new Contract(usdcAddress, ERC20_ABI, provider);

    const balance = await usdcContract.balanceOf(userAddress);
    return formatUnits(balance, 6); // USDC has 6 decimals
  } catch (error) {
    console.error("Get USDC balance error:", error);
    return "0";
  }
}

/**
 * Create a P2P challenge and stake USDC
 */
export async function stakeInChallenge(
  privyWallet: any,
  addresses: ContractAddresses,
  participantAddress: string,
  stakeAmountUSDC: number,
  pointsReward: number,
  metadataURI: string = ""
): Promise<{ transactionHash: string; challengeId: string }> {
  if (!privyWallet) throw new Error("Privy wallet not connected");

  try {
    // Attempt single-call flow: try EIP-2612 permit, fall back to approve+create
    const provider = new BrowserProvider(privyWallet.getEthereumProvider());
    const signer = await provider.getSigner();

    const stakeInWei = parseUnits(stakeAmountUSDC.toString(), 6);
    const factoryContract = new Contract(
      addresses.challengeFactory,
      CHALLENGE_FACTORY_ABI,
      signer
    );

    // Try to sign a permit (EIP-2612). If it fails, fall back to approve.
    const trySignPermit = async () => {
      try {
        const token = new Contract(addresses.usdc, [
          'function name() view returns (string)',
          'function nonces(address) view returns (uint256)'
        ], provider);
        const name = await token.name();
        const nonce = await token.nonces(await signer.getAddress());
        const chain = await provider.getNetwork();
        const chainId = chain.chainId;

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1hr
        const domain = { name, version: '1', chainId, verifyingContract: addresses.usdc };
        const types = { Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ] } as any;
        const owner = await signer.getAddress();
        const message = { owner, spender: addresses.challengeFactory, value: stakeInWei.toString(), nonce: nonce.toString(), deadline };
        const signature = await (signer as any)._signTypedData(domain, types, message);
        const sig = ethers.splitSignature(signature);
        return { deadline, v: sig.v, r: sig.r, s: sig.s };
      } catch (e) {
        console.warn('Permit attempt failed, will fallback to approve', e?.message || e);
        return null;
      }
    };

    const permit = await trySignPermit();

    if (!permit) {
      console.log('Approving USDC (fallback)');
      await approveUSDC(privyWallet, addresses.usdc, addresses.challengeFactory, stakeAmountUSDC);
    }

    // Call the single transaction function on the factory
    const ZERO_BYTES32 = '0x' + '00'.repeat(32);
    let tx;
    if (permit) {
      tx = await factoryContract.stakeAndCreateP2PChallenge(
        participantAddress,
        addresses.usdc,
        stakeInWei,
        0, // default creatorSide = YES (0); UI can be extended to choose
        pointsReward,
        metadataURI,
        permit.deadline,
        permit.v,
        permit.r,
        permit.s
      );
    } else {
      tx = await factoryContract.stakeAndCreateP2PChallenge(
        participantAddress,
        addresses.usdc,
        stakeInWei,
        0,
        pointsReward,
        metadataURI,
        0,
        0,
        ZERO_BYTES32,
        ZERO_BYTES32
      );
    }

    const receipt = await tx.wait();
    if (!receipt) throw new Error('Challenge creation failed');
    return { transactionHash: receipt.transactionHash, challengeId: '0' };
  } catch (error) {
    console.error("Stake in challenge error:", error);
    throw error;
  }
}

/**
 * Claim winnings from a resolved challenge
 */
export async function claimWinnings(
  privyWallet: any,
  challengeFactoryAddress: string,
  challengeId: number
): Promise<string> {
  if (!privyWallet) throw new Error("Privy wallet not connected");

  try {
    const provider = new BrowserProvider(privyWallet.getEthereumProvider());
    const signer = await provider.getSigner();

    const factoryContract = new Contract(
      challengeFactoryAddress,
      CHALLENGE_FACTORY_ABI,
      signer
    );

    console.log("Claiming winnings for challenge:", challengeId);
    const tx = await factoryContract.claimStake(challengeId);
    const receipt = await tx.wait();

    if (!receipt) throw new Error("Claim failed");
    return receipt.transactionHash;
  } catch (error) {
    console.error("Claim winnings error:", error);
    throw error;
  }
}

/**
 * Accept a P2P challenge and stake USDC
 */
export async function acceptChallenge(
  privyWallet: any,
  addresses: ContractAddresses,
  challengeId: number,
  stakeAmountUSDC: number,
  participantSide: number // 0 = YES, 1 = NO (opposite of creator's side)
): Promise<string> {
  if (!privyWallet) throw new Error("Privy wallet not connected");

  try {
    // 1. Approve USDC to ChallengeFactory
    console.log("Approving USDC for acceptance...");
    await approveUSDC(
      privyWallet,
      addresses.usdc,
      addresses.challengeFactory,
      stakeAmountUSDC
    );

    // 2. Accept challenge
    const provider = new BrowserProvider(privyWallet.getEthereumProvider());
    const signer = await provider.getSigner();

    const factoryContract = new Contract(
      addresses.challengeFactory,
      CHALLENGE_FACTORY_ABI,
      signer
    );

    console.log("Accepting challenge:", challengeId, "with side:", participantSide);
    const ZERO_BYTES32 = '0x' + '00'.repeat(32);
    const tx = await factoryContract.acceptP2PChallenge(challengeId, participantSide, 0, 0, ZERO_BYTES32, ZERO_BYTES32);
    const receipt = await tx.wait();

    if (!receipt) throw new Error("Challenge acceptance failed");
    return receipt.transactionHash;
  } catch (error) {
    console.error("Accept challenge error:", error);
    throw error;
  }
}

/**
 * Get challenge details
 */
export async function getChallengeDetails(
  privyWallet: any,
  challengeFactoryAddress: string,
  challengeId: number
): Promise<any> {
  try {
    const provider = new BrowserProvider(privyWallet.getEthereumProvider());
    const factoryContract = new Contract(
      challengeFactoryAddress,
      CHALLENGE_FACTORY_ABI,
      provider
    );

    const challenge = await factoryContract.challenges(challengeId);
    return {
      id: challenge.id.toString(),
      stakeAmount: formatUnits(challenge.stakeAmount, 6),
      pointsReward: challenge.pointsReward.toString(),
      status: challenge.status,
      winner: challenge.winner,
      creator: challenge.creator,
      participant: challenge.participant,
    };
  } catch (error) {
    console.error("Get challenge details error:", error);
    throw error;
  }
}

/**
 * Get on-chain balances for an address: native (ETH), USDC, USDT, and points token.
 * Accepts either a Privy wallet object (with getEthereumProvider) or a window/provider object.
 * Returns raw smallest-unit strings for each token (e.g., wei, usdc 6-decimals integer).
 */
export async function getBalances(providerOrPrivy: any, address: string, chainId?: number): Promise<{ nativeBalance?: string; usdcBalance?: string; usdtBalance?: string; pointsBalance?: string; providerName?: string; chainId?: number }>{
  try {
    if (!providerOrPrivy || !address) return {};

    let provider: any = null;
    let providerDebugInfo = '';
    
    // Map chain IDs to their RPC URLs
    const CHAIN_RPC_MAP: Record<number, string> = {
      84532: (import.meta as any).env?.VITE_BASE_TESTNET_RPC || 'https://sepolia.base.org',
      80002: (import.meta as any).env?.VITE_POLYGON_TESTNET_RPC || 'https://rpc-amoy.polygon.technology',
      421614: (import.meta as any).env?.VITE_ARBITRUM_TESTNET_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
    };

    // Determine RPC URL based on chain ID
    const RPC_URL = chainId && CHAIN_RPC_MAP[chainId] 
      ? CHAIN_RPC_MAP[chainId]
      : CHAIN_RPC_MAP[84532]; // Default to Base Sepolia
    
    if (providerOrPrivy.getEthereumProvider) {
      // Privy embedded wallet
      provider = new BrowserProvider(providerOrPrivy.getEthereumProvider());
      providerDebugInfo = 'Privy embedded wallet';
    } else if (providerOrPrivy.request || providerOrPrivy.on) {
      // EIP-1193 provider (e.g., window.ethereum from MetaMask/Rainbow)
      // Use RPC URL for read-only operations to avoid account rejection
      provider = new JsonRpcProvider(RPC_URL);
      providerDebugInfo = `RPC URL (read-only for MetaMask-injected provider) - Chain ${chainId}`;
    } else if (typeof providerOrPrivy === 'string') {
      // RPC URL
      provider = new JsonRpcProvider(providerOrPrivy);
      providerDebugInfo = 'RPC URL provider';
    } else {
      // Fallback: use RPC URL
      provider = new JsonRpcProvider(RPC_URL);
      providerDebugInfo = 'RPC URL fallback';
    }

    if (!provider) {
      console.warn(`getBalances: No provider could be initialized for address ${address}`);
      return {};
    }

    // Read configured token addresses from env
    const USDC = (import.meta as any).env?.VITE_USDC_ADDRESS;
    const USDT = (import.meta as any).env?.VITE_USDT_ADDRESS;
    const POINTS = (import.meta as any).env?.VITE_POINTS_CONTRACT_ADDRESS;

    const results: any = {};

    // Native balance (wei)
    try {
      const native = await provider.getBalance(address);
      results.nativeBalance = native.toString();
    } catch (err) {
      results.nativeBalance = '0';
    }

    // ERC20 balances
    const checks: Array<Promise<void>> = [];

    if (USDC) {
      const usdcContract = new Contract(USDC, ERC20_ABI, provider);
      checks.push(
        usdcContract.balanceOf(address).then((b: any) => { results.usdcBalance = b.toString(); }).catch(() => { results.usdcBalance = '0'; })
      );
    }

    if (USDT) {
      const usdtContract = new Contract(USDT, ERC20_ABI, provider);
      checks.push(
        usdtContract.balanceOf(address).then((b: any) => { results.usdtBalance = b.toString(); }).catch(() => { results.usdtBalance = '0'; })
      );
    }

    if (POINTS) {
      const ptsContract = new Contract(POINTS, ERC20_ABI, provider);
      checks.push(
        ptsContract.balanceOf(address).then((b: any) => { results.pointsBalance = b.toString(); }).catch(() => { results.pointsBalance = '0'; })
      );
    }

    await Promise.all(checks);

    // Add network/chain info
    try {
      const network = await provider.getNetwork();
      results.chainId = network.chainId;
    } catch (err) {
      results.chainId = undefined;
    }

    // Provider name hints
    try {
      if (providerOrPrivy.getEthereumProvider) results.providerName = 'privy';
      else if (typeof providerOrPrivy === 'string') results.providerName = 'rpc';
      else if (providerOrPrivy.isMetaMask) results.providerName = 'metamask';
      else if (providerOrPrivy.request) results.providerName = 'injected';
      else results.providerName = 'unknown';
    } catch (err) {
      results.providerName = 'unknown';
    }

    return results;
  } catch (error) {
    console.error('getBalances error', error);
    return {};
  }
}
