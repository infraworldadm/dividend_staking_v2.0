// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IStakingRewardReceiver {
    function fundRewardsFromDividendPool() external payable;
}

/**
 * @title  DividendPoolNativeV2
 * @notice Collects INFRA network fees (native reAED) during each month and hands them to the
 *         staking pool (InfraStakingPool) as that month's reward pool.
 *
 *  Flow
 *    fees ──receive()──► this contract ──pullForStaking()──► InfraStakingPool (automatic, monthly)
 *
 *  - pullForStaking(): called BY the staking contract at the first transaction of a new month;
 *    sends the whole balance and can only ever pay `stakingContract`.
 *  - sendRewardsToStaking / sendRewardsToStakingPlain: optional manual top-ups by the owner.
 *  - emergencyWithdraw: owner safety valve.
 *
 *  Upgradeable (UUPS). Storage is append-only: never reorder existing variables.
 */
contract DividendPoolNativeV2 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ------------------------------------------------------------------
    // OLD STORAGE - keep this if upgrading from your existing contract
    // ------------------------------------------------------------------

    struct LockTimeInfo {
        uint256 amount;
        uint256 startDate;
        uint256 countOfPeriods;
        uint256 endDate;
        uint256 reward;
    }

    mapping(address => LockTimeInfo) public users;

    uint256 public totalLocked;
    uint256 public totalRewarded;

    // ------------------------------------------------------------------
    // NEW STORAGE
    // ------------------------------------------------------------------

    address public stakingContract;
    uint256 public totalRewardsSentToStaking;
    uint256 public totalReceived;

    event RewardReceived(address indexed from, uint256 amount);
    event StakingContractUpdated(address indexed oldStakingContract, address indexed newStakingContract);
    event RewardSentToStaking(address indexed stakingContract, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Accepts network fees / any native reAED sent to the pool.
    receive() external payable {
        require(msg.value > 0, "No native coin received");
        totalReceived += msg.value;
        emit RewardReceived(msg.sender, msg.value);
    }

    // ------------------------------------------------------------------
    // Admin config
    // ------------------------------------------------------------------

    /// @notice Link the staking contract that is allowed to pull this pool's balance.
    function setStakingContract(address newStakingContract) external onlyOwner {
        require(newStakingContract != address(0), "staking=0");

        address old = stakingContract;
        stakingContract = newStakingContract;

        emit StakingContractUpdated(old, newStakingContract);
    }

    // ------------------------------------------------------------------
    // Preferred method: send reward to staking contract function
    // ------------------------------------------------------------------

    /// @notice Owner top-up: sends `amount` to the staking contract, credited to the RUNNING month.
    function sendRewardsToStaking(uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(stakingContract != address(0), "staking not set");
        require(amount > 0, "amount=0");
        require(address(this).balance >= amount, "insufficient balance");

        totalRewardsSentToStaking += amount;

        IStakingRewardReceiver(stakingContract).fundRewardsFromDividendPool{
            value: amount
        }();

        emit RewardSentToStaking(stakingContract, amount);
    }

    // ------------------------------------------------------------------
    // Backup method: plain native transfer to staking contract
    // Use this only if staking contract does not have fundRewardsFromDividendPool()
    // ------------------------------------------------------------------

    /// @notice Same as sendRewardsToStaking but as a plain native transfer (fallback path).
    function sendRewardsToStakingPlain(uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(stakingContract != address(0), "staking not set");
        require(amount > 0, "amount=0");
        require(address(this).balance >= amount, "insufficient balance");

        totalRewardsSentToStaking += amount;

        (bool sent, ) = payable(stakingContract).call{value: amount}("");
        require(sent, "staking transfer failed");

        emit RewardSentToStaking(stakingContract, amount);
    }

    // ------------------------------------------------------------------
    // AUTOMATIC: the staking contract pulls the whole balance once a month
    // (first transaction after month end). No owner signature needed.
    // Funds can ONLY go to `stakingContract`.
    // ------------------------------------------------------------------

    /// @notice Sends the whole balance to the staking contract. Only callable by it.
    /// @return amount reAED sent (0 if the pool was empty)
    function pullForStaking() external nonReentrant returns (uint256 amount) {
        require(msg.sender == stakingContract, "only staking");
        amount = address(this).balance;
        if (amount == 0) return 0;
        totalRewardsSentToStaking += amount;
        (bool sent, ) = payable(stakingContract).call{value: amount}("");
        require(sent, "staking transfer failed");
        emit RewardSentToStaking(stakingContract, amount);
    }

    // ------------------------------------------------------------------
    // Emergency withdrawal
    // ------------------------------------------------------------------

    /// @notice Owner safety valve: withdraw `amount` to `to`.
    function emergencyWithdraw(address payable to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        require(address(this).balance >= amount, "insufficient balance");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Emergency send failed");

        emit EmergencyWithdraw(to, amount);
    }

    uint256[45] private __gap;
}