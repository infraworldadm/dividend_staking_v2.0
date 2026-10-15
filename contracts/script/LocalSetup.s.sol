// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/InfraStakingPool.sol";
import "../src/DividendPoolNativeV2.sol";

/// Local end-to-end setup (anvil): deploys DividendPoolNativeV2 + InfraStakingPool and links them.
///   anvil --chain-id 15324 &
///   forge script script/LocalSetup.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
contract LocalSetup is Script {
    function run() external {
        address admin = msg.sender;
        vm.startBroadcast();
        DividendPoolNativeV2 dImpl = new DividendPoolNativeV2();
        DividendPoolNativeV2 dividend = DividendPoolNativeV2(
            payable(new ERC1967Proxy(address(dImpl), abi.encodeCall(DividendPoolNativeV2.initialize, (admin))))
        );
        InfraStakingPool impl = new InfraStakingPool();
        address pool = address(
            new ERC1967Proxy(address(impl), abi.encodeCall(InfraStakingPool.initialize, (admin, address(dividend), admin)))
        );
        dividend.setStakingContract(pool);
        vm.stopBroadcast();
        console.log("DIVIDEND_POOL", address(dividend));
        console.log("STAKING_POOL", pool);
    }
}
