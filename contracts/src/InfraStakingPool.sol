// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @dev DividendPoolNativeV2 (upgraded) sends its whole balance to the staking contract.
interface IDividendPoolPull {
    function pullForStaking() external returns (uint256);
}

/**
 * @title  InfraStakingPool
 * @notice Monthly reward pool for native reAED stakers on the INFRA network.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  OVERVIEW
 * ────────────────────────────────────────────────────────────────────────────
 *  Money flow (FULLY AUTOMATIC — no admin signature needed):
 *    Network fees ──► DividendPoolNativeV2 (collects during month M)
 *    first transaction after month M closes (any stake/claim/withdraw, or poke() by the
 *    keeper) ──► pulls the whole dividend-pool balance as month M's reward pool
 *    ──► split by weight ──► stakers claim within 30 days ──► leftovers auto-swept to admin
 *
 *  Cycles ("epochs")
 *    - One epoch = one calendar month in UTC.
 *    - Epoch id = year * 12 + (month - 1). Example: October 2026 = 2026*12 + 9 = 24321.
 *
 *  Staking — MULTIPLE POSITIONS PER WALLET
 *    - Every stake() opens a new POSITION with its own amount and lock. Accepted locks are
 *      set by the owner (default 1, 2, 6, 8, 9 or 12 months; see setAllowedPeriod).
 *      A wallet can hold up to MAX_POSITIONS open positions at the same time.
 *    - A position opened during month M becomes ACTIVE at the start of month M+1
 *      (the running month is closed to new stakes).
 *    - It earns ONLY for its lock months: activeFrom .. activeFrom + periods - 1.
 *    - When the lock ends the position STOPS earning. The staker then has a 30-day
 *      grace period to withdraw(positionId) the principal TOGETHER WITH its rewards.
 *    - After the grace period the staker can withdraw the PRINCIPAL ONLY; unclaimed
 *      rewards are forfeited and go to the ADMIN WALLET (sweepExpired).
 *    - Anyone (e.g. an admin/keeper script) may releaseStakes(users) after the grace
 *      period to send principal back to each staker's own wallet.
 *
 *  Rewards (no APR is promised)
 *    - Rewards come ONLY from the dividend pool (DividendPoolNativeV2) or the owner.
 *    - AUTO-PULL: the first state-changing call in a new month asks the dividend pool
 *      (pullForStaking) for its whole balance and books it as the month that just closed.
 *      Nobody has to send anything by hand. poke() lets a keeper trigger it daily.
 *    - Manual top-ups still work: sendRewardsToStaking / fundEpoch add to the RUNNING month.
 *    - Weight = position amount × month length (positions always earn whole months).
 *    - Reward of a position for month M = M's pool × position weight ÷ total weight of M.
 *
 *  Claiming
 *    - When month M closes, its rewards are claimable for CLAIM_WINDOW (30 days).
 *      claim() collects rewards from ALL of the wallet's positions at once.
 *    - After the window, unclaimed rewards expire and are AUTO-SWEPT to the ADMIN WALLET
 *      by the next transaction (or poke()); sweepExpired(M) does it by hand.
 *    - A month nobody staked in can be swept to the admin wallet as soon as it closes.
 *
 *  Owner (MUST be a multisig, e.g. Gnosis Safe)
 *    - Upgrade the contract (UUPS).
 *    - setDividendPool(), setAdminWallet(), setAllowedPeriod(), setAutoPull(), fundEpoch().
 *    - ownerWithdrawRewards(): reward funds only, never stakers' principal.
 *    - emergencyWithdraw(): ANY amount, including principal.
 *
 *  Keeper / automation
 *    - poke(): public; runs the monthly automation (weights, auto-pull, auto-sweep).
 *    - needsPoke(): view for keepers — true when poke() would do something.
 *
 *  Scalability
 *    No loops over users. Per-month totals come from activeAmount,
 *    scheduledActivation and scheduledDeactivation. Per-wallet loops are bounded by
 *    MAX_POSITIONS and by the number of months since the last claim.
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
    ///         Also the grace period after a position's lock ends.
    uint256 public constant CLAIM_WINDOW = 30 days;

    /// @notice Maximum lock length in months.
    uint256 public constant MAX_PERIODS = 12;

    /// @notice Maximum number of open positions per wallet (bounds gas of claim()).
    uint256 public constant MAX_POSITIONS = 20;

    // ════════════════════════════════════════════════════════════════════
    //  STORAGE
    //  Slots 0–11 keep the EXACT layout of the previous implementation
    //  (StakingPoolFromDividendPoolV2) so this contract can be installed on the
    //  existing proxy with upgradeToAndCall(..., upgradeToMonthlyPool(...)).
    //  New state lives in what was that contract's __gap (slots 12+, all zero).
    //  Append-only from here: never reorder or remove when upgrading again.
    // ════════════════════════════════════════════════════════════════════

    /// @dev Previous implementation's per-user record (slot 2). No longer used.
    struct LegacyUserInfo {
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

    // ── slots 0–11: previous implementation (kept in place) ──

    /// @notice slot 0 — DividendPoolNativeV2: the ONLY non-owner source of rewards.
    address public dividendPool;
    /// @notice slot 1 — wallet that receives expired rewards (was `rewardAdmin`).
    address public adminWallet;
    /// @dev slot 2 — legacy per-user records (unused; must hold no live stakes to upgrade).
    mapping(address => LegacyUserInfo) private legacyUsers;
    /// @notice slot 3 — principal currently held for stakers (all open positions).
    uint256 public totalStaked;
    /// @notice slot 4 — legacy totalLocked (must be 0 to upgrade).
    uint256 public legacyTotalLocked;
    uint256 private legacyTotalWeight; // slot 5
    uint256 private legacyLastGlobalUpdate; // slot 6
    uint256 private legacyAccRewardPerWeight; // slot 7
    uint256 private legacyRewardVaultBalance; // slot 8
    uint256 private legacyUndistributedRewards; // slot 9
    uint256 private legacyTotalRewarded; // slot 10
    uint256 private legacyTotalExpired; // slot 11

    // ── slots 12+: monthly pool ──

    /// @notice One stake position.
    struct Position {
        uint256 amount; // principal of this position
        uint64 id; // per-wallet id, stable for the position's lifetime
        uint64 stakedAt; // timestamp of stake()
        uint64 periods; // lock length in months
        uint64 activeFrom; // first earning epoch (month after staking)
        uint64 lockEnd; // earning stops & withdraw allowed (start of month activeFrom+periods)
        uint64 lastSettledEpoch; // epochs <= this are already paid or expired for this position
    }

    /// @notice Per-wallet totals.
    struct Account {
        uint256 staked; // principal across open positions
        uint256 totalClaimed; // lifetime rewards paid
        uint256 totalExpired; // lifetime rewards forfeited (claim window passed)
        uint64 nextId; // id for the next position
    }

    /// @dev slot 12 — open positions per wallet (withdrawn positions are removed).
    mapping(address => Position[]) internal _positions;
    /// @notice slot 13 — per-wallet totals.
    mapping(address => Account) public accounts;
    /// @notice slot 14 — principal earning in epoch `lastSyncedEpoch` (and later, until it changes).
    uint256 public activeAmount;
    /// @notice slot 15 — latest epoch whose base weight has been written to storage by _sync().
    uint256 public lastSyncedEpoch;
    /// @notice epoch => principal that starts earning at the beginning of that epoch.
    mapping(uint256 => uint256) public scheduledActivation;
    /// @notice epoch => principal that stops earning at the beginning of that epoch (lock ended).
    mapping(uint256 => uint256) public scheduledDeactivation;
    /// @notice epoch => activeAmount × epoch length, snapshotted when the epoch starts.
    mapping(uint256 => uint256) public epochBaseWeight;
    /// @notice epoch => reward pool (reAED) to be split among that epoch's positions.
    mapping(uint256 => uint256) public epochReward;
    /// @notice epoch => rewards already paid out from that epoch's pool.
    mapping(uint256 => uint256) public epochClaimed;
    /// @notice epoch => true once its expired/unclaimed rewards were sent to the admin wallet.
    mapping(uint256 => bool) public epochSwept;
    /// @notice Lifetime reAED received as rewards.
    uint256 public totalRewardsReceived;
    /// @notice Lifetime reAED paid to stakers as rewards.
    uint256 public totalRewardsClaimed;
    /// @notice Lifetime reAED taken by the owner via ownerWithdrawRewards().
    uint256 public totalRewardsWithdrawnByOwner;
    /// @notice Lifetime expired rewards sent to the admin wallet.
    uint256 public totalExpiredSwept;
    /// @notice slot 26 — lock lengths (in months) that stake() accepts. Default: 1, 2, 6, 8, 9, 12.
    mapping(uint256 => bool) public isAllowedPeriod;
    /// @notice slot 27 — wallets with at least one open position.
    uint256 public stakerCount;
    /// @notice slot 28 — open positions across all wallets.
    uint256 public openPositions;
    /// @notice slot 29 — latest month in which the dividend pool was auto-pulled.
    uint256 public lastPulledEpoch;
    /// @notice slot 30 — oldest month the auto-sweeper still has to look at.
    uint256 public nextSweepEpoch;
    /// @notice slot 31 — auto-pull on/off (owner). Requires DividendPoolNativeV2.pullForStaking().
    bool public autoPullEnabled;
    /// @dev slot 31 (packed) — true only while pullForStaking() is sending to receive().
    bool private _pulling;

    // ════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ════════════════════════════════════════════════════════════════════

    /// @notice A wallet opened position `positionId`, earning from epoch `activeFrom`, withdrawable after `lockEnd`.
    event Staked(
        address indexed user, uint256 indexed positionId, uint256 amount, uint256 periods, uint256 activeFrom, uint256 lockEnd
    );
    /// @notice A position's principal was returned to its owner (by itself or a releaser).
    event Withdrawn(address indexed user, uint256 indexed positionId, uint256 amount, address caller);
    /// @notice A wallet received `amount` rewards.
    event Claimed(address indexed user, uint256 amount);
    /// @notice Some of a wallet's rewards expired (claim window passed).
    event RewardsExpiredForUser(address indexed user, uint256 amount);
    /// @notice `amount` reAED was added to `epoch`'s reward pool by `from`.
    event RewardsFunded(address indexed from, uint256 indexed epoch, uint256 amount);
    /// @notice Expired rewards of `epoch` were sent to the admin wallet.
    event ExpiredRewardsSwept(uint256 indexed epoch, address indexed adminWallet, uint256 amount);
    /// @notice The dividend pool address was changed.
    event DividendPoolUpdated(address indexed oldPool, address indexed newPool);
    /// @notice The admin wallet (receiver of expired rewards) was changed.
    event AdminWalletUpdated(address indexed oldWallet, address indexed newWallet);
    /// @notice A lock length was enabled or disabled for new stakes.
    event AllowedPeriodSet(uint256 periods, bool allowed);
    /// @notice Owner withdrew reward (non-principal) funds.
    event OwnerRewardsWithdrawn(address indexed to, uint256 amount);
    /// @notice Owner withdrew funds through the emergency path (may include principal).
    event EmergencyWithdraw(address indexed to, uint256 amount);
    /// @notice Auto-pull ran for `epoch` (the month that just closed); `amount` may be 0.
    event AutoPulled(uint256 indexed epoch, uint256 amount, bool ok);
    event AutoPullSet(bool enabled);

    // ════════════════════════════════════════════════════════════════════
    //  SETUP / UPGRADES
    // ════════════════════════════════════════════════════════════════════

    /// @dev Locks the implementation contract so only a proxy can be initialized.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice One-time setup for a NEW proxy.
     * @param initialOwner  admin of the pool — use the Gnosis Safe multisig address.
     * @param dividendPool_ DividendPoolNativeV2 — the ONLY non-owner source of rewards.
     * @param adminWallet_  wallet that receives expired rewards.
     */
    function initialize(address initialOwner, address dividendPool_, address adminWallet_) public initializer {
        require(dividendPool_ != address(0) && adminWallet_ != address(0), "zero address");
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        dividendPool = dividendPool_;
        adminWallet = adminWallet_;
        lastSyncedEpoch = currentEpoch();
        _setDefaultPeriods();
        _initAutomation();
        emit DividendPoolUpdated(address(0), dividendPool_);
        emit AdminWalletUpdated(address(0), adminWallet_);
    }

    /**
     * @notice One-time migration when installing this contract on the EXISTING proxy that
     *         ran StakingPoolFromDividendPoolV2. Call it through
     *         upgradeToAndCall(newImplementation, abi.encodeCall(upgradeToMonthlyPool, (pool, admin))).
     * @dev Refuses to run while the old contract still holds any stake. Clears the old
     *      accounting; reAED already sitting in the contract becomes surplus that the
     *      owner can recover with ownerWithdrawRewards().
     */
    function upgradeToMonthlyPool(address dividendPool_, address adminWallet_) external reinitializer(3) onlyOwner {
        require(dividendPool_ != address(0) && adminWallet_ != address(0), "zero address");
        require(totalStaked == 0 && legacyTotalLocked == 0, "Legacy stakes exist");

        legacyTotalWeight = 0;
        legacyLastGlobalUpdate = 0;
        legacyAccRewardPerWeight = 0;
        legacyRewardVaultBalance = 0;
        legacyUndistributedRewards = 0;
        legacyTotalRewarded = 0;
        legacyTotalExpired = 0;

        emit DividendPoolUpdated(dividendPool, dividendPool_);
        emit AdminWalletUpdated(adminWallet, adminWallet_);
        dividendPool = dividendPool_;
        adminWallet = adminWallet_;
        lastSyncedEpoch = currentEpoch();
        _setDefaultPeriods();
        _initAutomation();
    }

    /// @dev Fees collected from now on belong to the running month; sweeper starts here.
    function _initAutomation() internal {
        uint256 cur = currentEpoch();
        lastPulledEpoch = cur;
        nextSweepEpoch = cur;
        autoPullEnabled = true;
        emit AutoPullSet(true);
    }

    /// @dev Lock options offered on the website: 1, 2, 6, 8, 9 and 12 months.
    function _setDefaultPeriods() internal {
        uint8[6] memory d = [1, 2, 6, 8, 9, 12];
        for (uint256 i = 0; i < d.length; i++) {
            isAllowedPeriod[d[i]] = true;
            emit AllowedPeriodSet(d[i], true);
        }
    }

    /// @dev Only the owner can upgrade the implementation (UUPS).
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ════════════════════════════════════════════════════════════════════
    //  FUNDING (rewards in)
    // ════════════════════════════════════════════════════════════════════

    /**
     * @notice Entry point used by DividendPoolNativeV2.sendRewardsToStaking().
     *         The reAED sent is added to the CURRENT month's reward pool.
     */
    function fundRewardsFromDividendPool() external payable {
        _fund(currentEpoch());
    }

    /// @notice Plain transfers from the dividend pool fund the current month — except during
    ///         an auto-pull, when they are the CLOSED month's pool. Others are rejected.
    receive() external payable {
        if (_pulling && msg.sender == dividendPool) return; // booked by _autoPull()
        _fund(currentEpoch());
    }

    /**
     * @notice Runs the monthly automation: records month weights, pulls the dividend pool
     *         for the month that just closed, and sweeps expired months to the admin wallet.
     *         Anyone may call it (a daily keeper/cron does). It moves no funds anywhere else.
     */
    function poke() external nonReentrant {
        _sync();
    }

    /// @notice True if poke() would do something right now (for keepers).
    function needsPoke() external view returns (bool) {
        uint256 cur = currentEpoch();
        if (lastSyncedEpoch < cur) return true;
        if (autoPullEnabled && lastPulledEpoch < cur) return true;
        return _sweepDue(nextSweepEpoch, cur);
    }

    /// @notice Owner can add rewards to the current or a FUTURE month explicitly.
    function fundEpoch(uint256 epoch) external payable onlyOwner {
        require(epoch >= currentEpoch(), "Epoch closed");
        _fund(epoch);
    }

    /// @dev Adds msg.value to `epoch`'s reward pool. Only the dividend pool or the owner may fund.
    function _fund(uint256 epoch) internal {
        require(msg.sender == dividendPool || msg.sender == owner(), "Only dividend pool");
        require(msg.value > 0, "No reward");
        epochReward[epoch] += msg.value;
        totalRewardsReceived += msg.value;
        emit RewardsFunded(msg.sender, epoch, msg.value);
    }

    // ════════════════════════════════════════════════════════════════════
    //  STAKER ACTIONS
    // ════════════════════════════════════════════════════════════════════

    /**
     * @notice Open a new position with native reAED (send it as msg.value).
     * @param periods lock length in months, 1..MAX_PERIODS.
     * @return positionId id of the new position (per wallet).
     * @dev Earns from the start of NEXT month for exactly `periods` months.
     */
    function stake(uint256 periods) external payable nonReentrant returns (uint256 positionId) {
        require(msg.value > 0, "Amount=0");
        require(periods >= 1 && periods <= MAX_PERIODS && isAllowedPeriod[periods], "Bad periods");
        require(_positions[msg.sender].length < MAX_POSITIONS, "Too many positions");
        _sync();

        uint256 activeFrom = currentEpoch() + 1;
        uint256 lockEnd = epochStart(activeFrom + periods);

        Account storage a = accounts[msg.sender];
        positionId = a.nextId;
        a.nextId += 1;
        a.staked += msg.value;

        if (_positions[msg.sender].length == 0) stakerCount += 1;
        openPositions += 1;
        _positions[msg.sender].push(
            Position({
                amount: msg.value,
                id: uint64(positionId),
                stakedAt: uint64(block.timestamp),
                periods: uint64(periods),
                activeFrom: uint64(activeFrom),
                lockEnd: uint64(lockEnd),
                lastSettledEpoch: uint64(activeFrom - 1)
            })
        );

        scheduledActivation[activeFrom] += msg.value;
        scheduledDeactivation[activeFrom + periods] += msg.value;
        totalStaked += msg.value;

        emit Staked(msg.sender, positionId, msg.value, periods, activeFrom, lockEnd);
    }

    /**
     * @notice Claim rewards of all closed months (inside their 30-day window) across ALL
     *         of your positions. Reverts with "No rewards" if nothing is due.
     */
    function claim() external nonReentrant {
        _sync();
        uint256 paid = _settleAll(msg.sender);
        require(paid > 0, "No rewards");
    }

    /**
     * @notice Withdraw one position after its lock ended.
     * @dev Within the 30-day grace period: principal + that position's claimable rewards.
     *      After it: principal only — expired rewards go to the admin wallet via sweepExpired.
     */
    function withdraw(uint256 positionId) external nonReentrant {
        _sync();
        uint256 idx = _indexOf(msg.sender, positionId);
        _release(msg.sender, idx);
    }

    /// @notice Withdraw every position whose lock has ended. Reverts if none.
    function withdrawAll() external nonReentrant {
        _sync();
        uint256 n = _releaseEnded(msg.sender, 0);
        require(n > 0, "Lock not expired");
    }

    /**
     * @notice After lock + 30-day grace, ANYONE (admin script, keeper) may return abandoned
     *         positions to their owners. Principal always goes to the staker's own wallet.
     * @dev Skips positions still locked or inside their grace period.
     *      Reverts if a wallet rejects native transfers (remove it and retry).
     */
    function releaseStakes(address[] calldata list) external nonReentrant {
        _sync();
        for (uint256 i = 0; i < list.length; i++) {
            _releaseEnded(list[i], CLAIM_WINDOW);
        }
    }

    /**
     * @notice Send a closed month's expired (unclaimed) rewards to the ADMIN WALLET.
     *         Callable by anyone; funds only ever go to adminWallet.
     * @dev Allowed after its 30-day claim window, or immediately if that month had no
     *      stakers (total weight 0). Each month can be swept once.
     */
    function sweepExpired(uint256 epoch) external nonReentrant {
        _sync();
        require(epoch < currentEpoch(), "Epoch not closed");
        if (epochSwept[epoch]) return; // already done (possibly by the auto-sweeper)
        require(block.timestamp >= claimDeadline(epoch) || totalWeight(epoch) == 0, "Claim window open");
        require(_sweep(epoch), "Transfer failed");
    }

    // ════════════════════════════════════════════════════════════════════
    //  OWNER / ADMIN
    // ════════════════════════════════════════════════════════════════════

    /// @notice Turn auto-pull from the dividend pool on/off (on by default).
    function setAutoPull(bool enabled) external onlyOwner {
        autoPullEnabled = enabled;
        emit AutoPullSet(enabled);
    }

    /// @notice Change the dividend pool address (the only non-owner reward source).
    function setDividendPool(address newPool) external onlyOwner {
        require(newPool != address(0), "pool=0");
        emit DividendPoolUpdated(dividendPool, newPool);
        dividendPool = newPool;
    }

    /// @notice Enable or disable a lock length (1..12 months) for NEW stakes. Existing positions are unaffected.
    function setAllowedPeriod(uint256 periods, bool allowed) external onlyOwner {
        require(periods >= 1 && periods <= MAX_PERIODS, "Bad periods");
        isAllowedPeriod[periods] = allowed;
        emit AllowedPeriodSet(periods, allowed);
    }

    /// @notice Change the wallet that receives expired rewards.
    function setAdminWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "wallet=0");
        emit AdminWalletUpdated(adminWallet, newWallet);
        adminWallet = newWallet;
    }

    /**
     * @notice Withdraw REWARD funds only. Can never touch stakers' principal
     *         (limited to contract balance − totalStaked).
     * @dev This can include rewards stakers have not claimed yet; withdrawing those makes
     *      their claims fail until the pool is refunded.
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
     * @dev Keep the owner on a multisig; stakers must trust the owner with this power.
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

    /// @notice All OPEN positions of a wallet.
    function positionsOf(address user) external view returns (Position[] memory) {
        return _positions[user];
    }

    /// @notice Lock lengths currently accepted by stake(), ascending.
    function allowedPeriods() external view returns (uint256[] memory list) {
        uint256 n;
        for (uint256 p = 1; p <= MAX_PERIODS; p++) if (isAllowedPeriod[p]) n++;
        list = new uint256[](n);
        n = 0;
        for (uint256 p = 1; p <= MAX_PERIODS; p++) if (isAllowedPeriod[p]) list[n++] = p;
    }

    /// @notice Number of open positions of a wallet.
    function positionCount(address user) external view returns (uint256) {
        return _positions[user].length;
    }

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

    /// @notice Total weight of a month (all positions earning that month).
    function totalWeight(uint256 epoch) public view returns (uint256) {
        if (epoch <= lastSyncedEpoch) return epochBaseWeight[epoch];
        uint256 active = activeAmount;
        for (uint256 e = lastSyncedEpoch + 1; e <= epoch; e++) {
            active = active + scheduledActivation[e] - scheduledDeactivation[e];
        }
        return active * (epochEnd(epoch) - epochStart(epoch));
    }

    /// @notice A wallet's weight in a month (sum over its open positions).
    function userWeight(address user, uint256 epoch) public view returns (uint256 w) {
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) w += _positionWeight(ps[i], epoch);
    }

    /// @notice A wallet's reward from a given month across its open positions
    ///         (whether or not still claimable).
    function userEpochReward(address user, uint256 epoch) public view returns (uint256 r) {
        uint256 tw = totalWeight(epoch);
        if (tw == 0) return 0;
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) r += (rewardOf(epoch) * _positionWeight(ps[i], epoch)) / tw;
    }

    /**
     * @notice What the wallet can claim right now across all positions.
     * @return amount       total claimable from closed months inside their window
     * @return nextDeadline earliest claim deadline among those months (0 if none)
     */
    function pendingRewards(address user) public view returns (uint256 amount, uint256 nextDeadline) {
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) {
            (uint256 a, uint256 d) = _pendingOf(ps[i]);
            amount += a;
            if (d != 0 && (nextDeadline == 0 || d < nextDeadline)) nextDeadline = d;
        }
    }

    /// @notice Claimable rewards of one position (index in positionsOf).
    function pendingOfPosition(address user, uint256 index) external view returns (uint256 amount, uint256 nextDeadline) {
        return _pendingOf(_positions[user][index]);
    }

    /**
     * @notice Running-month snapshot for the UI (an estimate, not a promise).
     * @return epoch       running month id
     * @return weight      wallet's weight this month
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
        rewardSoFar = rewardOf(epoch);
    }

    /// @notice Everything about one month, for the cycle history table.
    function epochInfo(uint256 epoch)
        external
        view
        returns (uint256 start, uint256 end, uint256 deadline, uint256 reward, uint256 weight, uint256 claimed, bool swept)
    {
        return (
            epochStart(epoch),
            epochEnd(epoch),
            claimDeadline(epoch),
            rewardOf(epoch),
            totalWeight(epoch),
            epochClaimed[epoch],
            epochSwept[epoch]
        );
    }

    /// @notice Reward of a month INCLUDING the dividend-pool balance that the next
    ///         transaction will auto-pull into it (closed month) — what the UI should show.
    function rewardOf(uint256 epoch) public view returns (uint256) {
        return epochReward[epoch] + _unpulledFor(epoch);
    }

    function _unpulledFor(uint256 epoch) internal view returns (uint256) {
        if (!autoPullEnabled) return 0;
        uint256 cur = currentEpoch();
        // pool balance belongs to cur-1 until pulled, otherwise it is the running month's so far
        if (lastPulledEpoch < cur ? epoch == cur - 1 : epoch == cur) return dividendPool.balance;
        return 0;
    }

    /// @notice Contract balance NOT owed as principal (= reward funds, claimed or not).
    function surplusBalance() public view returns (uint256) {
        uint256 bal = address(this).balance;
        return bal > totalStaked ? bal - totalStaked : 0;
    }

    // ════════════════════════════════════════════════════════════════════
    //  INTERNALS
    // ════════════════════════════════════════════════════════════════════

    /// @dev Writes base weight of every month reached since the last sync.
    function _syncWeights() internal {
        uint256 cur = currentEpoch();
        uint256 e = lastSyncedEpoch;
        if (cur <= e) return;
        uint256 active = activeAmount;
        for (e = e + 1; e <= cur; e++) {
            active = active + scheduledActivation[e] - scheduledDeactivation[e];
            epochBaseWeight[e] = active * (epochEnd(e) - epochStart(e));
        }
        activeAmount = active;
        lastSyncedEpoch = cur;
    }

    /// @dev _sync + monthly automation (auto-pull and auto-sweep). Used by every entry point.
    function _sync() internal {
        _syncWeights();
        uint256 cur = currentEpoch();
        if (autoPullEnabled && lastPulledEpoch < cur) _autoPull(cur);
        _autoSweep(cur);
    }

    /// @dev Pulls the dividend pool's whole balance as the reward of month cur-1.
    ///      Never reverts: if the pool can't pay, the month is retried on the next call.
    function _autoPull(uint256 cur) internal {
        uint256 epoch = cur - 1;
        uint256 before = address(this).balance;
        _pulling = true;
        (bool ok, ) = dividendPool.call(abi.encodeCall(IDividendPoolPull.pullForStaking, ()));
        _pulling = false;
        uint256 got = address(this).balance - before;
        if (!ok) {
            emit AutoPulled(epoch, 0, false);
            return; // retry next call
        }
        lastPulledEpoch = cur;
        if (got > 0) {
            epochReward[epoch] += got;
            totalRewardsReceived += got;
            emit RewardsFunded(dividendPool, epoch, got);
        }
        emit AutoPulled(epoch, got, true);
    }

    /// @dev Sweeps at most 2 due months per call (bounded gas), oldest first.
    function _autoSweep(uint256 cur) internal {
        uint256 e = nextSweepEpoch;
        for (uint256 i = 0; i < 2 && e < cur; i++) {
            if (!epochSwept[e]) {
                if (!_sweepDue(e, cur)) break;
                if (!_sweep(e)) break; // admin wallet refused: retry later, never block users
            }
            e++;
        }
        nextSweepEpoch = e;
    }

    function _sweepDue(uint256 e, uint256 cur) internal view returns (bool) {
        if (e >= cur || epochSwept[e]) return e < cur;
        if (autoPullEnabled && e == cur - 1 && lastPulledEpoch < cur) return false; // not pulled yet
        return block.timestamp >= claimDeadline(e) || totalWeight(e) == 0;
    }

    /// @dev Marks `epoch` swept and sends what's left to the admin wallet. False if refused.
    function _sweep(uint256 epoch) internal returns (bool) {
        uint256 left = epochReward[epoch] - epochClaimed[epoch];
        epochSwept[epoch] = true;
        if (left == 0) return true;
        (bool ok, ) = payable(adminWallet).call{value: left, gas: 60_000}("");
        if (!ok) {
            epochSwept[epoch] = false;
            return false;
        }
        totalExpiredSwept += left;
        emit ExpiredRewardsSwept(epoch, adminWallet, left);
        return true;
    }

    /// @dev Weight of one position in one month (whole months only).
    function _positionWeight(Position storage p, uint256 epoch) internal view returns (uint256) {
        if (epoch < p.activeFrom || epoch >= uint256(p.activeFrom) + p.periods) return 0;
        return p.amount * (epochEnd(epoch) - epochStart(epoch));
    }

    /// @dev Closed earning months not yet settled for a position: [from, to]; to = max if none.
    function _range(Position storage p) internal view returns (uint256 from, uint256 to) {
        uint256 cur = currentEpoch();
        from = uint256(p.lastSettledEpoch) + 1;
        to = cur - 1;
        uint256 lastEarning = uint256(p.activeFrom) + p.periods - 1;
        if (lastEarning < to) to = lastEarning;
        if (to < from) return (1, type(uint256).max);
    }

    function _pendingOf(Position storage p) internal view returns (uint256 amount, uint256 nextDeadline) {
        (uint256 from, uint256 to) = _range(p);
        if (to == type(uint256).max) return (0, 0);
        for (uint256 e = from; e <= to; e++) {
            uint256 tw = totalWeight(e);
            if (tw == 0) continue;
            uint256 r = (rewardOf(e) * _positionWeight(p, e)) / tw;
            if (r > 0 && block.timestamp < claimDeadline(e) && !epochSwept[e]) {
                amount += r;
                if (nextDeadline == 0) nextDeadline = claimDeadline(e);
            }
        }
    }

    /// @dev Settles one position's closed months: returns (paid, expired). Does not transfer.
    function _settle(Position storage p) internal returns (uint256 paid, uint256 expired) {
        (uint256 from, uint256 to) = _range(p);
        if (to == type(uint256).max) return (0, 0);
        for (uint256 e = from; e <= to; e++) {
            uint256 tw = totalWeight(e);
            if (tw == 0) continue;
            uint256 r = (epochReward[e] * _positionWeight(p, e)) / tw;
            if (r == 0) continue;
            if (block.timestamp < claimDeadline(e) && !epochSwept[e]) {
                paid += r;
                epochClaimed[e] += r;
            } else {
                expired += r;
            }
        }
        p.lastSettledEpoch = uint64(to);
    }

    /// @dev Settles all positions of `user`, pays the total. Returns amount paid.
    function _settleAll(address user) internal returns (uint256 paid) {
        Position[] storage ps = _positions[user];
        uint256 expired;
        for (uint256 i = 0; i < ps.length; i++) {
            (uint256 pd, uint256 ex) = _settle(ps[i]);
            paid += pd;
            expired += ex;
        }
        _book(user, paid, expired);
        if (paid > 0) _send(user, paid);
    }

    /// @dev Records claimed / expired totals and emits events (no transfer).
    function _book(address user, uint256 paid, uint256 expired) internal {
        Account storage a = accounts[user];
        if (expired > 0) {
            a.totalExpired += expired;
            emit RewardsExpiredForUser(user, expired);
        }
        if (paid > 0) {
            a.totalClaimed += paid;
            totalRewardsClaimed += paid;
            emit Claimed(user, paid);
        }
    }

    /// @dev Index of a position id in the user's open positions.
    function _indexOf(address user, uint256 positionId) internal view returns (uint256) {
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) if (ps[i].id == positionId) return i;
        revert("No stake found");
    }

    /// @dev Settles + pays one position's rewards, returns its principal, removes it (swap & pop).
    function _release(address user, uint256 idx) internal {
        Position[] storage ps = _positions[user];
        Position storage p = ps[idx];
        require(block.timestamp >= p.lockEnd, "Lock not expired");

        (uint256 paid, uint256 expired) = _settle(p);
        _book(user, paid, expired);

        uint256 amount = p.amount;
        uint256 id = p.id;
        accounts[user].staked -= amount;
        totalStaked -= amount;

        ps[idx] = ps[ps.length - 1];
        ps.pop();
        openPositions -= 1;
        if (ps.length == 0) stakerCount -= 1;

        _send(user, amount + paid);
        emit Withdrawn(user, id, amount, msg.sender);
    }

    /// @dev Releases every position of `user` whose lock ended at least `delay` ago. Returns count.
    function _releaseEnded(address user, uint256 delay) internal returns (uint256 n) {
        Position[] storage ps = _positions[user];
        uint256 i = 0;
        while (i < ps.length) {
            if (block.timestamp >= uint256(ps[i].lockEnd) + delay) {
                _release(user, i); // swap & pop: re-check the same index
                n++;
            } else {
                i++;
            }
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

    /// @dev Reserved storage slots for future upgrades (slots 32–49; previous __gap ended at 49).
    uint256[18] private __gap;
}
