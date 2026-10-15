// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/InfraStakingPool.sol";

/// Usage:
///   OWNER=0xYourSafe DIVIDEND_POOL=0xPool ADMIN_WALLET=0xAdmin forge script script/Deploy.s.sol \
///     --rpc-url https://uat.infraworld.org/ --broadcast --private-key $DEPLOYER_KEY
/// Then, from the dividend pool owner: setStakingContract(<printed proxy address>)
contract Deploy is Script {
    function run() external {
        address owner = vm.envAddress("OWNER");
        address dividendPool = vm.envAddress("DIVIDEND_POOL");
        address adminWallet = vm.envAddress("ADMIN_WALLET");
        vm.startBroadcast();
        InfraStakingPool impl = new InfraStakingPool();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(InfraStakingPool.initialize, (owner, dividendPool, adminWallet))
        );
        vm.stopBroadcast();
        console.log("Implementation:", address(impl));
        console.log("Staking pool (proxy):", address(proxy));
    }
}
