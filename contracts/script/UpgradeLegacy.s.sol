// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/InfraStakingPool.sol";

interface IUUPS {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function owner() external view returns (address);
    function totalStaked() external view returns (uint256);
}

/// Upgrades the EXISTING staking proxy (StakingPoolFromDividendPoolV2) in place to InfraStakingPool.
/// Must be broadcast by the proxy OWNER. Reverts if the old contract still holds any stake.
///
///   PROXY=0xeEb712B20b9d4AEF535a781e1222FD1174fFa919 \
///   DIVIDEND_POOL=0xCD938d217a31C85B9041a218A14015E289D61aC0 \
///   ADMIN_WALLET=0x... \
///   forge script script/UpgradeLegacy.s.sol --rpc-url https://uat.infraworld.org/ --broadcast --private-key $OWNER_KEY
contract UpgradeLegacy is Script {
    function run() external {
        address proxy = vm.envAddress("PROXY");
        address dividendPool = vm.envAddress("DIVIDEND_POOL");
        address adminWallet = vm.envAddress("ADMIN_WALLET");

        console.log("Proxy owner:", IUUPS(proxy).owner());
        console.log("Legacy totalStaked (must be 0):", IUUPS(proxy).totalStaked());

        vm.startBroadcast();
        InfraStakingPool impl = new InfraStakingPool();
        IUUPS(proxy).upgradeToAndCall(
            address(impl), abi.encodeCall(InfraStakingPool.upgradeToMonthlyPool, (dividendPool, adminWallet))
        );
        vm.stopBroadcast();

        InfraStakingPool pool = InfraStakingPool(payable(proxy));
        console.log("New implementation:", address(impl));
        console.log("dividendPool:", pool.dividendPool());
        console.log("adminWallet:", pool.adminWallet());
        console.log("currentEpoch:", pool.currentEpoch());
    }
}
