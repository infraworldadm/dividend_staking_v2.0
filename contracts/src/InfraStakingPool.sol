// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title InfraStakingPool
 * @notice Monthly reward pool for native reAED stakers on INFRA.
 *
 * How it works
 *  - Cycles ("epochs") are calendar months in UTC. Epoch id = year * 12 + (month - 1).
 *  - A stake made during month M becomes active at the start of month M+1.
 *  - Rewards are network fees forwarded by DividendPoolNativeV2 via
 *    `fundRewardsFromDividendPool()` (or plain transfers). Funds received during
 *    month M are that month's reward pool. No APR is promised.
 *  - Weight = amount x seconds active in the month. A staker's share of month M's
 *    pool = their weight / total weight of month M.
 *  - When month M closes, its rewards are claimable for CLAIM_WINDOW (30 days).
 *    Unclaimed rewards after that expire and can be rolled into the current month
 *    by anyone (`rolloverExpired`).
 *  - Principal is locked for `periods` full months; after that the stake keeps
 *    earning every month until the owner of the stake calls `withdraw()`.
 *  - One active stake per wallet.
 *
 * Owner powers (put the owner behind a multisig): upgrade, set dividend pool,
 * withdraw surplus rewards (never principal), and an emergency withdraw of any
 * amount.
 */
contract InfraStakingPool is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------

    uint256 public constant CLAIM_WINDOW = 30 days;
    uint256 public constant MAX_PERIODS = 12;

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    struct UserInfo {
        uint256 amount; // principal of the latest stake (kept after exit for accounting)
        uint64 stakedAt; // timestamp of stake()
        uint64 periods; // lock length in months
        uint64 activeFrom; // first earning epoch
        uint64 lockEnd; // timestamp after which withdraw() is allowed
        uint64 exitEpoch; // epoch of withdraw(); 0 = still active
        uint64 exitTime; // timestamp of withdraw()
        uint64 lastSettledEpoch; // epochs <= this are claimed or expired for this user
        uint256 totalClaimed;
        uint256 totalExpired;
    }

    mapping(address => UserInfo) public users;

    address public dividendPool;

    /// @notice principal currently held for stakers (active + waiting to activate)
    uint256 public totalStaked;
    /// @notice principal earning in the last synced epoch and later
    uint256 public activeAmount;
    uint256 public lastSyncedEpoch;

    mapping(uint256 => uint256) public scheduledActivation; // epoch => amount starting then
    mapping(uint256 => uint256) public epochBaseWeight; // epoch => activeAmount * epoch length
    mapping(uint256 => uint256) public epochWeightDeduction; // epoch => weight removed by mid-month exits
    mapping(uint256 => uint256) public epochReward; // epoch => reward pool
    mapping(uint256 => uint256) public epochClaimed; // epoch => reward paid out
    mapping(uint256 => bool) public epochRolledOver; // epoch => unclaimed moved forward

    uint256 public totalRewardsReceived;
    uint256 public totalRewardsClaimed;
    uint256 public totalRewardsWithdrawnByOwner;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event Staked(address indexed user, uint256 amount, uint256 periods, uint256 activeFrom, uint256 lockEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 epoch);
    event Claimed(address indexed user, uint256 amount, uint256 fromEpoch, uint256 toEpoch);
    event RewardsExpiredForUser(address indexed user, uint256 amount);
    event RewardsFunded(address indexed from, uint256 indexed epoch, uint256 amount);
    event RewardsRolledOver(uint256 indexed fromEpoch, uint256 indexed toEpoch, uint256 amount);
    event DividendPoolUpdated(address indexed oldPool, address indexed newPool);
    event OwnerRewardsWithdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address dividendPool_) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        dividendPool = dividendPool_;
        lastSyncedEpoch = currentEpoch();
        emit DividendPoolUpdated(address(0), dividendPool_);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ------------------------------------------------------------------
    // Funding
    // ------------------------------------------------------------------

    /// @notice Called by DividendPoolNativeV2.sendRewardsToStaking(). Funds the current month.
    function fundRewardsFromDividendPool() external payable {
        _fund(currentEpoch());
    }

    /// @notice Plain transfers (e.g. sendRewardsToStakingPlain) also fund the current month.
    receive() external payable {
        _fund(currentEpoch());
    }

    /// @notice Owner can fund the current or a future month explicitly.
    function fundEpoch(uint256 epoch) external payable onlyOwner {
        require(epoch >= currentEpoch(), "Epoch closed");
        _fund(epoch);
    }

    function _fund(uint256 epoch) internal {
        require(msg.value > 0, "No reward");
        epochReward[epoch] += msg.value;
        totalRewardsReceived += msg.value;
        emit RewardsFunded(msg.sender, epoch, msg.value);
    }

    // ------------------------------------------------------------------
    // Staking
    // ------------------------------------------------------------------

    /// @notice Stake native reAED. Earning starts at the beginning of next month.
    /// @param periods lock length in months (1..MAX_PERIODS)
    function stake(uint256 periods) external payable nonReentrant {
        require(msg.value > 0, "Amount=0");
        require(periods >= 1 && periods <= MAX_PERIODS, "Bad periods");
        _sync();

        UserInfo storage u = users[msg.sender];
        if (u.amount > 0) {
            require(u.exitEpoch != 0, "Already staked");
            require(u.exitEpoch < currentEpoch(), "Wait for exit cycle to close");
            _settle(msg.sender); // pay what is still claimable before resetting
        }

        uint256 cur = currentEpoch();
        uint256 activeFrom = cur + 1;
        uint256 lockEnd = epochStart(activeFrom + periods);

        users[msg.sender] = UserInfo({
            amount: msg.value,
            stakedAt: uint64(block.timestamp),
            periods: uint64(periods),
            activeFrom: uint64(activeFrom),
            lockEnd: uint64(lockEnd),
            exitEpoch: 0,
            exitTime: 0,
            lastSettledEpoch: uint64(activeFrom - 1),
            totalClaimed: u.totalClaimed,
            totalExpired: u.totalExpired
        });

        scheduledActivation[activeFrom] += msg.value;
        totalStaked += msg.value;

        emit Staked(msg.sender, msg.value, periods, activeFrom, lockEnd);
    }

    /// @notice Withdraw full principal after the lock ends. Also pays closed, claimable months.
    /// The current month keeps the weight earned up to now; claim it after the month closes.
    function withdraw() external nonReentrant {
        UserInfo storage u = users[msg.sender];
        require(u.amount > 0 && u.exitEpoch == 0, "No stake found");
        require(block.timestamp >= u.lockEnd, "Lock not expired");
        _sync();

        uint256 cur = currentEpoch();
        uint256 amount = u.amount;

        activeAmount -= amount;
        epochWeightDeduction[cur] += amount * (epochEnd(cur) - block.timestamp);
        totalStaked -= amount;

        _settle(msg.sender);
        u.exitEpoch = uint64(cur);
        u.exitTime = uint64(block.timestamp);

        _send(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, cur);
    }

    /// @notice Claim rewards of all closed months still inside their claim window.
    function claim() external nonReentrant {
        _sync();
        uint256 paid = _settle(msg.sender);
        require(paid > 0, "No rewards");
    }

    /// @notice After a month's claim window ends (or if nobody had weight), move its
    /// unclaimed rewards into the current month. Callable by anyone.
    function rolloverExpired(uint256 epoch) external {
        _sync();
        uint256 cur = currentEpoch();
        require(epoch < cur, "Epoch not closed");
        require(!epochRolledOver[epoch], "Already rolled");
        require(block.timestamp >= claimDeadline(epoch) || totalWeight(epoch) == 0, "Claim window open");

        epochRolledOver[epoch] = true;
        uint256 left = epochReward[epoch] - epochClaimed[epoch];
        if (left > 0) {
            epochReward[cur] += left;
            emit RewardsRolledOver(epoch, cur, left);
        }
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setDividendPool(address newPool) external onlyOwner {
        require(newPool != address(0), "pool=0");
        emit DividendPoolUpdated(dividendPool, newPool);
        dividendPool = newPool;
    }

    /// @notice Withdraw reward funds only — can never touch stakers' principal.
    function ownerWithdrawRewards(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        require(amount > 0 && amount <= surplusBalance(), "Exceeds reward balance");
        totalRewardsWithdrawnByOwner += amount;
        _send(to, amount);
        emit OwnerRewardsWithdrawn(to, amount);
    }

    /// @notice Emergency: withdraw any amount, including principal. Use only via multisig.
    function emergencyWithdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        require(address(this).balance >= amount, "insufficient balance");
        _send(to, amount);
        emit EmergencyWithdraw(to, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function currentEpoch() public view returns (uint256) {
        return epochOf(block.timestamp);
    }

    function epochOf(uint256 timestamp) public pure returns (uint256) {
        (uint256 y, uint256 m) = _yearMonth(timestamp / 1 days);
        return y * 12 + (m - 1);
    }

    function epochStart(uint256 epoch) public pure returns (uint256) {
        return _daysFromCivil(epoch / 12, (epoch % 12) + 1, 1) * 1 days;
    }

    function epochEnd(uint256 epoch) public pure returns (uint256) {
        return epochStart(epoch + 1);
    }

    function claimDeadline(uint256 epoch) public pure returns (uint256) {
        return epochEnd(epoch) + CLAIM_WINDOW;
    }

    /// @notice Total weight of a month. For the running month this assumes current stakers stay all month.
    function totalWeight(uint256 epoch) public view returns (uint256) {
        if (epoch <= lastSyncedEpoch) {
            return epochBaseWeight[epoch] - epochWeightDeduction[epoch];
        }
        uint256 active = activeAmount;
        for (uint256 e = lastSyncedEpoch + 1; e <= epoch; e++) {
            active += scheduledActivation[e];
        }
        return active * (epochEnd(epoch) - epochStart(epoch));
    }

    function userWeight(address user, uint256 epoch) public view returns (uint256) {
        UserInfo storage u = users[user];
        if (u.amount == 0 || epoch < u.activeFrom) return 0;
        if (u.exitEpoch != 0) {
            if (epoch > u.exitEpoch) return 0;
            if (epoch == u.exitEpoch) return u.amount * (u.exitTime - epochStart(epoch));
        }
        return u.amount * (epochEnd(epoch) - epochStart(epoch));
    }

    /// @notice The user's reward from a given month (whether or not still claimable).
    function userEpochReward(address user, uint256 epoch) public view returns (uint256) {
        uint256 w = userWeight(user, epoch);
        if (w == 0) return 0;
        uint256 tw = totalWeight(epoch);
        return tw == 0 ? 0 : (epochReward[epoch] * w) / tw;
    }

    /// @notice Claimable now (closed months inside their claim window) and the earliest deadline among them.
    function pendingRewards(address user) public view returns (uint256 amount, uint256 nextDeadline) {
        (uint256 from, uint256 to) = _settleRange(user);
        for (uint256 e = from; e <= to && to != type(uint256).max; e++) {
            uint256 r = userEpochReward(user, e);
            if (r > 0 && block.timestamp < claimDeadline(e) && !epochRolledOver[e]) {
                amount += r;
                if (nextDeadline == 0) nextDeadline = claimDeadline(e);
            }
        }
    }

    /// @notice Running-month estimate: user weight, total weight and reward pool so far (no promise).
    function currentEpochShare(address user)
        external
        view
        returns (uint256 epoch, uint256 weight, uint256 total, uint256 rewardSoFar)
    {
        epoch = currentEpoch();
        weight = userWeight(user, epoch);
        total = totalWeight(epoch);
        rewardSoFar = epochReward[epoch];
    }

    function epochInfo(uint256 epoch)
        external
        view
        returns (
            uint256 start,
            uint256 end,
            uint256 deadline,
            uint256 reward,
            uint256 weight,
            uint256 claimed,
            bool rolledOver
        )
    {
        return (
            epochStart(epoch),
            epochEnd(epoch),
            claimDeadline(epoch),
            epochReward[epoch],
            totalWeight(epoch),
            epochClaimed[epoch],
            epochRolledOver[epoch]
        );
    }

    /// @notice Contract balance not owed as principal (rewards, claimable or not).
    function surplusBalance() public view returns (uint256) {
        uint256 bal = address(this).balance;
        return bal > totalStaked ? bal - totalStaked : 0;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /// @dev Snapshot base weight of every month reached since the last sync.
    function _sync() internal {
        uint256 cur = currentEpoch();
        uint256 e = lastSyncedEpoch;
        if (cur <= e) return;
        uint256 active = activeAmount;
        for (e = e + 1; e <= cur; e++) {
            active += scheduledActivation[e];
            epochBaseWeight[e] = active * (epochEnd(e) - epochStart(e));
        }
        activeAmount = active;
        lastSyncedEpoch = cur;
    }

    /// @dev Closed months not yet settled for the user: [from, to]. to = max uint if none.
    function _settleRange(address user) internal view returns (uint256 from, uint256 to) {
        UserInfo storage u = users[user];
        if (u.amount == 0) return (1, type(uint256).max);
        uint256 cur = currentEpoch();
        from = uint256(u.lastSettledEpoch) + 1;
        if (cur == 0) return (1, type(uint256).max);
        to = cur - 1;
        if (u.exitEpoch != 0 && u.exitEpoch < to) to = u.exitEpoch;
        if (to < from) return (1, type(uint256).max);
    }

    /// @dev Pays claimable closed months, marks expired ones. Returns amount paid.
    function _settle(address user) internal returns (uint256 paid) {
        (uint256 from, uint256 to) = _settleRange(user);
        if (to == type(uint256).max) return 0;
        uint256 expired;
        for (uint256 e = from; e <= to; e++) {
            uint256 r = userEpochReward(user, e);
            if (r == 0) continue;
            if (block.timestamp < claimDeadline(e) && !epochRolledOver[e]) {
                paid += r;
                epochClaimed[e] += r;
            } else {
                expired += r;
            }
        }
        UserInfo storage u = users[user];
        u.lastSettledEpoch = uint64(to);
        if (expired > 0) {
            u.totalExpired += expired;
            emit RewardsExpiredForUser(user, expired);
        }
        if (paid > 0) {
            u.totalClaimed += paid;
            totalRewardsClaimed += paid;
            _send(user, paid);
            emit Claimed(user, paid, from, to);
        }
    }

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // Calendar math (proleptic Gregorian, UTC) — Howard Hinnant's algorithms.

    function _daysFromCivil(uint256 y, uint256 m, uint256 d) internal pure returns (uint256) {
        if (m <= 2) y -= 1;
        uint256 era = y / 400;
        uint256 yoe = y - era * 400;
        uint256 mp = m > 2 ? m - 3 : m + 9;
        uint256 doy = (153 * mp + 2) / 5 + d - 1;
        uint256 doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    function _yearMonth(uint256 z) internal pure returns (uint256 y, uint256 m) {
        z += 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;
    }

    uint256[40] private __gap;
}
