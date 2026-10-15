// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/InfraStakingPool.sol";
import "../src/DividendPoolNativeV2.sol";
import "../src/legacy/StakingPoolFromDividendPoolV2.sol";

/// Upgrading the existing proxy (StakingPoolFromDividendPoolV2) in place to InfraStakingPool.
contract UpgradeFromLegacyTest is Test {
    address owner = address(0xA11CE);
    address admin = address(0xAD);
    address alice = address(0xA1);
    address bob = address(0xB0B);

    DividendPoolNativeV2 dividend;
    StakingPoolFromDividendPoolV2 legacy;
    address proxy;

    uint256 constant OCT_15 = 1792022400;
    uint256 constant NOV_1 = 1793491200;
    uint256 constant DEC_1 = 1796083200;
    uint256 constant E_NOV = 2026 * 12 + 10;

    function setUp() public {
        vm.warp(OCT_15 - 60 days);
        DividendPoolNativeV2 dImpl = new DividendPoolNativeV2();
        dividend = DividendPoolNativeV2(
            payable(new ERC1967Proxy(address(dImpl), abi.encodeCall(DividendPoolNativeV2.initialize, (owner))))
        );
        StakingPoolFromDividendPoolV2 lImpl = new StakingPoolFromDividendPoolV2();
        proxy = address(
            new ERC1967Proxy(address(lImpl), abi.encodeCall(StakingPoolFromDividendPoolV2.initialize, (owner, address(dividend))))
        );
        legacy = StakingPoolFromDividendPoolV2(payable(proxy));
        vm.prank(owner);
        dividend.setStakingContract(proxy);
        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.deal(owner, 1_000 ether);
    }

    /// Use the old contract the way it may have been used: a full stake → reward → withdraw
    /// cycle (leaves leftover data in old storage) plus a stray transfer.
    function _useLegacy() internal {
        vm.prank(alice);
        legacy.stake{value: 10 ether}(1);
        vm.deal(address(dividend), 5 ether);
        vm.prank(owner);
        dividend.sendRewardsToStaking(5 ether);
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        legacy.withdraw();
        (bool ok, ) = proxy.call{value: 0.02 ether}(""); // like the 0.02 reAED on UAT
        assertTrue(ok);
        assertEq(legacy.totalStaked(), 0);
        assertEq(legacy.totalLocked(), 0);
    }

    function _upgrade() internal {
        InfraStakingPool impl = new InfraStakingPool();
        vm.prank(owner);
        StakingPoolFromDividendPoolV2(payable(proxy)).upgradeToAndCall(
            address(impl), abi.encodeCall(InfraStakingPool.upgradeToMonthlyPool, (address(dividend), admin))
        );
    }

    function test_upgradeInPlaceThenFullMonthlyFlow() public {
        _useLegacy();
        uint256 leftover = proxy.balance;
        vm.warp(OCT_15);
        _upgrade();
        InfraStakingPool pool = InfraStakingPool(payable(proxy));

        // same address, owner and dividend pool; new config applied; clean accounting
        assertEq(pool.owner(), owner);
        assertEq(pool.dividendPool(), address(dividend));
        assertEq(pool.adminWallet(), admin);
        assertEq(pool.totalStaked(), 0);
        assertEq(pool.lastSyncedEpoch(), pool.currentEpoch());
        assertEq(pool.surplusBalance(), leftover); // old leftover is recoverable surplus
        assertEq(pool.positionCount(alice), 0); // old leftover user data does not leak into the new records

        // new monthly flow on the upgraded proxy
        vm.prank(alice);
        uint256 aId = pool.stake{value: 300 ether}(1);
        vm.prank(bob);
        uint256 bId = pool.stake{value: 100 ether}(1);
        vm.warp(NOV_1 + 10 days);
        vm.deal(address(dividend), 1_000 ether);
        vm.prank(owner);
        dividend.sendRewardsToStaking(1_000 ether);

        vm.warp(DEC_1 + 1 days);
        uint256 before = alice.balance;
        vm.prank(alice);
        pool.withdraw(aId);
        assertEq(alice.balance - before, 300 ether + 750 ether);

        // Bob misses the grace period → principal only; his share goes to admin
        vm.warp(DEC_1 + 30 days);
        before = bob.balance;
        vm.prank(bob);
        pool.withdraw(bId);
        assertEq(bob.balance - before, 100 ether);
        pool.sweepExpired(E_NOV);
        assertEq(admin.balance, 250 ether);

        // owner recovers the old leftover
        vm.prank(owner);
        pool.ownerWithdrawRewards(payable(owner), leftover);
        assertEq(proxy.balance, 0);
    }

    function test_upgradeRefusedWhileLegacyStakeLive() public {
        vm.prank(alice);
        legacy.stake{value: 1 ether}(1);
        InfraStakingPool impl = new InfraStakingPool();
        vm.prank(owner);
        vm.expectRevert("Legacy stakes exist");
        StakingPoolFromDividendPoolV2(payable(proxy)).upgradeToAndCall(
            address(impl), abi.encodeCall(InfraStakingPool.upgradeToMonthlyPool, (address(dividend), admin))
        );
    }

    function test_upgradeOnlyOwnerAndOnlyOnce() public {
        InfraStakingPool impl = new InfraStakingPool();
        vm.prank(alice);
        vm.expectRevert();
        StakingPoolFromDividendPoolV2(payable(proxy)).upgradeToAndCall(
            address(impl), abi.encodeCall(InfraStakingPool.upgradeToMonthlyPool, (address(dividend), admin))
        );

        _upgrade();
        vm.prank(owner);
        vm.expectRevert(); // reinitializer(3) already used
        InfraStakingPool(payable(proxy)).upgradeToMonthlyPool(address(dividend), admin);
    }

    function test_upgradeWorksAfterLegacyInitializeV2Fresh() public {
        vm.prank(owner);
        legacy.initializeV2Fresh(address(dividend), owner); // reinitializer(2) was possibly used on UAT
        _upgrade();
        assertEq(InfraStakingPool(payable(proxy)).adminWallet(), admin);
    }
}
