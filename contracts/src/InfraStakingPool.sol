// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title  InfraStakingPool
 * @notice Monthly reward pool for native reAED stakers on the INFRA network.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  OVERVIEW
 * ────────────────────────────────────────────────────────────────────────────
 *  Money flow:
 *    Network fees ──► DividendPoolNativeV2 ──(owner: sendRewardsToStaking)──►
 *    InfraStakingPool.fundRewardsFromDividendPool() ──► split by weight ──► stakers
 *
 *  Cycles ("epochs")
 *    - One epoch = one calendar month in UTC.
 *    - Epoch id = year * 12 + (month - 1). Example: October 2026 = 2026*12 + 9 = 24321.
 *
 *  Staking
 *    - A stake made during month M becomes ACTIVE at the start of month M+1.
 *    - Principal is locked for `periods` full months (1..12).
 *    - After the lock ends the stake keeps earning every month until the user
 *      calls withdraw(). One active stake per wallet.
 *
 *  Rewards (no APR is promised)
 *    - Every reAED that arrives during month M (from the dividend pool or any
 *      plain transfer) becomes month M's reward pool.
 *    - Weight   = staked amount × seconds the stake was active in that month.
 *    - Share    = user weight ÷ total weight of that month.
 *    - Reward   = month's reward pool × share.
 *
 *  Claiming
 *    - When month M closes, its rewards are claimable for CLAIM_WINDOW (30 days).
 *    - After the window, unclaimed rewards expire. Anyone may call
 *      rolloverExpired(M) to move them into the running month's pool.
 *    - A month nobody staked in can be rolled over as soon as it closes.
 *
 *  Owner (MUST be a multisig, e.g. Gnosis Safe)
 *    - Upgrade the contract (UUPS).
 *    - setDividendPool(), fundEpoch().
 *    - ownerWithdrawRewards(): reward funds only, never stakers' principal.
 *    - emergencyWithdraw(): ANY amount, including principal.
 *
 *  Scalability
 *    No loops over users. Per-month totals are computed from:
 *      activeAmount (principal earning), scheduledActivation (stakes starting
 *      next month) and epochWeightDeduction (weight removed by mid-month exits).
 *    Loops only run over months (since last sync / since a user's last claim).
 */
contract InfraStakingPool is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ════════════════════════════════════════════════════════════════════
    //  CONSTANTS
    // ════════════════════════════════════════════════════════════════════

    /// @notice How long a closed month's rewards stay claimable (30 days after month end).
    uint256 public constant CLAIM_WINDOW = 30 days;

    /// @notice Maximum lock length in months.
    uint256 public constant MAX_PERIODS = 12;

    // ════════════════════════════════════════════════════════════════════
    //  STORAGE  (append-only: never reorder or remove when upgrading)
    // ════════════════════════════════════════════════════════════════════

    /// @notice Everything the contract knows about one wallet's stake.
    struct UserInfo {
        uint256 amount; // principal of the latest stake (kept after exit for reward accounting)
        uint64 stakedAt; // timestamp when stake() was called
        uint64 periods; // lock length in months chosen at stake time
        uint64 activeFrom; // first epoch this stake earns in (month after staking)
        uint64 lockEnd; // timestamp after which withdraw() is allowed (start of month activeFrom+periods)
        uint64 exitEpoch; // epoch in which withdraw() happened; 0 = stake still active
        uint64 exitTime; // timestamp of withdraw(); weight in exitEpoch counts up to this moment
        uint64 lastSettledEpoch; // all epochs <= this are already paid or expired for this user
        uint256 totalClaimed; // lifetime rewards paid to this wallet
        uint256 totalExpired; // lifetime rewards this wallet missed (claim window passed)
    }

    /// @notice Stake record per wallet. Public getter returns the struct fields in order.
    mapping(address => UserInfo) public users;

    /// @notice Address of DividendPoolNativeV2 (the fee collector that funds this pool).
    /// @dev Informational / for the UI and off-chain tooling. Funding is not restricted
    ///      to this address: extra rewards from anyone only benefit stakers.
    address public dividendPool;

    /// @notice Principal currently held for stakers (active + waiting to activate).
    ///         Used to protect principal from ownerWithdrawRewards().
    uint256 public totalStaked;

    /// @notice Principal earning in epoch `lastSyncedEpoch` (and later, until it changes).
    uint256 public activeAmount;

    /// @notice Latest epoch whose base weight has been written to storage by _sync().
    uint256 public lastSyncedEpoch;

    /// @notice epoch => principal that starts earning at the beginning of that epoch.
    mapping(uint256 => uint256) public scheduledActivation;

    /// @notice epoch => activeAmount × epoch length, snapshotted when the epoch starts.
    mapping(uint256 => uint256) public epochBaseWeight;

    /// @notice epoch => weight removed because stakers withdrew during that epoch.
    mapping(uint256 => uint256) public epochWeightDeduction;

    /// @notice epoch => reward pool (reAED) to be split among that epoch's stakers.
    mapping(uint256 => uint256) public epochReward;

    /// @notice epoch => rewards already paid out from that epoch's pool.
    mapping(uint256 => uint256) public epochClaimed;

    /// @notice epoch => true once its unclaimed rewards were moved to a later epoch.
    mapping(uint256 => bool) public epochRolledOver;

    /// @notice Lifetime reAED received as rewards.
    uint256 public totalRewardsReceived;

    /// @notice Lifetime reAED paid to stakers as rewards.
    uint256 public totalRewardsClaimed;

    /// @notice Lifetime reAED taken by the owner via ownerWithdrawRewards().
    uint256 public totalRewardsWithdrawnByOwner;

    // ════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ════════════════════════════════════════════════════════════════════

    /// @notice A wallet staked `amount`, earning from epoch `activeFrom`, withdrawable after `lockEnd`.
    event Staked(address indexed user, uint256 amount, uint256 periods, uint256 activeFrom, uint256 lockEnd);
    /// @notice A wallet withdrew its full principal during `epoch`.
    event Withdrawn(address indexed user, uint256 amount, uint256 epoch);
    /// @notice A wallet received `amount` rewards covering epochs fromEpoch..toEpoch.
    event Claimed(address indexed user, uint256 amount, uint256 fromEpoch, uint256 toEpoch);
    /// @notice A wallet's rewards from closed months expired (claim window passed).
    event RewardsExpiredForUser(address indexed user, uint256 amount);
    /// @notice `amount` reAED was added to `epoch`'s reward pool by `from`.
    event RewardsFunded(address indexed from, uint256 indexed epoch, uint256 amount);
    /// @notice Unclaimed rewards of `fromEpoch` were moved into `toEpoch`.
    event RewardsRolledOver(uint256 indexed fromEpoch, uint256 indexed toEpoch, uint256 amount);
    /// @notice The dividend pool address was changed.
    event DividendPoolUpdated(address indexed oldPool, address indexed newPool);
    /// @notice Owner withdrew reward (non-principal) funds.
    event OwnerRewardsWithdrawn(address indexed to, uint256 amount);
    /// @notice Owner withdrew funds through the emergency path (may include principal).
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ════════════════════════════════════════════════════════════════════
    //  SETUP / UPGRADES
    // ════════════════════════════════════════════════════════════════════

    /// @dev Locks the implementation contract so only the proxy can be initialized.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice One-time setup, called through the proxy at deployment.
     * @param initialOwner  admin of the pool — use the Gnosis Safe multisig address.
     * @param dividendPool_ address of DividendPoolNativeV2 (the fee collector).
     * @dev Starts month tracking at the deployment month.
     */
    function initialize(address initialOwner, address dividendPool_) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        dividendPool = dividendPool_;
        lastSyncedEpoch = currentEpoch();
        emit DividendPoolUpdated(address(0), dividendPool_);
    }

    /// @dev Only the owner can upgrade the implementation (UUPS).
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ════════════════════════════════════════════════════════════════════
    //  FUNDING (rewards in)
    // ════════════════════════════════════════════════════════════════════

    /**
     * @notice Entry point used by DividendPoolNativeV2.sendRewardsToStaking().
     *         The reAED sent is added to the CURRENT month's reward pool.
     * @dev Send before the month ends (e.g. last day 23:00 UTC) — anything that
     *      arrives after midnight UTC counts toward the next month.
     */
    function fundRewardsFromDividendPool() external payable {
        _fund(currentEpoch());
    }

    /// @notice Plain reAED transfers (e.g. sendRewardsToStakingPlain) also fund the current month.
    receive() external payable {
        _fund(currentEpoch());
    }

    /**
     * @notice Owner can add rewards to the current or a FUTURE month explicitly.
     * @param epoch target month id (must not be closed already).
     */
    function fundEpoch(uint256 epoch) external payable onlyOwner {
        require(epoch >= currentEpoch(), "Epoch closed");
        _fund(epoch);
    }

    /// @dev Adds msg.value to `epoch`'s reward pool.
    function _fund(uint256 epoch) internal {
        require(msg.value > 0, "No reward");
        epochReward[epoch] += msg.value;
        totalRewardsReceived += msg.value;
        emit RewardsFunded(msg.sender, epoch, msg.value);
    }

    // ════════════════════════════════════════════════════════════════════
    //  STAKER ACTIONS
    // ════════════════════════════════════════════════════════════════════

    /**
     * @notice Stake native reAED (send it as msg.value).
     * @param periods lock length in months, 1..MAX_PERIODS.
     *
     * Rules:
     *  - Earning starts at the beginning of NEXT month (activeFrom = current + 1).
     *  - lockEnd = start of month (activeFrom + periods), i.e. after `periods` full months.
     *  - One active stake per wallet. After withdraw(), the wallet can stake again
     *    once the month it exited in has closed (so that month's reward is settled first).
     */
    function stake(uint256 periods) external payable nonReentrant {
        require(msg.value > 0, "Amount=0");
        require(periods >= 1 && periods <= MAX_PERIODS, "Bad periods");
        _sync();

        UserInfo storage u = users[msg.sender];
        if (u.amount > 0) {
            require(u.exitEpoch != 0, "Already staked");
            require(u.exitEpoch < currentEpoch(), "Wait for exit cycle to close");
            _settle(msg.sender); // pay what is still claimable from the old stake before resetting
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
            totalClaimed: u.totalClaimed, // lifetime counters carry over
            totalExpired: u.totalExpired
        });

        scheduledActivation[activeFrom] += msg.value;
        totalStaked += msg.value;

        emit Staked(msg.sender, msg.value, periods, activeFrom, lockEnd);
    }

    /**
     * @notice Withdraw the FULL principal after the lock has ended.
     * @dev Also pays rewards of closed months still inside their claim window.
     *      The running month keeps the weight earned up to now; its reward can be
     *      claimed after the month closes (call claim() then).
     */
    function withdraw() external nonReentrant {
        UserInfo storage u = users[msg.sender];
        require(u.amount > 0 && u.exitEpoch == 0, "No stake found");
        require(block.timestamp >= u.lockEnd, "Lock not expired");
        _sync();

        uint256 cur = currentEpoch();
        uint256 amount = u.amount;

        // stop earning: remove from active principal and cut the rest of this month's weight
        activeAmount -= amount;
        epochWeightDeduction[cur] += amount * (epochEnd(cur) - block.timestamp);
        totalStaked -= amount;

        _settle(msg.sender);
        u.exitEpoch = uint64(cur);
        u.exitTime = uint64(block.timestamp);

        _send(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, cur);
    }

    /**
     * @notice Claim rewards from all CLOSED months that are still within their
     *         30-day claim window. Reverts with "No rewards" if nothing is due.
     */
    function claim() external nonReentrant {
        _sync();
        uint256 paid = _settle(msg.sender);
        require(paid > 0, "No rewards");
    }

    /**
     * @notice Move a closed month's unclaimed rewards into the CURRENT month's pool.
     *         Callable by anyone (e.g. a keeper / admin script).
     * @param epoch the closed month to roll over.
     * @dev Allowed when its claim window has passed, or immediately if that month
     *      had no stakers (total weight 0). Each month can be rolled over once.
     */
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

    // ════════════════════════════════════════════════════════════════════
    //  OWNER / ADMIN
    // ════════════════════════════════════════════════════════════════════

    /// @notice Update the stored dividend pool address (informational, used by the UI).
    function setDividendPool(address newPool) external onlyOwner {
        require(newPool != address(0), "pool=0");
        emit DividendPoolUpdated(dividendPool, newPool);
        dividendPool = newPool;
    }

    /**
     * @notice Withdraw REWARD funds only. Can never touch stakers' principal
     *         (limited to contract balance − totalStaked).
     * @dev Note: this can include rewards stakers have not claimed yet; withdrawing
     *      those will make their claims fail until the pool is refunded.
     */
    function ownerWithdrawRewards(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        require(amount > 0 && amount <= surplusBalance(), "Exceeds reward balance");
        totalRewardsWithdrawnByOwner += amount;
        _send(to, amount);
        emit OwnerRewardsWithdrawn(to, amount);
    }

    /**
     * @notice EMERGENCY: withdraw ANY amount, including stakers' principal.
     * @dev Same behaviour as DividendPoolNativeV2.emergencyWithdraw. Keep the owner
     *      on a multisig; stakers must trust the owner with this power.
     */
    function emergencyWithdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        require(address(this).balance >= amount, "insufficient balance");
        _send(to, amount);
        emit EmergencyWithdraw(to, amount);
    }

    // ════════════════════════════════════════════════════════════════════
    //  VIEWS (for the website and scripts)
    // ════════════════════════════════════════════════════════════════════

    /// @notice Id of the running month (UTC).
    function currentEpoch() public view returns (uint256) {
        return epochOf(block.timestamp);
    }

    /// @notice Month id for any timestamp: year * 12 + (month - 1).
    function epochOf(uint256 timestamp) public pure returns (uint256) {
        (uint256 y, uint256 m) = _yearMonth(timestamp / 1 days);
        return y * 12 + (m - 1);
    }

    /// @notice Timestamp of the 1st of that month, 00:00 UTC.
    function epochStart(uint256 epoch) public pure returns (uint256) {
        return _daysFromCivil(epoch / 12, (epoch % 12) + 1, 1) * 1 days;
    }

    /// @notice Timestamp when the month ends (= start of the next month).
    function epochEnd(uint256 epoch) public pure returns (uint256) {
        return epochStart(epoch + 1);
    }

    /// @notice Last moment that month's rewards can be claimed (month end + 30 days).
    function claimDeadline(uint256 epoch) public pure returns (uint256) {
        return epochEnd(epoch) + CLAIM_WINDOW;
    }

    /**
     * @notice Total weight of a month (sum of all stakers' weights).
     * @dev For the running month this assumes current stakers stay all month;
     *      it drops if someone withdraws before month end.
     */
    function totalWeight(uint256 epoch) public view returns (uint256) {
        if (epoch <= lastSyncedEpoch) {
            return epochBaseWeight[epoch] - epochWeightDeduction[epoch];
        }
        // not synced yet: simulate _sync() without writing
        uint256 active = activeAmount;
        for (uint256 e = lastSyncedEpoch + 1; e <= epoch; e++) {
            active += scheduledActivation[e];
        }
        return active * (epochEnd(epoch) - epochStart(epoch));
    }

    /**
     * @notice One wallet's weight in a month.
     * @return 0 before the stake activates or after the exit month;
     *         amount × (exitTime − month start) in the exit month;
     *         amount × full month length otherwise.
     */
    function userWeight(address user, uint256 epoch) public view returns (uint256) {
        UserInfo storage u = users[user];
        if (u.amount == 0 || epoch < u.activeFrom) return 0;
        if (u.exitEpoch != 0) {
            if (epoch > u.exitEpoch) return 0;
            if (epoch == u.exitEpoch) return u.amount * (u.exitTime - epochStart(epoch));
        }
        return u.amount * (epochEnd(epoch) - epochStart(epoch));
    }

    /// @notice A wallet's reward from a given month = month pool × userWeight ÷ totalWeight
    ///         (whether or not it is still claimable).
    function userEpochReward(address user, uint256 epoch) public view returns (uint256) {
        uint256 w = userWeight(user, epoch);
        if (w == 0) return 0;
        uint256 tw = totalWeight(epoch);
        return tw == 0 ? 0 : (epochReward[epoch] * w) / tw;
    }

    /**
     * @notice What the wallet can claim right now.
     * @return amount       total claimable from closed months inside their window
     * @return nextDeadline earliest claim deadline among those months (0 if none)
     */
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

    /**
     * @notice Running-month snapshot for the UI (an estimate, not a promise).
     * @return epoch       running month id
     * @return weight      wallet's weight this month (assumes it stays all month)
     * @return total       total weight this month
     * @return rewardSoFar reward pool received so far this month
     */
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

    /// @notice Everything about one month, for the cycle history table.
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

    /// @notice Contract balance NOT owed as principal (= reward funds, claimed or not).
    function surplusBalance() public view returns (uint256) {
        uint256 bal = address(this).balance;
        return bal > totalStaked ? bal - totalStaked : 0;
    }

    // ════════════════════════════════════════════════════════════════════
    //  INTERNALS
    // ════════════════════════════════════════════════════════════════════

    /**
     * @dev Writes the base weight of every month reached since the last sync:
     *      activeAmount grows by stakes scheduled to start that month, then
     *      baseWeight = activeAmount × month length. Called by every state change.
     */
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

    /**
     * @dev Closed months not yet settled for `user`: [from, to].
     *      Returns to = type(uint256).max when there is nothing to settle.
     */
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

    /**
     * @dev Goes through the user's unsettled closed months:
     *      - inside the 30-day window → pays the reward,
     *      - window passed / month rolled over → records it as expired.
     *      Marks those months settled. Returns the amount paid.
     */
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

    /// @dev Sends native reAED; reverts if the receiver rejects it.
    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // ── Calendar math (proleptic Gregorian, UTC) — Howard Hinnant's algorithms ──

    /// @dev Days since 1970-01-01 for a given year / month / day.
    function _daysFromCivil(uint256 y, uint256 m, uint256 d) internal pure returns (uint256) {
        if (m <= 2) y -= 1;
        uint256 era = y / 400;
        uint256 yoe = y - era * 400;
        uint256 mp = m > 2 ? m - 3 : m + 9;
        uint256 doy = (153 * mp + 2) / 5 + d - 1;
        uint256 doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    /// @dev Year and month (1..12) for a number of days since 1970-01-01.
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

    /// @dev Reserved storage slots so future upgrades can add variables safely.
    uint256[40] private __gap;
}
