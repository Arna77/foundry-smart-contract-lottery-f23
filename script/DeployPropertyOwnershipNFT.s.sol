// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {PropertyOwnershipNFT} from "../src/PropertyOwnershipNFT.sol";

contract DeployPropertyOwnershipNFT is Script {
    function run() external returns (PropertyOwnershipNFT) {
        vm.startBroadcast();
        PropertyOwnershipNFT nft = new PropertyOwnershipNFT();
        vm.stopBroadcast();
        return nft;
    }
}
