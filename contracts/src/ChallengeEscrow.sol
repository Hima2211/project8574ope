// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChallengeEscrow
 * @dev Holds ERC20 token stakes AND native ETH for challenges
 * Manages locking, releasing, and transferring stakes between users
 */
contract ChallengeEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    address public challengeFactory;  // Only this contract can manage escrow
    
    struct LockedStake {
        address token;           // ERC20 token address (address(0) for ETH)
        uint256 amount;
        uint256 lockedAt;
        uint256 challengeId;
        bool released;
    }
    
    // Mappings
    mapping(address => mapping(address => uint256)) public totalLockedByToken;  // user => token => amount
    mapping(uint256 => address[]) public challengeParticipants;
    mapping(uint256 => LockedStake[]) public challengeStakes;
    
    // Events
    event StakeLocked(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 indexed challengeId
    );
    
    event StakeReleased(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 indexed challengeId
    );
    
    event StakeTransferred(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        uint256 challengeId,
        string reason
    );
    
    event StakesRefunded(
        address indexed user1,
        address indexed user2,
        address indexed token,
        uint256 amount,
        uint256 challengeId,
        string reason
    );
    
    event ChallengeFactoryUpdated(address indexed newFactory);
    
    // Constructor
    constructor(address _challengeFactory) Ownable(msg.sender) {
        require(_challengeFactory != address(0), "Invalid factory");
        challengeFactory = _challengeFactory;
    }
    
    // Modifiers
    modifier onlyFactory() {
        require(msg.sender == challengeFactory, "Only ChallengeFactory");
        _;
    }
    
    /**
     * @dev Receive ETH
     */
    receive() external payable {}
    
    /**
     * @dev Lock stakes for a challenge (handles both ETH and ERC20)
     * Called by ChallengeFactory when user joins challenge
     * For ETH: ChallengeFactory will send ETH to this contract
     * For ERC20: ChallengeFactory transfers from user to this contract
     */
    function lockStake(
        address user,
        address token,
        uint256 amount,
        uint256 challengeId
    ) external payable onlyFactory nonReentrant {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Amount must be > 0");
        // NOTE: The ChallengeFactory should transfer tokens (ERC20) to this
        // contract prior to calling this function (or forward ETH value when
        // calling for native ETH). This function only records the locked
        // stake and assumes the tokens/ETH already reside in the escrow.
        
        // Track locked stake
        LockedStake memory newStake = LockedStake({
            token: token,
            amount: amount,
            lockedAt: block.timestamp,
            challengeId: challengeId,
            released: false
        });
        
        challengeStakes[challengeId].push(newStake);
        totalLockedByToken[user][token] += amount;
        challengeParticipants[challengeId].push(user);
        
        emit StakeLocked(user, token, amount, challengeId);
    }
    
    /**
     * @dev Release locked stakes (e.g., if challenge is cancelled)
     * Returns tokens to users
     */
    function releaseStakes(uint256 challengeId, address[] calldata users) external onlyFactory nonReentrant {
        LockedStake[] storage stakes = challengeStakes[challengeId];
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            
            for (uint256 j = 0; j < stakes.length; j++) {
                LockedStake storage stake = stakes[j];
                
                if (!stake.released) {
                    // Return stake to user
                    if (stake.token == address(0)) {
                        // Native ETH
                        (bool success, ) = payable(user).call{value: stake.amount}("");
                        require(success, "ETH refund failed");
                    } else {
                        // ERC20 token
                        IERC20(stake.token).safeTransfer(user, stake.amount);
                    }
                    totalLockedByToken[user][stake.token] -= stake.amount;
                    stake.released = true;
                    
                    emit StakeReleased(user, stake.token, stake.amount, challengeId);
                }
            }
        }
    }
    
    /**
     * @dev Refund both participants their stakes (mutual agreement/admin override)
     * Called by ChallengeFactory when refund is accepted or admin forces refund
     * Returns tokens to BOTH users equally
     */
    function refundBothStakes(
        uint256 challengeId,
        address user1,
        address user2,
        address token,
        uint256 amount,
        string calldata reason
    ) external onlyFactory nonReentrant {
        require(user1 != address(0) && user2 != address(0), "Invalid users");
        require(amount > 0, "Amount must be > 0");
        
        // Return stakes to both users
        if (token == address(0)) {
            // Native ETH
            (bool success1, ) = payable(user1).call{value: amount}("");
            (bool success2, ) = payable(user2).call{value: amount}("");
            require(success1 && success2, "ETH refund failed");
        } else {
            // ERC20 token
            IERC20(token).safeTransfer(user1, amount);
            IERC20(token).safeTransfer(user2, amount);
        }
        
        // Update tracking
        totalLockedByToken[user1][token] -= amount;
        totalLockedByToken[user2][token] -= amount;
        
        // Mark all stakes as released
        LockedStake[] storage stakes = challengeStakes[challengeId];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].released) {
                stakes[i].released = true;
            }
        }
        
        emit StakesRefunded(user1, user2, token, amount, challengeId, reason);
    }
    
    /**
     * @dev Transfer stakes from loser to winner
     * Called by ChallengeFactory when challenge is resolved
     * Handles both ETH and ERC20
     */
    function transferStake(
        address from,
        address to,
        address token,
        uint256 amount,
        uint256 challengeId
    ) external onlyFactory nonReentrant {
        require(from != address(0), "Invalid from");
        require(to != address(0), "Invalid to");
        require(amount > 0, "Amount must be > 0");
        
        // Update tracking
        totalLockedByToken[from][token] -= amount;
        
        if (token == address(0)) {
            // Native ETH
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20 token
            IERC20(token).safeTransfer(to, amount);
        }
        
        emit StakeTransferred(from, to, token, amount, challengeId, "Challenge settlement");
    }
    
    /**
     * @dev Get total locked amount for user by token
     */
    function getTotalLockedByToken(address user, address token) external view returns (uint256) {
        return totalLockedByToken[user][token];
    }
    
    /**
     * @dev Get all stakes for a challenge
     */
    function getChallengeStakes(uint256 challengeId) external view returns (LockedStake[] memory) {
        return challengeStakes[challengeId];
    }
    
    /**
     * @dev Get challenge participants
     */
    function getChallengeParticipants(uint256 challengeId) external view returns (address[] memory) {
        return challengeParticipants[challengeId];
    }
    
    /**
     * @dev Update challenge factory address
     */
    function setChallengeFactory(address _newFactory) external onlyOwner {
        require(_newFactory != address(0), "Invalid factory");
        challengeFactory = _newFactory;
        emit ChallengeFactoryUpdated(_newFactory);
    }
}
