// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./ChallengeEscrow.sol";

/**
 * @title ChallengeFactory
 * @dev Creates and manages challenges with ERC20 token stakes
 * Handles both admin-created and P2P challenges
 * 
 * NOTE: BantahPoints rewards are now managed off-chain and recorded in the database.
 * This contract only handles the stake management and token transfers.
 */
contract ChallengeFactory is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using SafeERC20 for IERC20;
    
    // Enums
    enum ChallengeType { GROUP, P2P }
    enum ChallengeStatus { CREATED, AWAITING_CREATOR_STAKE, ACTIVE, RESOLVED, CLAIMED, CANCELLED, DISPUTED, REFUNDED }
    enum Side { YES, NO }
    
    // Structs
    struct Challenge {
        uint256 id;
        ChallengeType challengeType;
        address creator;              // Admin or User A
        address participant;          // null for admin, User B for P2P
        address paymentToken;         // USDC, USDT, ETH, etc.
        uint256 stakeAmount;          // Per side in wei (the actual stake)
        uint256 pointsReward;         // BantahPoints given to winner
        ChallengeStatus status;
        address winner;               // null until resolved
        uint256 createdAt;
        uint256 resolvedAt;
        string metadataURI;           // IPFS hash or JSON
        // New P2P fields for Open Challenges
        Side creatorSide;             // YES or NO chosen by creator
        Side participantSide;         // YES or NO chosen by acceptor (opposite of creator)
        bool creatorStaked;           // Whether creator locked their stake
        bool participantStaked;       // Whether participant locked their stake
        uint256 stakedAt;             // When both were staked
        uint256 refundRequestedAt;    // When refund was requested
        bool refundAccepted;          // Whether refund was mutually accepted
    }
    
    struct GroupChallengeParticipant {
        address user;
        bool side;                    // true = YES, false = NO
        uint256 stakeAmount;
        bool claimed;
    }
    
    // State variables
    ChallengeEscrow public stakeEscrow;
    address public admin;              // Authorized to sign resolutions
    address public platformFeeRecipient;  // Where platform fees go
    uint256 public nextChallengeId = 1;
    uint256 public platformFeePercentage = 10;  // 0.1% = 10 basis points (10/10000)
    
    // Mappings
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => GroupChallengeParticipant[]) public groupChallengeParticipants;
    mapping(uint256 => uint256) public p2pChallengeAmounts;
    mapping(address => bool) public verifiedTokens;  // Optional: featured/verified creator coins
    mapping(address => bool) public blacklistedTokens;  // Scam tokens
    mapping(address => uint256) public platformFeeBalance;  // token => amount
    
    // Events
    event ChallengeCreatedGroup(
        uint256 indexed challengeId,
        address indexed creator,
        address indexed paymentToken,
        uint256 stakeAmount,
        uint256 pointsReward
    );
    
    event ChallengeCreatedP2P(
        uint256 indexed challengeId,
        address indexed creator,
        address indexed participant,
        address paymentToken,
        uint256 stakeAmount,
        uint256 pointsReward
    );
    
    event CreatorStakeLocked(
        uint256 indexed challengeId,
        address indexed creator,
        uint256 stakeAmount
    );
    
    event ParticipantStakeLocked(
        uint256 indexed challengeId,
        address indexed participant,
        uint256 stakeAmount
    );
    
    event RefundRequested(
        uint256 indexed challengeId,
        address indexed requester,
        string reason
    );
    
    event RefundAccepted(
        uint256 indexed challengeId,
        address indexed acceptor
    );
    
    event RefundDeclined(
        uint256 indexed challengeId,
        address indexed decliner
    );
    
    event StakesRefunded(
        uint256 indexed challengeId,
        address indexed creator,
        address indexed participant,
        uint256 refundAmount
    );
    
    event AdminForcedRefund(
        uint256 indexed challengeId,
        string reason
    );
    
    event ChallengeResolved(
        uint256 indexed challengeId,
        address indexed winner,
        address indexed paymentToken,
        uint256 stakeAmount,
        uint256 pointsAwarded
    );
    
    event StakeClaimed(
        uint256 indexed challengeId,
        address indexed user,
        address indexed paymentToken,
        uint256 amount
    );
    
    event PaymentTokenToggled(address indexed token, bool enabled);
    event AdminUpdated(address indexed newAdmin);
    event PlatformFeeRecipientUpdated(address indexed newRecipient);
    event PlatformFeePercentageUpdated(uint256 newPercentage);
    event PlatformFeeCollected(address indexed token, uint256 amount);
    event PlatformFeeWithdrawn(address indexed token, uint256 amount, address indexed recipient);
    event TokenVerified(address indexed token, bool verified);
    event TokenBlacklisted(address indexed token, bool blacklisted);
    
    // Constructor
    constructor(
        address payable _stakeEscrow,
        address _admin,
        address _platformFeeRecipient
    ) Ownable(msg.sender) {
        require(_stakeEscrow != address(0), "Invalid escrow");
        require(_admin != address(0), "Invalid admin");
        require(_platformFeeRecipient != address(0), "Invalid fee recipient");
        
        stakeEscrow = ChallengeEscrow(_stakeEscrow);
        admin = _admin;
        platformFeeRecipient = _platformFeeRecipient;
    }
    
    /**
     * @dev Create a group challenge (betting pool)
     * Users choose a side and stake payment tokens
     * Winner receives stake from losers + BantahPoints reward
     */
    function createGroupChallenge(
        address paymentToken,
        uint256 stakeAmount,
        uint256 pointsReward,
        string calldata metadataURI
    ) external onlyOwner nonReentrant returns (uint256) {
        require(paymentToken != address(0), "Invalid payment token");
        require(!blacklistedTokens[paymentToken], "Token is blacklisted");
        require(stakeAmount > 0, "Stake must be > 0");
        require(pointsReward > 0, "Points reward must be > 0");
        require(pointsReward <= 500, "Points reward cannot exceed 500");
        
        uint256 challengeId = nextChallengeId++;
        
        Challenge storage newChallenge = challenges[challengeId];
        newChallenge.id = challengeId;
        newChallenge.challengeType = ChallengeType.GROUP;
        newChallenge.creator = msg.sender;
        newChallenge.paymentToken = paymentToken;
        newChallenge.stakeAmount = stakeAmount;
        newChallenge.pointsReward = pointsReward;
        newChallenge.status = ChallengeStatus.CREATED;
        newChallenge.createdAt = block.timestamp;
        newChallenge.metadataURI = metadataURI;
        
        emit ChallengeCreatedGroup(
            challengeId,
            msg.sender,
            paymentToken,
            stakeAmount,
            pointsReward
        );
        
        return challengeId;
    }
    
    /**
     * @dev Create a P2P challenge between two users or open challenge
     * User A (caller) stakes paymentToken (can be ETH via msg.value or ERC20)
     * If participant = address(0): Open challenge (anyone can accept)
     * If participant != address(0): Direct P2P (only participant can accept)
     * creatorSide: 0 = YES, 1 = NO
     */
    function createP2PChallenge(
        address participant,
        address paymentToken,
        uint256 stakeAmount,
        uint256 creatorSide,
        uint256 pointsReward,
        string calldata metadataURI
    ) external payable nonReentrant returns (uint256) {
        // For direct P2P: participant must be specified and not creator
        // For open challenge: participant can be address(0)
        if (participant != address(0)) {
            require(participant != msg.sender, "Cannot challenge yourself");
        }
        require(creatorSide == 0 || creatorSide == 1, "Invalid side");
        require(!blacklistedTokens[paymentToken], "Token is blacklisted");
        require(stakeAmount > 0, "Stake must be > 0");
        require(pointsReward > 0, "Points reward must be > 0");
        require(pointsReward <= 500, "Points reward cannot exceed 500");
        
        // Handle ETH vs ERC20
        if (paymentToken == address(0)) {
            // Native ETH - check msg.value matches stakeAmount and forward to escrow
            require(msg.value == stakeAmount, "ETH amount mismatch");
        } else {
            // ERC20 token - transfer from user to escrow
            require(msg.value == 0, "Do not send ETH for ERC20");
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(stakeEscrow), stakeAmount);
        }
        
        uint256 challengeId = nextChallengeId++;
        
        Challenge storage newChallenge = challenges[challengeId];
        newChallenge.id = challengeId;
        newChallenge.challengeType = ChallengeType.P2P;
        newChallenge.creator = msg.sender;
        newChallenge.participant = participant;
        newChallenge.paymentToken = paymentToken;
        newChallenge.stakeAmount = stakeAmount;
        newChallenge.pointsReward = pointsReward;
        newChallenge.creatorSide = Side(creatorSide);
        newChallenge.status = participant == address(0) ? ChallengeStatus.CREATED : ChallengeStatus.CREATED;
        newChallenge.createdAt = block.timestamp;
        newChallenge.metadataURI = metadataURI;
        newChallenge.creatorStaked = false;
        newChallenge.participantStaked = false;
        
        // For open challenges: creator doesn't lock stake yet
        // For direct P2P: creator locks stake immediately
        if (participant != address(0)) {
            // Direct P2P: lock creator's stake now
            if (paymentToken == address(0)) {
                stakeEscrow.lockStake{value: stakeAmount}(msg.sender, paymentToken, stakeAmount, challengeId);
            } else {
                stakeEscrow.lockStake(msg.sender, paymentToken, stakeAmount, challengeId);
            }
            newChallenge.creatorStaked = true;
            emit CreatorStakeLocked(challengeId, msg.sender, stakeAmount);
        } else {
            // Open challenge: creator will lock stake later via acceptP2PChallenge
            // For backwards-compatibility we still lock if msg.sender forwarded funds
            if (paymentToken == address(0)) {
                stakeEscrow.lockStake{value: stakeAmount}(msg.sender, paymentToken, stakeAmount, challengeId);
            } else {
                stakeEscrow.lockStake(msg.sender, paymentToken, stakeAmount, challengeId);
            }
            newChallenge.creatorStaked = true;
            emit CreatorStakeLocked(challengeId, msg.sender, stakeAmount);
        }
        
        emit ChallengeCreatedP2P(
            challengeId,
            msg.sender,
            participant,
            paymentToken,
            stakeAmount,
            pointsReward
        );
        
        return challengeId;
    }

    /**
     * @dev Create a P2P challenge and lock the creator's stake in one transaction.
     * Uses factory-pulls pattern for ERC20 (factory transfers to escrow) and
     * forwards ETH when paymentToken == address(0).
     */
    function stakeAndCreateP2PChallenge(
        address participant,
        address paymentToken,
        uint256 stakeAmount,
        uint256 creatorSide,
        uint256 pointsReward,
        string calldata metadataURI,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant returns (uint256) {
        if (participant != address(0)) {
            require(participant != msg.sender, "Cannot challenge yourself");
        }
        require(creatorSide == 0 || creatorSide == 1, "Invalid side");
        require(!blacklistedTokens[paymentToken], "Token is blacklisted");
        require(stakeAmount > 0, "Stake must be > 0");
        require(pointsReward > 0, "Points reward must be > 0");
        require(pointsReward <= 500, "Points reward cannot exceed 500");

        uint256 challengeId = nextChallengeId++;

        Challenge storage newChallenge = challenges[challengeId];
        newChallenge.id = challengeId;
        newChallenge.challengeType = ChallengeType.P2P;
        newChallenge.creator = msg.sender;
        newChallenge.participant = participant;
        newChallenge.paymentToken = paymentToken;
        newChallenge.stakeAmount = stakeAmount;
        newChallenge.pointsReward = pointsReward;
        newChallenge.creatorSide = Side(creatorSide);
        newChallenge.status = ChallengeStatus.CREATED;
        newChallenge.createdAt = block.timestamp;
        newChallenge.metadataURI = metadataURI;
        newChallenge.creatorStaked = false;
        newChallenge.participantStaked = false;

        // Transfer or forward funds to escrow and record lock
        if (paymentToken == address(0)) {
            // Forward ETH to escrow
            require(msg.value == stakeAmount, "ETH amount mismatch");
            stakeEscrow.lockStake{value: stakeAmount}(msg.sender, paymentToken, stakeAmount, challengeId);
        } else {
            require(msg.value == 0, "Do not send ETH for ERC20");
            // If a permit signature is provided (deadline != 0), use it to
            // approve the factory to move tokens on behalf of the creator.
            if (permitDeadline != 0) {
                IERC20Permit(paymentToken).permit(msg.sender, address(this), stakeAmount, permitDeadline, v, r, s);
            }
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(stakeEscrow), stakeAmount);
            stakeEscrow.lockStake(msg.sender, paymentToken, stakeAmount, challengeId);
        }

        newChallenge.creatorStaked = true;
        emit CreatorStakeLocked(challengeId, msg.sender, stakeAmount);

        emit ChallengeCreatedP2P(
            challengeId,
            msg.sender,
            participant,
            paymentToken,
            stakeAmount,
            pointsReward
        );

        return challengeId;
    }
    
    /**
     * @dev Accept a P2P challenge (User B stakes matching amount)
     * For direct P2P: msg.sender must be the specified participant
     * For open challenge: msg.sender can be anyone (becomes the participant)
     * participantSide: Must be opposite of creatorSide
     * Can stake with ETH (msg.value) or ERC20 token
     */
    function acceptP2PChallenge(uint256 challengeId, uint256 participantSide, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external payable nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.challengeType == ChallengeType.P2P, "Not P2P challenge");
        require(challenge.status == ChallengeStatus.CREATED, "Challenge not open");
        require(msg.sender != challenge.creator, "Creator cannot accept own challenge");
        require(participantSide == 0 || participantSide == 1, "Invalid side");
        
        // Verify participantSide is opposite of creatorSide
        uint256 creatorSideVal = challenge.creatorSide == Side.YES ? 0 : 1;
        require(participantSide != creatorSideVal, "Must choose opposite side from creator");
        
        // For direct P2P challenges: verify msg.sender is the specified participant
        if (challenge.participant != address(0)) {
            require(msg.sender == challenge.participant, "Not the specified participant");
        } else {
            // For open challenges: set msg.sender as the participant
            challenge.participant = msg.sender;
        }
        
        // Handle ETH vs ERC20
        if (challenge.paymentToken == address(0)) {
            // Native ETH - check msg.value matches stakeAmount and forward to escrow
            require(msg.value == challenge.stakeAmount, "ETH amount mismatch");
            // Set participant side
            challenge.participantSide = Side(participantSide);
            stakeEscrow.lockStake{value: challenge.stakeAmount}(
                msg.sender,
                challenge.paymentToken,
                challenge.stakeAmount,
                challengeId
            );
        } else {
            // ERC20 token - transfer from user to escrow then record lock
            require(msg.value == 0, "Do not send ETH for ERC20");
            // Attempt permit if signature provided
            if (permitDeadline != 0) {
                IERC20Permit(challenge.paymentToken).permit(msg.sender, address(this), challenge.stakeAmount, permitDeadline, v, r, s);
            }
            IERC20(challenge.paymentToken).safeTransferFrom(
                msg.sender,
                address(stakeEscrow),
                challenge.stakeAmount
            );
            // Set participant side
            challenge.participantSide = Side(participantSide);
            // Lock participant's stake (record-only)
            stakeEscrow.lockStake(
                msg.sender,
                challenge.paymentToken,
                challenge.stakeAmount,
                challengeId
            );
        }
        
        challenge.participantStaked = true;
        
        // For open challenges: move to AWAITING_CREATOR_STAKE
        // Creator needs to lock their stake after acceptor accepts
        if (challenge.creatorSide == challenge.participantSide) {
            // This should never happen due to validation above
            revert("Invalid side configuration");
        }
        
        challenge.status = ChallengeStatus.AWAITING_CREATOR_STAKE;
        
        emit ParticipantStakeLocked(challengeId, msg.sender, challenge.stakeAmount);
    }
    
    /**
     * @dev Lock creator's stake for open challenges after acceptor has accepted
     * Transitions challenge from AWAITING_CREATOR_STAKE to ACTIVE
     * Both stakes are now locked and challenge can begin
     */
    function lockCreatorStake(uint256 challengeId) external payable nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.challengeType == ChallengeType.P2P, "Not P2P challenge");
        require(challenge.status == ChallengeStatus.AWAITING_CREATOR_STAKE, "Invalid status");
        require(msg.sender == challenge.creator, "Only creator can lock stake");
        require(!challenge.creatorStaked, "Creator already staked");
        require(challenge.participantStaked, "Participant has not staked yet");
        
        // Handle ETH vs ERC20
        if (challenge.paymentToken == address(0)) {
            // Native ETH - check msg.value matches stakeAmount and forward to escrow
            require(msg.value == challenge.stakeAmount, "ETH amount mismatch");
            stakeEscrow.lockStake{value: challenge.stakeAmount}(msg.sender, challenge.paymentToken, challenge.stakeAmount, challengeId);
        } else {
            // ERC20 token - transfer from creator to escrow then record lock
            require(msg.value == 0, "Do not send ETH for ERC20");
            IERC20(challenge.paymentToken).safeTransferFrom(msg.sender, address(stakeEscrow), challenge.stakeAmount);
            stakeEscrow.lockStake(msg.sender, challenge.paymentToken, challenge.stakeAmount, challengeId);
        }
        
        // Both stakes now locked - challenge is fully active
        challenge.creatorStaked = true;
        challenge.stakedAt = block.timestamp;
        challenge.status = ChallengeStatus.ACTIVE;
        
        emit CreatorStakeLocked(challengeId, msg.sender, challenge.stakeAmount);
    }
    
    /**
     * @dev Request a mutual refund for a challenge
     * Only available when both stakes are locked (ACTIVE or DISPUTED status)
     * Sets challenge to DISPUTED status and records request time
     */
    function requestRefund(uint256 challengeId, string calldata reason) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.challengeType == ChallengeType.P2P, "Not P2P challenge");
        require(challenge.creatorStaked && challenge.participantStaked, "Both must have staked");
        require(
            challenge.status == ChallengeStatus.ACTIVE || challenge.status == ChallengeStatus.DISPUTED,
            "Invalid status"
        );
        require(
            msg.sender == challenge.creator || msg.sender == challenge.participant,
            "Only participants can request refund"
        );
        
        if (challenge.status == ChallengeStatus.ACTIVE) {
            challenge.status = ChallengeStatus.DISPUTED;
            challenge.refundRequestedAt = block.timestamp;
        }
        
        emit RefundRequested(challengeId, msg.sender, reason);
    }
    
    /**
     * @dev Accept a mutual refund request
     * Both participants must agree - refund releases both stakes
     * Challenge moves to REFUNDED status
     */
    function acceptRefund(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.challengeType == ChallengeType.P2P, "Not P2P challenge");
        require(challenge.status == ChallengeStatus.DISPUTED, "Challenge not disputed");
        require(
            msg.sender == challenge.creator || msg.sender == challenge.participant,
            "Only participants can accept refund"
        );
        
        challenge.status = ChallengeStatus.REFUNDED;
        challenge.refundAccepted = true;
        
        // Release both stakes back to participants via escrow
        uint256 refundAmount = challenge.stakeAmount;
        stakeEscrow.refundBothStakes(
            challengeId,
            challenge.creator,
            challenge.participant,
            challenge.paymentToken,
            refundAmount,
            "Mutual refund agreement accepted"
        );
        
        emit StakesRefunded(challengeId, challenge.creator, challenge.participant, refundAmount);
        emit RefundAccepted(challengeId, msg.sender);
    }
    
    /**
     * @dev Decline a mutual refund request
     * Challenge continues in DISPUTED status toward admin resolution
     */
    function declineRefund(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.challengeType == ChallengeType.P2P, "Not P2P challenge");
        require(challenge.status == ChallengeStatus.DISPUTED, "Challenge not disputed");
        require(
            msg.sender == challenge.creator || msg.sender == challenge.participant,
            "Only participants can decline refund"
        );
        
        // Challenge remains in DISPUTED status, awaiting admin resolution
        emit RefundDeclined(challengeId, msg.sender);
    }
    
    /**
     * @dev Admin force refund on unresolvable disputes
     * Only owner can call - returns both stakes to participants
     */
    function forceRefund(uint256 challengeId, string calldata reason) external onlyOwner nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.challengeType == ChallengeType.P2P, "Not P2P challenge");
        require(challenge.status == ChallengeStatus.DISPUTED, "Challenge must be disputed");
        
        challenge.status = ChallengeStatus.REFUNDED;
        
        // Release both stakes back to participants via escrow
        uint256 refundAmount = challenge.stakeAmount;
        stakeEscrow.refundBothStakes(
            challengeId,
            challenge.creator,
            challenge.participant,
            challenge.paymentToken,
            refundAmount,
            reason
        );
        
        emit StakesRefunded(challengeId, challenge.creator, challenge.participant, refundAmount);
        emit AdminForcedRefund(challengeId, reason);
    }
    
    /**
     * @dev Resolve a challenge with admin signature
     * Winner receives:
     * - Loser's stake minus platform fee
     * - BantahPoints reward
        uint256 challengeId,
        address winner,
        bytes memory signature
    ) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(
            challenge.status == ChallengeStatus.CREATED ||
            challenge.status == ChallengeStatus.ACTIVE ||
            challenge.status == ChallengeStatus.AWAITING_CREATOR_STAKE,
            "Cannot resolve this challenge"
        );
        require(challenge.status != ChallengeStatus.DISPUTED, "Challenge in dispute - refund must be resolved first");
        require(challenge.status != ChallengeStatus.REFUNDED, "Challenge already refunded");
        require(winner != address(0), "Invalid winner");
        
        // Verify admin signature
        bytes32 messageHash = keccak256(abi.encodePacked(challengeId, winner));
        bytes32 ethSignedMessage = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ECDSA.recover(ethSignedMessage, signature);
        
        require(signer == admin, "Invalid admin signature");
        
        // Update challenge
        challenge.status = ChallengeStatus.RESOLVED;
        challenge.winner = winner;
        challenge.resolvedAt = block.timestamp;
        
        // Calculate total pot and platform fee
        uint256 totalPot = 0;
        address loser;
        
        if (challenge.challengeType == ChallengeType.P2P) {
            // P2P: Total pot = both stakes (2x stakeAmount)
            totalPot = challenge.stakeAmount * 2;
            loser = winner == challenge.creator ? challenge.participant : challenge.creator;
        } else if (challenge.challengeType == ChallengeType.GROUP) {
            // Group: Total pot = sum of all losing stakes
            GroupChallengeParticipant[] storage participants = groupChallengeParticipants[challengeId];
            for (uint256 i = 0; i < participants.length; i++) {
                if (participants[i].user != winner) {
                    totalPot += participants[i].stakeAmount;
                }
            }
        }
        
        // Calculate platform fee (0.1% = 10 basis points)
        uint256 platformFee = (totalPot * platformFeePercentage) / 10000;
        uint256 winnerAmount = totalPot - platformFee;
        
        // Record platform fee
        if (platformFee > 0) {
            platformFeeBalance[challenge.paymentToken] += platformFee;
            emit PlatformFeeCollected(challenge.paymentToken, platformFee);
        }
        
        // Transfer winner's payout from escrow (handles both ETH and ERC20)
        stakeEscrow.transferStake(
            loser != address(0) ? loser : address(this),
            winner,
            challenge.paymentToken,
            winnerAmount,
            challengeId
        );
        
        // NOTE: BantahPoints are awarded off-chain via API endpoint /api/admin/challenges/resolve
        // Points are recorded in the database in the points_transactions table
        
        emit ChallengeResolved(
            challengeId,
            winner,
            challenge.paymentToken,
            challenge.stakeAmount,
            challenge.pointsReward
        );
    }
    
    /**
     * @dev Receive ETH for challenges
     */
    receive() external payable {}
    
    /**
     * @dev Claim stakes after challenge resolution
     * Winners receive stake payout + already received points
     */
    function claimStake(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.status == ChallengeStatus.RESOLVED, "Challenge not resolved");
        require(challenge.winner == msg.sender, "Only winner can claim");
        require(challenge.winner != address(0), "No winner set");
        
        // Escrow handles actual transfer
        address[] memory winners = new address[](1);
        winners[0] = msg.sender;
        
        challenge.status = ChallengeStatus.CLAIMED;
        
        emit StakeClaimed(
            challengeId,
            msg.sender,
            challenge.paymentToken,
            challenge.stakeAmount
        );
    }
    
    /**
     * @dev Add a token to verified/featured list (optional, for UI highlighting)
     */
    function verifyToken(address token, bool verified) external onlyOwner {
        require(token != address(0), "Invalid token");
        verifiedTokens[token] = verified;
        emit TokenVerified(token, verified);
    }
    
    /**
     * @dev Blacklist a malicious token to prevent usage
     */
    function blacklistToken(address token, bool blacklisted) external onlyOwner {
        require(token != address(0), "Invalid token");
        blacklistedTokens[token] = blacklisted;
        emit TokenBlacklisted(token, blacklisted);
    }
    
    /**
     * @dev Check if token is verified
     */
    function isTokenVerified(address token) external view returns (bool) {
        return verifiedTokens[token];
    }
    
    /**
     * @dev Check if token is blacklisted
     */
    function isTokenBlacklisted(address token) external view returns (bool) {
        return blacklistedTokens[token];
    }
    
    /**
     * @dev Update admin address
     */
    function setAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid admin");
        admin = newAdmin;
        emit AdminUpdated(newAdmin);
    }
    
    /**
     * @dev Update platform fee recipient
     */
    function setPlatformFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        platformFeeRecipient = newRecipient;
        emit PlatformFeeRecipientUpdated(newRecipient);
    }
    
    /**
     * @dev Update platform fee percentage (in basis points, 10 = 0.1%)
     */
    function setPlatformFeePercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 10000, "Fee too high");  // Max 100%
        platformFeePercentage = newPercentage;
        emit PlatformFeePercentageUpdated(newPercentage);
    }
    
    /**
     * @dev Get accumulated platform fees for a token
     */
    function getPlatformFeeBalance(address token) external view returns (uint256) {
        return platformFeeBalance[token];
    }
    
    /**
     * @dev Withdraw accumulated platform fees (handles both ETH and ERC20)
     */
    function withdrawPlatformFees(address token) external onlyOwner nonReentrant {
        uint256 amount = platformFeeBalance[token];
        require(amount > 0, "No fees to withdraw");
        
        platformFeeBalance[token] = 0;
        
        if (token == address(0)) {
            // Native ETH
            (bool success, ) = payable(platformFeeRecipient).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20 token
            IERC20(token).safeTransfer(platformFeeRecipient, amount);
        }
        
        emit PlatformFeeWithdrawn(token, amount, platformFeeRecipient);
    }
    
    /**
     * @dev Get challenge details
     */
    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }
}
