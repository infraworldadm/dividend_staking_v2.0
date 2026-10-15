// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/InfraStakingPool.sol";
import "../src/DividendPoolNativeV2.sol";

contract InfraStakingPoolV2Mock is InfraStakingPool {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract InfraStakingPoolTest is Test {
    InfraStakingPool pool;
    DividendPoolNativeV2 dividend;

    address owner = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address feePayer = address(0xFEE);
    address adminWallet = address(0xAD);

    uint256 constant OCT_1 = 1790812800; // 2026-10-01
    uint256 constant OCT_15 = 1792022400; // 2026-10-15
    uint256 constant NOV_1 = 1793491200; // 2026-11-01
    uint256 constant DEC_1 = 1796083200; // 2026-12-01
    uint256 constant JAN_1 = 1798761600; // 2027-01-01

    uint256 constant E_OCT = 2026 * 12 + 9;
    uint256 constant E_NOV = E_OCT + 1;
    uint256 constant E_DEC = E_OCT + 2;

    function setUp() public {
        vm.warp(OCT_15);

        DividendPoolNativeV2 dImpl = new DividendPoolNativeV2();
        dividend = DividendPoolNativeV2(
            payable(new ERC1967Proxy(address(dImpl), abi.encodeCall(DividendPoolNativeV2.initialize, (owner))))
        );

        InfraStakingPool impl = new InfraStakingPool();
        pool = InfraStakingPool(
            payable(new ERC1967Proxy(address(impl), abi.encodeCall(InfraStakingPool.initialize, (owner, address(dividend), adminWallet))))
        );

        vm.prank(owner);
        dividend.setStakingContract(address(pool));

        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.deal(feePayer, 1_000_000 ether);
    }

    // network fees arrive at the dividend pool, admin forwards them to staking
    function _fees(uint256 amount) internal {
        vm.prank(feePayer);
        (bool ok, ) = address(dividend).call{value: amount}("");
        assertTrue(ok);
        vm.prank(owner);
        dividend.sendRewardsToStaking(amount);
    }

    // ---------------- calendar ----------------

    function test_calendar() public view {
        assertEq(pool.epochOf(OCT_15), E_OCT);
        assertEq(pool.epochStart(E_OCT), OCT_1);
        assertEq(pool.epochEnd(E_OCT), NOV_1);
        assertEq(pool.epochStart(E_DEC + 1), JAN_1);
        assertEq(pool.claimDeadline(E_OCT), NOV_1 + 30 days);
        assertEq(pool.epochOf(1709164800), 2024 * 12 + 1); // 2024-02-29 leap day → Feb
        assertEq(pool.epochStart(2024 * 12 + 2), 1709251200); // 2024-03-01
        assertEq(pool.epochStart(2100 * 12 + 2), 4107542400); // 2100-03-01 (non-leap century)
        assertEq(pool.epochOf(NOV_1 - 1), E_OCT);
        assertEq(pool.epochOf(NOV_1), E_NOV);
    }

    // ---------------- staking ----------------

    function test_stakeJoinsNextMonth() public {
        vm.prank(alice);
        pool.stake{value: 100 ether}(2);

        (uint256 amount,, uint64 periods, uint64 activeFrom, uint64 lockEnd,,,) = pool.users(alice);
        assertEq(amount, 100 ether);
        assertEq(periods, 2);
        assertEq(activeFrom, E_NOV);
        assertEq(lockEnd, JAN_1); // Nov + Dec locked
        assertEq(pool.userWeight(alice, E_OCT), 0);
        assertEq(pool.userWeight(alice, E_NOV), 100 ether * 30 days);
        assertEq(pool.totalWeight(E_NOV), 100 ether * 30 days);
    }

    function test_oneActiveStakePerWallet() public {
        vm.startPrank(alice);
        pool.stake{value: 1 ether}(1);
        vm.expectRevert("Already staked");
        pool.stake{value: 1 ether}(1);
        vm.stopPrank();
    }

    function test_rewardsSplitByWeight() public {
        vm.prank(alice);
        pool.stake{value: 300 ether}(1);
        vm.prank(bob);
        pool.stake{value: 100 ether}(1);

        // November fees
        vm.warp(NOV_1 + 5 days);
        _fees(1_000 ether);

        // nothing claimable while November is running
        (uint256 p,) = pool.pendingRewards(alice);
        assertEq(p, 0);

        vm.warp(DEC_1 + 1 days);
        (uint256 pa, uint256 deadline) = pool.pendingRewards(alice);
        assertEq(pa, 750 ether);
        assertEq(deadline, DEC_1 + 30 days);

        uint256 before = alice.balance;
        vm.prank(alice);
        pool.claim();
        assertEq(alice.balance - before, 750 ether);

        vm.prank(bob);
        pool.claim();
        assertEq(bob.balance, 900 ether + 250 ether);

        vm.prank(alice);
        vm.expectRevert("No rewards");
        pool.claim();
    }

    function test_feesDuringJoinMonthDoNotGoToNewStakers() public {
        _fees(500 ether); // October fees, nobody active in October
        vm.prank(alice);
        pool.stake{value: 10 ether}(1);

        vm.warp(NOV_1 + 1);
        (uint256 p,) = pool.pendingRewards(alice);
        assertEq(p, 0);

        // October had no stakers → its rewards go to the admin wallet as soon as it closes
        pool.sweepExpired(E_OCT);
        assertEq(adminWallet.balance, 500 ether);
        assertEq(pool.epochReward(E_NOV), 0);
    }

    function test_claimWindowExpiryAndRollover() public {
        vm.prank(alice);
        pool.stake{value: 100 ether}(1);
        vm.prank(bob);
        pool.stake{value: 100 ether}(1);
        vm.warp(NOV_1 + 1 days);
        _fees(200 ether);

        // Alice claims in time, Bob misses the 30-day window
        vm.warp(DEC_1 + 10 days);
        vm.prank(alice);
        pool.claim();

        vm.prank(bob);
        vm.expectRevert("Claim window open");
        pool.sweepExpired(E_NOV);

        vm.warp(DEC_1 + 30 days);
        (uint256 pb,) = pool.pendingRewards(bob);
        assertEq(pb, 0);

        pool.sweepExpired(E_NOV);
        assertEq(adminWallet.balance, 100 ether); // Bob's unclaimed share → admin wallet
        assertEq(pool.epochReward(E_DEC), 0); // NOT forwarded to the next month

        vm.prank(bob);
        vm.expectRevert("No rewards");
        pool.claim();
        // his November share existed but is no longer claimable
        assertEq(pool.userEpochReward(bob, E_NOV), 100 ether);

        vm.prank(alice);
        vm.expectRevert("Already swept");
        pool.sweepExpired(E_NOV);
    }

    function test_earningStopsWhenLockEnds() public {
        vm.prank(alice);
        pool.stake{value: 100 ether}(1); // earns November only
        vm.prank(bob);
        pool.stake{value: 100 ether}(3); // earns Nov, Dec, Jan

        assertEq(pool.userWeight(alice, E_NOV), 100 ether * 30 days);
        assertEq(pool.userWeight(alice, E_DEC), 0);
        assertEq(pool.userWeight(bob, E_DEC), 100 ether * 31 days);

        vm.warp(NOV_1 + 3 days);
        vm.prank(alice);
        vm.expectRevert("Lock not expired");
        pool.withdraw();
        _fees(100 ether); // November: 50 / 50

        vm.warp(DEC_1 + 10 days);
        _fees(300 ether); // December: all to Bob (Alice's lock ended)
        assertEq(pool.totalWeight(E_DEC), 100 ether * 31 days);

        uint256 before = alice.balance;
        vm.prank(alice);
        pool.withdraw(); // principal + November reward
        assertEq(alice.balance - before, 100 ether + 50 ether);
        assertEq(pool.totalStaked(), 100 ether);

        vm.warp(JAN_1 + 1);
        (uint256 pb,) = pool.pendingRewards(bob);
        assertEq(pb, 300 ether); // December; November's window closed on Dec 31 (Bob never claimed it)
        (uint256 pa,) = pool.pendingRewards(alice);
        assertEq(pa, 0);
    }

    function test_noRewardsAfterLockIfNotUnstaked() public {
        vm.prank(alice);
        pool.stake{value: 10 ether}(1); // November only
        vm.warp(DEC_1 + 1);
        _fees(30 ether); // December — Alice did not unstake but no longer earns
        vm.warp(JAN_1 + 1);
        (uint256 p,) = pool.pendingRewards(alice);
        assertEq(p, 0);
        pool.sweepExpired(E_DEC); // nobody earned December → admin wallet right away
        assertEq(adminWallet.balance, 30 ether);
    }

    function test_releaseAfterGracePeriod() public {
        vm.prank(alice);
        pool.stake{value: 40 ether}(1); // earns November; lock ends Dec 1; grace ends Dec 31
        vm.prank(bob);
        pool.stake{value: 60 ether}(2); // earns Nov + Dec; lock ends Jan 1; grace ends Jan 31
        vm.warp(NOV_1 + 1);
        _fees(100 ether);
        assertEq(pool.graceEnd(alice), DEC_1 + 30 days);

        address keeper = address(0xBEEF);

        // lock ended but grace period running: only Alice herself can withdraw
        vm.warp(DEC_1 + 2 days);
        vm.prank(keeper);
        vm.expectRevert("Grace period active");
        pool.releaseStake(alice);

        // Alice ignored it; grace over → keeper returns her principal, November reward forfeited
        vm.warp(DEC_1 + 30 days);
        uint256 aliceBefore = alice.balance;
        vm.prank(keeper);
        pool.releaseStake(alice);
        assertEq(alice.balance - aliceBefore, 40 ether); // principal only
        assertEq(keeper.balance, 0);
        (uint256 aliceAmt,,,,,,,) = pool.users(alice);
        assertEq(aliceAmt, 0);

        // forfeited rewards (Alice's 40 + Bob's unclaimed 60 from November) → admin wallet
        pool.sweepExpired(E_NOV);
        assertEq(adminWallet.balance, 100 ether);

        // batch: Bob still inside his window → skipped, no revert
        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        pool.releaseStakes(list);
        (uint256 bobAmt,,,,,,,) = pool.users(bob);
        assertEq(bobAmt, 60 ether);

        // Bob withdraws himself right after his lock: principal + December reward
        vm.warp(JAN_1 + 1);
        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        pool.withdraw();
        assertEq(bob.balance - bobBefore, 60 ether); // no December rewards were funded
        assertEq(pool.totalStaked(), 0);
    }

    function test_restakeAfterWithdraw() public {
        vm.prank(alice);
        pool.stake{value: 10 ether}(1);
        vm.prank(alice);
        vm.expectRevert("Already staked");
        pool.stake{value: 1 ether}(1);

        vm.warp(DEC_1 + 2 days);
        vm.prank(alice);
        pool.withdraw();
        vm.prank(alice);
        pool.stake{value: 5 ether}(2);
        (uint256 amount,, uint64 periods, uint64 activeFrom, uint64 lockEnd,,,) = pool.users(alice);
        assertEq(amount, 5 ether);
        assertEq(periods, 2);
        assertEq(activeFrom, E_DEC + 1); // January 2027
        assertEq(lockEnd, pool.epochStart(E_DEC + 3)); // March 1 2027
    }

    function test_afterGraceOnlyPrincipal() public {
        vm.prank(alice);
        pool.stake{value: 50 ether}(1); // earns November; grace ends Dec 31
        vm.warp(NOV_1 + 1);
        _fees(1_000 ether); // e.g. dividend pool held 1,000 reAED at month end

        // within grace: principal + rewards
        vm.warp(DEC_1 + 29 days);
        (uint256 p,) = pool.pendingRewards(alice);
        assertEq(p, 1_000 ether);

        // grace passed: principal only, rewards to admin wallet
        vm.warp(DEC_1 + 30 days);
        uint256 before = alice.balance;
        vm.prank(alice);
        pool.withdraw();
        assertEq(alice.balance - before, 50 ether);
        pool.sweepExpired(E_NOV);
        assertEq(adminWallet.balance, 1_000 ether);
        assertEq(address(pool).balance, 0);
    }

    function test_onlyDividendPoolOrOwnerCanFund() public {
        vm.prank(feePayer);
        vm.expectRevert("Only dividend pool");
        pool.fundRewardsFromDividendPool{value: 1 ether}();

        vm.prank(feePayer);
        (bool ok, ) = address(pool).call{value: 1 ether}("");
        assertFalse(ok);

        vm.deal(owner, 5 ether);
        vm.prank(owner);
        pool.fundRewardsFromDividendPool{value: 5 ether}();
        assertEq(pool.epochReward(E_OCT), 5 ether);

        // dividend pool's plain-transfer backup path also works
        vm.prank(feePayer);
        (ok, ) = address(dividend).call{value: 2 ether}("");
        vm.prank(owner);
        dividend.sendRewardsToStakingPlain(2 ether);
        assertEq(pool.epochReward(E_OCT), 7 ether);
    }

    function test_adminWalletChangeOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        pool.setAdminWallet(alice);
        vm.prank(owner);
        pool.setAdminWallet(address(0xCAFE));
        assertEq(pool.adminWallet(), address(0xCAFE));
    }

    // ---------------- owner ----------------

    function test_ownerWithdrawCannotTouchPrincipal() public {
        vm.prank(alice);
        pool.stake{value: 100 ether}(1);
        _fees(40 ether);
        assertEq(pool.surplusBalance(), 40 ether);

        vm.startPrank(owner);
        vm.expectRevert("Exceeds reward balance");
        pool.ownerWithdrawRewards(payable(owner), 41 ether);
        pool.ownerWithdrawRewards(payable(owner), 40 ether);
        vm.stopPrank();
        assertEq(address(pool).balance, 100 ether);
    }

    function test_emergencyWithdrawOnlyOwner() public {
        vm.prank(alice);
        pool.stake{value: 100 ether}(1);
        vm.prank(alice);
        vm.expectRevert();
        pool.emergencyWithdraw(payable(alice), 1 ether);
        vm.prank(owner);
        pool.emergencyWithdraw(payable(owner), 100 ether);
        assertEq(owner.balance, 100 ether);
    }

    function test_upgradeKeepsState() public {
        vm.prank(alice);
        pool.stake{value: 7 ether}(1);
        InfraStakingPoolV2Mock v2 = new InfraStakingPoolV2Mock();

        vm.prank(alice);
        vm.expectRevert();
        pool.upgradeToAndCall(address(v2), "");

        vm.prank(owner);
        pool.upgradeToAndCall(address(v2), "");
        assertEq(InfraStakingPoolV2Mock(payable(address(pool))).version(), 2);
        assertEq(pool.totalStaked(), 7 ether);
    }

    function test_cannotInitializeImplementation() public {
        InfraStakingPool impl = new InfraStakingPool();
        vm.expectRevert();
        impl.initialize(owner, address(dividend), adminWallet);
    }

    // ---------------- invariant-style fuzz ----------------

    function testFuzz_payoutsNeverExceedRewards(uint96 a, uint96 b, uint96 fee, uint8 pa_, uint8 pb_) public {
        uint256 amtA = bound(a, 1, 500 ether);
        uint256 amtB = bound(b, 1, 500 ether);
        uint256 f = bound(fee, 1, 100_000 ether);
        uint256 perA = bound(pa_, 1, 3);
        uint256 perB = bound(pb_, 1, 3);

        vm.prank(alice);
        pool.stake{value: amtA}(perA);
        vm.prank(bob);
        pool.stake{value: amtB}(perB);
        vm.warp(NOV_1 + 1);
        _fees(f);
        vm.warp(DEC_1 + 1);
        _fees(f);
        vm.warp(JAN_1 + 1);

        (uint256 ra,) = pool.pendingRewards(alice);
        (uint256 rb,) = pool.pendingRewards(bob);
        assertLe(ra + rb, 2 * f);
        if (ra > 0) {
            vm.prank(alice);
            pool.claim();
        }
        if (rb > 0) {
            vm.prank(bob);
            pool.claim();
        }
        assertGe(address(pool).balance, pool.totalStaked());

        // abandoned stakes can always be returned after lock + grace period
        vm.warp(pool.epochStart(E_OCT + 6));
        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        pool.releaseStakes(list);
        assertEq(pool.totalStaked(), 0);
    }
}
