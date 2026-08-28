// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PropertyOwnershipNFT} from "../../src/PropertyOwnershipNFT.sol";
import {DeployPropertyOwnershipNFT} from "../../script/DeployPropertyOwnershipNFT.s.sol";

contract PropertyOwnershipNFTTest is Test {
    PropertyOwnershipNFT public nft;
    address public AUTHORITY = makeAddr("authority"); // contract owner / title authority
    address public OWNER_A = makeAddr("ownerA");
    address public OWNER_B = makeAddr("ownerB");

    string constant PROPERTY_ID = "DEED-2024-001";
    string constant TOKEN_URI = "ipfs://QmExampleHash";

    function setUp() public {
        vm.prank(AUTHORITY);
        nft = new PropertyOwnershipNFT();
    }

    /*//////////////////////////////////////////////////////////////
                              MINTING
    //////////////////////////////////////////////////////////////*/

    function test_MintProperty() public {
        vm.prank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);

        assertEq(nft.ownerOf(1), OWNER_A);
        assertEq(nft.tokenURI(1), TOKEN_URI);
        assertEq(nft.getNextTokenId(), 1);

        PropertyOwnershipNFT.Property memory prop = nft.getProperty(1);
        assertEq(prop.propertyId, PROPERTY_ID);
        assertEq(prop.currentOwner, OWNER_A);
        assertTrue(prop.exists);
    }

    function test_RevertIf_NonOwnerMints() public {
        vm.prank(OWNER_A);
        vm.expectRevert();
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);
    }

    function test_RevertIf_DuplicatePropertyId() public {
        vm.startPrank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyOwnershipNFT.PropertyOwnershipNFT__PropertyAlreadyRegistered.selector, PROPERTY_ID)
        );
        nft.mintProperty(OWNER_B, PROPERTY_ID, "ipfs://other");
        vm.stopPrank();
    }

    function test_GetTokenIdByPropertyId() public {
        vm.prank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);

        assertEq(nft.getTokenIdByPropertyId(PROPERTY_ID), 1);
    }

    /*//////////////////////////////////////////////////////////////
                         PROPERTY TRANSFER
    //////////////////////////////////////////////////////////////*/

    function test_TransferProperty() public {
        vm.startPrank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);
        nft.transferProperty(1, OWNER_B);
        vm.stopPrank();

        assertEq(nft.ownerOf(1), OWNER_B);

        PropertyOwnershipNFT.Property memory prop = nft.getProperty(1);
        assertEq(prop.currentOwner, OWNER_B);
    }

    function test_RevertIf_NonOwnerTransfersProperty() public {
        vm.prank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);

        vm.prank(OWNER_A);
        vm.expectRevert();
        nft.transferProperty(1, OWNER_B);
    }

    function test_RevertIf_TransferToZeroAddress() public {
        vm.startPrank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);
        vm.expectRevert(PropertyOwnershipNFT.PropertyOwnershipNFT__NewOwnerIsZeroAddress.selector);
        nft.transferProperty(1, address(0));
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                    MARKETPLACE TRANSFER BLOCKED
    //////////////////////////////////////////////////////////////*/

    function test_RevertIf_StandardTransfer() public {
        vm.prank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);

        vm.prank(OWNER_A);
        vm.expectRevert(PropertyOwnershipNFT.PropertyOwnershipNFT__TransferNotAllowed.selector);
        nft.transferFrom(OWNER_A, OWNER_B, 1);
    }

    function test_RevertIf_SafeTransferFrom() public {
        vm.prank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);

        vm.prank(OWNER_A);
        vm.expectRevert(PropertyOwnershipNFT.PropertyOwnershipNFT__TransferNotAllowed.selector);
        nft.safeTransferFrom(OWNER_A, OWNER_B, 1);
    }

    function test_RevertIf_Approve() public {
        vm.prank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);

        vm.prank(OWNER_A);
        vm.expectRevert(PropertyOwnershipNFT.PropertyOwnershipNFT__TransferNotAllowed.selector);
        nft.approve(OWNER_B, 1);
    }

    function test_RevertIf_SetApprovalForAll() public {
        vm.prank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);

        vm.prank(OWNER_A);
        vm.expectRevert(PropertyOwnershipNFT.PropertyOwnershipNFT__TransferNotAllowed.selector);
        nft.setApprovalForAll(OWNER_B, true);
    }

    /*//////////////////////////////////////////////////////////////
                          UPDATE URI
    //////////////////////////////////////////////////////////////*/

    function test_UpdatePropertyURI() public {
        vm.startPrank(AUTHORITY);
        nft.mintProperty(OWNER_A, PROPERTY_ID, TOKEN_URI);
        nft.updatePropertyURI(1, "ipfs://UpdatedHash");
        vm.stopPrank();

        assertEq(nft.tokenURI(1), "ipfs://UpdatedHash");
    }
}
