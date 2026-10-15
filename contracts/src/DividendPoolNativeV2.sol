// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IStakingRewardReceiver {
    function fundRewardsFromDividendPool() external payable;
}

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

    receive() external payable {
        require(msg.value > 0, "No native coin received");
        totalReceived += msg.value;
        emit RewardReceived(msg.sender, msg.value);
    }

    // ------------------------------------------------------------------
    // Admin config
    // ------------------------------------------------------------------

    function setStakingContract(address newStakingContract) external onlyOwner {
        require(newStakingContract != address(0), "staking=0");

        address old = stakingContract;
        stakingContract = newStakingContract;

        emit StakingContractUpdated(old, newStakingContract);
    }

    // ------------------------------------------------------------------
    // Preferred method: send reward to staking contract function
    // ------------------------------------------------------------------

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
    // Emergency withdrawal
    // ------------------------------------------------------------------

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