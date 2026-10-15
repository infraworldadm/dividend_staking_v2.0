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
            payable(
                new ERC1967Proxy(
                    address(impl), abi.encodeCall(InfraStakingPool.initialize, (owner, address(dividend), adminWallet))
                )
            )
        );
        vm.prank(owner);
        dividend.setStakingContract(address(pool));
        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.deal(feePayer, 1_000_000 ether);
    }

    function _fees(uint256 amount) internal {
        vm.prank(feePayer);
        (bool ok, ) = address(dividend).call{value: amount}("");
        assertTrue(ok);
        vm.prank(owner);
        dividend.sendRewardsToStaking(amount);
    }

    function _stake(address who, uint256 amount, uint256 periods) internal returns (uint256 id) {
        vm.prank(who);
        id = pool.stake{value: amount}(periods);
    }

    function _pending(address who) internal view returns (uint256 p) {
        (p,) = pool.pendingRewards(who);
    }

    // ---------------- calendar ----------------

    function test_calendar() public view {
        assertEq(pool.epochOf(OCT_15), E_OCT);
        assertEq(pool.epochStart(E_OCT), OCT_1);
        assertEq(pool.epochEnd(E_OCT), NOV_1);
        assertEq(pool.epochStart(E_DEC + 1), JAN_1);
        assertEq(pool.claimDeadline(E_OCT), NOV_1 + 30 days);
        assertEq(pool.epochOf(1709164800), 2024 * 12 + 1); // 2024-02-29
        assertEq(pool.epochStart(2024 * 12 + 2), 1709251200); // 2024-03-01
        assertEq(pool.epochStart(2100 * 12 + 2), 4107542400); // 2100-03-01
        assertEq(pool.epochOf(NOV_1 - 1), E_OCT);
        assertEq(pool.epochOf(NOV_1), E_NOV);
    }

    // ---------------- positions ----------------

    function test_stakeOpensPositionJoiningNextMonth() public {
        uint256 id = _stake(alice, 100 ether, 2);
        assertEq(id, 0);
        InfraStakingPool.Position[] memory ps = pool.positionsOf(alice);
        assertEq(ps.length, 1);
        assertEq(ps[0].amount, 100 ether);
        assertEq(ps[0].activeFrom, E_NOV);
        assertEq(ps[0].lockEnd, JAN_1);
        assertEq(pool.userWeight(alice, E_OCT), 0);
        assertEq(pool.userWeight(alice, E_NOV), 100 ether * 30 days);
        assertEq(pool.userWeight(alice, E_DEC), 100 ether * 31 days);
        assertEq(pool.userWeight(alice, E_DEC + 1), 0);
    }

    function test_multiplePositionsPerWallet() public {
        uint256 a = _stake(alice, 100 ether, 1); // Nov
        uint256 b = _stake(alice, 50 ether, 3); // Nov, Dec, Jan
        assertEq(a, 0);
        assertEq(b, 1);
        assertEq(pool.positionCount(alice), 2);
        (uint256 staked,,,) = pool.accounts(alice);
        assertEq(staked, 150 ether);
        assertEq(pool.userWeight(alice, E_NOV), 150 ether * 30 days);
        assertEq(pool.userWeight(alice, E_DEC), 50 ether * 31 days);

        // a later stake in November opens a third position joining December
        vm.warp(NOV_1 + 3 days);
        uint256 c = _stake(alice, 25 ether, 1);
        assertEq(c, 2);
        assertEq(pool.userWeight(alice, E_DEC), 75 ether * 31 days);
    }

    function test_positionCap() public {
        vm.startPrank(alice);
        for (uint256 i = 0; i < pool.MAX_POSITIONS(); i++) pool.stake{value: 1 ether}(1);
        vm.expectRevert("Too many positions");
        pool.stake{value: 1 ether}(1);
        vm.stopPrank();
    }

    function test_claimAcrossPositions() public {
        _stake(alice, 100 ether, 1);
        _stake(alice, 200 ether, 2);
        _stake(bob, 100 ether, 1);
        vm.warp(NOV_1 + 5 days);
        _fees(800 ether); // Nov: alice 300/400, bob 100/400

        vm.warp(DEC_1 + 1 days);
        (uint256 pa, uint256 deadline) = pool.pendingRewards(alice);
        assertEq(pa, 600 ether);
        assertEq(deadline, DEC_1 + 30 days);
        (uint256 p0,) = pool.pendingOfPosition(alice, 0);
        (uint256 p1,) = pool.pendingOfPosition(alice, 1);
        assertEq(p0, 200 ether);
        assertEq(p1, 400 ether);

        uint256 before = alice.balance;
        vm.prank(alice);
        pool.claim();
        assertEq(alice.balance - before, 600 ether);
        vm.prank(alice);
        vm.expectRevert("No rewards");
        pool.claim();
        (, uint256 claimed,,) = pool.accounts(alice);
        assertEq(claimed, 600 ether);
    }

    function test_feesDuringJoinMonthGoToAdmin() public {
        _fees(500 ether); // October — nobody active yet
        _stake(alice, 10 ether, 1);
        vm.warp(NOV_1 + 1);
        assertEq(_pending(alice), 0);
        pool.sweepExpired(E_OCT);
        assertEq(adminWallet.balance, 500 ether);
    }

    function test_claimWindowExpiryToAdmin() public {
        _stake(alice, 100 ether, 1);
        _stake(bob, 100 ether, 1);
        vm.warp(NOV_1 + 1 days);
        _fees(200 ether);

        vm.warp(DEC_1 + 10 days);
        vm.prank(alice);
        pool.claim();
        vm.expectRevert("Claim window open");
        pool.sweepExpired(E_NOV);

        vm.warp(DEC_1 + 30 days);
        assertEq(_pending(bob), 0);
        pool.sweepExpired(E_NOV);
        assertEq(adminWallet.balance, 100 ether);
        assertEq(pool.epochReward(E_DEC), 0); // not forwarded
        vm.expectRevert("Already swept");
        pool.sweepExpired(E_NOV);
    }

    function test_withdrawOnePositionWithRewardsInGrace() public {
        uint256 shortId = _stake(alice, 100 ether, 1); // Nov
        uint256 longId = _stake(alice, 100 ether, 3); // Nov–Jan
        _stake(bob, 200 ether, 1);

        vm.warp(NOV_1 + 3 days);
        vm.prank(alice);
        vm.expectRevert("Lock not expired");
        pool.withdraw(shortId);
        _fees(400 ether); // Nov: alice 100+100, bob 200 → each position 100

        vm.warp(DEC_1 + 10 days);
        _fees(300 ether); // Dec: only alice's long position earns

        uint256 before = alice.balance;
        vm.prank(alice);
        pool.withdraw(shortId); // principal + that position's November reward
        assertEq(alice.balance - before, 100 ether + 100 ether);
        assertEq(pool.positionCount(alice), 1);
        assertEq(pool.positionsOf(alice)[0].id, longId);

        vm.prank(alice);
        vm.expectRevert("Lock not expired");
        pool.withdraw(longId);
        vm.prank(alice);
        vm.expectRevert("No stake found");
        pool.withdraw(shortId);

        // long position: November reward claimable until Dec 31
        before = alice.balance;
        vm.prank(alice);
        pool.claim();
        assertEq(alice.balance - before, 100 ether);
        // December reward after December closes
        vm.warp(JAN_1 + 1);
        before = alice.balance;
        vm.prank(alice);
        pool.claim();
        assertEq(alice.balance - before, 300 ether);
    }

    function test_afterGraceOnlyPrincipal() public {
        uint256 id = _stake(alice, 50 ether, 1);
        vm.warp(NOV_1 + 1);
        _fees(1_000 ether);
        vm.warp(DEC_1 + 29 days);
        assertEq(_pending(alice), 1_000 ether);

        vm.warp(DEC_1 + 30 days);
        uint256 before = alice.balance;
        vm.prank(alice);
        pool.withdraw(id);
        assertEq(alice.balance - before, 50 ether);
        (,, uint256 expired,) = pool.accounts(alice);
        assertEq(expired, 1_000 ether);
        pool.sweepExpired(E_NOV);
        assertEq(adminWallet.balance, 1_000 ether);
        assertEq(address(pool).balance, 0);
    }

    function test_withdrawAll() public {
        _stake(alice, 10 ether, 1);
        _stake(alice, 20 ether, 1);
        _stake(alice, 30 ether, 2);
        vm.warp(DEC_1 + 1);
        uint256 before = alice.balance;
        vm.prank(alice);
        pool.withdrawAll(); // the two 1-month positions
        assertEq(alice.balance - before, 30 ether);
        assertEq(pool.positionCount(alice), 1);
        assertEq(pool.positionsOf(alice)[0].amount, 30 ether);
    }

    function test_releaseAfterGraceByAnyone() public {
        _stake(alice, 40 ether, 1); // grace ends Dec 31
        _stake(alice, 10 ether, 2); // grace ends Jan 31
        _stake(bob, 60 ether, 1);
        vm.warp(NOV_1 + 1);
        _fees(100 ether);

        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        address keeper = address(0xBEEF);

        vm.warp(DEC_1 + 2 days); // locks ended, grace running → nothing released
        vm.prank(keeper);
        pool.releaseStakes(list);
        assertEq(pool.positionCount(alice), 2);

        vm.warp(DEC_1 + 30 days);
        uint256 a0 = alice.balance;
        uint256 b0 = bob.balance;
        vm.prank(keeper);
        pool.releaseStakes(list);
        assertEq(alice.balance - a0, 40 ether); // only the 1-month position, principal only
        assertEq(bob.balance - b0, 60 ether);
        assertEq(keeper.balance, 0);
        assertEq(pool.positionCount(alice), 1);
        assertEq(pool.totalStaked(), 10 ether);
    }

    function test_earningStopsWhenLockEnds() public {
        _stake(alice, 10 ether, 1);
        vm.warp(DEC_1 + 1);
        _fees(30 ether); // nobody earns in December
        vm.warp(JAN_1 + 1);
        assertEq(_pending(alice), 0);
        pool.sweepExpired(E_DEC);
        assertEq(adminWallet.balance, 30 ether);
    }

    // ---------------- funding / owner ----------------

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

    function test_ownerWithdrawCannotTouchPrincipal() public {
        _stake(alice, 100 ether, 1);
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
        _stake(alice, 100 ether, 1);
        vm.prank(alice);
        vm.expectRevert();
        pool.emergencyWithdraw(payable(alice), 1 ether);
        vm.prank(owner);
        pool.emergencyWithdraw(payable(owner), 100 ether);
        assertEq(owner.balance, 100 ether);
    }

    function test_upgradeKeepsState() public {
        _stake(alice, 7 ether, 1);
        InfraStakingPoolV2Mock v2 = new InfraStakingPoolV2Mock();
        vm.prank(alice);
        vm.expectRevert();
        pool.upgradeToAndCall(address(v2), "");
        vm.prank(owner);
        pool.upgradeToAndCall(address(v2), "");
        assertEq(InfraStakingPoolV2Mock(payable(address(pool))).version(), 2);
        assertEq(pool.totalStaked(), 7 ether);
        assertEq(pool.positionCount(alice), 1);
    }

    function test_cannotInitializeImplementation() public {
        InfraStakingPool impl = new InfraStakingPool();
        vm.expectRevert();
        impl.initialize(owner, address(dividend), adminWallet);
    }

    // ---------------- fuzz ----------------

    function testFuzz_payoutsNeverExceedRewards(uint96 a, uint96 b, uint96 c, uint96 fee, uint8 pa_, uint8 pb_) public {
        uint256 f = bound(fee, 1, 100_000 ether);
        _stake(alice, bound(a, 1, 300 ether), bound(pa_, 1, 3));
        _stake(alice, bound(c, 1, 300 ether), bound(pb_, 1, 3));
        _stake(bob, bound(b, 1, 300 ether), bound(pb_, 1, 3));
        vm.warp(NOV_1 + 1);
        _fees(f);
        vm.warp(DEC_1 + 1);
        _fees(f);
        vm.warp(JAN_1 + 1);

        uint256 ra = _pending(alice);
        uint256 rb = _pending(bob);
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

        vm.warp(pool.epochStart(E_OCT + 6));
        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        pool.releaseStakes(list);
        assertEq(pool.totalStaked(), 0);
        assertGe(address(pool).balance, 0);
    }
}
