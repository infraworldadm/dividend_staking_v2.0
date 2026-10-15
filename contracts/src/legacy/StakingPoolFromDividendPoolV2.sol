// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract StakingPoolFromDividendPoolV2 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    uint256 private constant PRECISION = 1e24;
    uint256 public constant REWARD_EXPIRY_WINDOW = 30 days;

    address public dividendPool;
    address public rewardAdmin;

    struct UserInfo {
        uint256 amount;
        uint256 startDate;
        uint256 countOfPeriods;
        uint256 endDate;

        uint256 weight;
        uint256 lastUpdate;
        uint256 rewardDebt;

        uint256 pendingClaimable;
        uint256 totalClaimed;

        uint256 rewardExpiryAt;
        uint256 expiredRewardsTotal;
    }

    mapping(address => UserInfo) public users;

    uint256 public totalStaked;
    uint256 public totalLocked;

    uint256 public totalWeight;
    uint256 public lastGlobalUpdate;
    uint256 public accRewardPerWeight;

    uint256 public rewardVaultBalance;
    uint256 public undistributedRewards;

    uint256 public totalRewarded;
    uint256 public totalExpired;

    event Staked(address indexed user, uint256 amount, uint256 unlockTime, uint256 periods);
    event Claimed(address indexed user, uint256 reward);
    event Withdrawn(address indexed user, uint256 principal, uint256 reward);

    event DividendPoolUpdated(address indexed oldDividendPool, address indexed newDividendPool);
    event RewardAdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    event RewardFundedFromDividendPool(address indexed dividendPool, uint256 amount);
    event RewardSynced(address indexed caller, uint256 amount);

    event PoolUpdated(
        uint256 totalWeight,
        uint256 accRewardPerWeight,
        uint256 distributedReward,
        uint256 timestamp
    );

    event RewardExpirySet(address indexed user, uint256 expiryAt);
    event UnclaimedRewardExpired(address indexed user, uint256 amount, address indexed sentTo);

    event EmergencyWithdraw(address indexed to, uint256 amount);
    event FreshStateInitialized(address indexed dividendPool, address indexed rewardAdmin, uint256 timestamp);

    modifier onlyDividendPool() {
        require(msg.sender == dividendPool, "Only dividend pool");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        address initialDividendPool
    ) public initializer {
        require(initialOwner != address(0), "owner=0");
        require(initialDividendPool != address(0), "dividendPool=0");

        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        dividendPool = initialDividendPool;
        rewardAdmin = initialOwner;
        lastGlobalUpdate = block.timestamp;
    }

    /**
     * @notice Use this after upgrading an existing proxy where the new staking state
     * was not initialized correctly.
     * @dev Only safe because you confirmed there are no real active staking users.
     */
    function initializeV2Fresh(
        address newDividendPool,
        address newRewardAdmin
    ) external reinitializer(2) onlyOwner {
        require(newDividendPool != address(0), "dividendPool=0");
        require(newRewardAdmin != address(0), "rewardAdmin=0");

        dividendPool = newDividendPool;
        rewardAdmin = newRewardAdmin;

        totalStaked = 0;
        totalLocked = 0;

        totalWeight = 0;
        lastGlobalUpdate = block.timestamp;
        accRewardPerWeight = 0;

        rewardVaultBalance = 0;
        undistributedRewards = 0;

        totalRewarded = 0;
        totalExpired = 0;

        emit FreshStateInitialized(newDividendPool, newRewardAdmin, block.timestamp);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}

    // -------------------- Admin config --------------------

    function setDividendPool(address newDividendPool) external onlyOwner {
        require(newDividendPool != address(0), "dividendPool=0");

        address old = dividendPool;
        dividendPool = newDividendPool;

        emit DividendPoolUpdated(old, newDividendPool);
    }

    function setRewardAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "admin=0");

        address old = rewardAdmin;
        rewardAdmin = newAdmin;

        emit RewardAdminUpdated(old, newAdmin);
    }

    // -------------------- Reward funding from Dividend Pool --------------------

    function fundRewardsFromDividendPool()
        external
        payable
        onlyDividendPool
        nonReentrant
    {
        require(msg.value > 0, "No reward sent");

        _updatePool();

        rewardVaultBalance += msg.value;
        undistributedRewards += msg.value;

        emit RewardFundedFromDividendPool(msg.sender, msg.value);
    }

    function syncReceivedRewards() external onlyOwner nonReentrant {
        _updatePool();

        uint256 balance = address(this).balance;
        uint256 accounted = totalLocked + rewardVaultBalance;

        require(balance >= accounted, "Inconsistent state");

        uint256 extra = balance - accounted;
        require(extra > 0, "No extra rewards");

        rewardVaultBalance += extra;
        undistributedRewards += extra;

        emit RewardSynced(msg.sender, extra);
    }

    // -------------------- Stake / Claim / Withdraw --------------------

    function stake(uint256 periods) external payable nonReentrant {
        require(periods > 0, "Lock must be > 0");
        require(msg.value > 0, "No native coin sent");

        UserInfo storage u = users[msg.sender];
        require(u.amount == 0, "Already staked");

        _updatePool();
        _updateUser(msg.sender);

        u.amount = msg.value;
        u.startDate = block.timestamp;
        u.countOfPeriods = periods;
        u.endDate = block.timestamp + _calculateTimeOfPeriod(periods);
        u.lastUpdate = block.timestamp;

        totalStaked += msg.value;
        totalLocked += msg.value;

        u.rewardDebt = _weightedReward(u.amount, accRewardPerWeight);

        emit Staked(msg.sender, msg.value, u.endDate, periods);
    }

    function claim() external nonReentrant {
        _updatePool();
        _updateUser(msg.sender);

        UserInfo storage u = users[msg.sender];

        uint256 reward = u.pendingClaimable;
        require(reward > 0, "No rewards");

        require(
            u.rewardExpiryAt == 0 || block.timestamp <= u.rewardExpiryAt,
            "Reward expired"
        );

        require(rewardVaultBalance >= reward, "Insufficient reward vault");

        u.pendingClaimable = 0;
        u.rewardExpiryAt = 0;
        u.totalClaimed += reward;

        rewardVaultBalance -= reward;
        totalRewarded += reward;

        (bool sent, ) = payable(msg.sender).call{value: reward}("");
        require(sent, "Reward send failed");

        emit Claimed(msg.sender, reward);
    }

    function withdraw() external nonReentrant {
        _updatePool();
        _updateUser(msg.sender);

        UserInfo storage u = users[msg.sender];

        require(u.amount > 0, "No stake found");
        require(block.timestamp >= u.endDate, "Lock not expired");

        uint256 principal = u.amount;
        uint256 reward = u.pendingClaimable;

        require(
            reward == 0 ||
                u.rewardExpiryAt == 0 ||
                block.timestamp <= u.rewardExpiryAt,
            "Reward expired"
        );

        require(rewardVaultBalance >= reward, "Insufficient reward vault");

        totalStaked -= principal;
        totalLocked -= principal;

        rewardVaultBalance -= reward;
        totalRewarded += reward;

        u.amount = 0;
        u.startDate = 0;
        u.countOfPeriods = 0;
        u.endDate = 0;
        u.weight = 0;
        u.lastUpdate = block.timestamp;
        u.rewardDebt = 0;
        u.pendingClaimable = 0;
        u.rewardExpiryAt = 0;
        u.totalClaimed += reward;

        uint256 totalPayout = principal + reward;

        (bool sent, ) = payable(msg.sender).call{value: totalPayout}("");
        require(sent, "Failed to send");

        emit Withdrawn(msg.sender, principal, reward);
    }

    // -------------------- Expire rewards --------------------

    function expireUnclaimedReward(address user) external nonReentrant {
        _updatePool();
        _updateUser(user);

        UserInfo storage u = users[user];

        uint256 amount = u.pendingClaimable;
        require(amount > 0, "No pending reward");
        require(u.rewardExpiryAt != 0, "Expiry not set");
        require(block.timestamp > u.rewardExpiryAt, "Not expired yet");

        require(rewardVaultBalance >= amount, "Insufficient reward vault");

        u.pendingClaimable = 0;
        u.rewardExpiryAt = 0;
        u.expiredRewardsTotal += amount;

        rewardVaultBalance -= amount;
        totalExpired += amount;

        address to = rewardAdmin == address(0) ? owner() : rewardAdmin;

        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "Expire transfer failed");

        emit UnclaimedRewardExpired(user, amount, to);
    }

    // -------------------- View functions --------------------

    function getUserInfo(address user)
        external
        view
        returns (
            uint256 amount,
            uint256 startDate,
            uint256 countOfPeriods,
            uint256 endDate,
            uint256 pendingClaimable,
            uint256 totalClaimed,
            uint256 rewardExpiryAt
        )
    {
        UserInfo memory u = users[user];

        return (
            u.amount,
            u.startDate,
            u.countOfPeriods,
            u.endDate,
            u.pendingClaimable,
            u.totalClaimed,
            u.rewardExpiryAt
        );
    }

    // -------------------- Internal accounting --------------------

    // NOTE: totalWeight / lastGlobalUpdate (contract-level) and weight / lastUpdate
    // (per-user, in UserInfo) are no longer written to. They are kept declared,
    // unused, so the UUPS storage layout is unaffected by this fix. See the
    // security-fix note above _updatePool for why the previous formula was unsafe.
    //
    // SECURITY FIX: the previous implementation accumulated a per-user "weight"
    // as amount * (time since that user's own last checkpoint), then valued that
    // entire stale span at whatever accRewardPerWeight happened to be at the
    // moment of checkpointing. Because accRewardPerWeight can advance one or more
    // times while a user hasn't personally checkpointed, this retroactively
    // applied a single spot rate to a span that should have been priced at
    // multiple different historical rates — letting an infrequent-checkpointing
    // user accrue pendingClaimable that exceeds what was ever funded (see
    // security review finding). This is replaced with the standard
    // accRewardPerShare pattern: the accumulator advances per unit of
    // *currently staked* principal (not per unit of elapsed time), and each
    // user's pending reward is amount * (accRewardPerWeight_now - rewardDebt),
    // which is exact regardless of checkpoint frequency.
    function _updatePool() internal {
        uint256 distributed = 0;

        if (undistributedRewards > 0 && totalStaked > 0) {
            distributed = undistributedRewards;
            accRewardPerWeight += (distributed * PRECISION) / totalStaked;
            undistributedRewards = 0;
        }

        emit PoolUpdated(
            totalStaked,
            accRewardPerWeight,
            distributed,
            block.timestamp
        );
    }

    function _updateUser(address user) internal {
        UserInfo storage u = users[user];

        uint256 prevPending = u.pendingClaimable;
        uint256 accrued = _weightedReward(u.amount, accRewardPerWeight);

        if (accrued > u.rewardDebt) {
            uint256 addPending = accrued - u.rewardDebt;

            if (addPending > 0) {
                u.pendingClaimable = prevPending + addPending;

                if (prevPending == 0) {
                    u.rewardExpiryAt = block.timestamp + REWARD_EXPIRY_WINDOW;
                    emit RewardExpirySet(user, u.rewardExpiryAt);
                }
            }
        }

        if (u.pendingClaimable == 0) {
            u.rewardExpiryAt = 0;
        }

        u.rewardDebt = accrued;
    }

    function _weightedReward(uint256 weight, uint256 acc)
        internal
        pure
        returns (uint256)
    {
        return (weight * acc) / PRECISION;
    }

    function _calculateTimeOfPeriod(uint256 periods)
        internal
        pure
        returns (uint256)
    {
        return periods * 30 days;
    }

    // -------------------- Emergency --------------------

    function emergencyWithdraw(address payable to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");

        uint256 balance = address(this).balance;
        uint256 protectedAmount = totalLocked + rewardVaultBalance;

        require(balance >= protectedAmount, "inconsistent state");

        uint256 surplus = balance - protectedAmount;
        require(amount <= surplus, "insufficient surplus");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Emergency send failed");

        emit EmergencyWithdraw(to, amount);
    }

    uint256[38] private __gap;
}