// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PropertyOwnershipNFT
/// @notice Soulbound-style NFT representing verified property ownership on Polygon.
///         - Only the contract owner (title authority) can mint after verifying a title deed.
///         - Standard marketplace transfers (transferFrom / safeTransferFrom) are disabled.
///         - The contract owner can transfer a token to a new owner when a property is sold.
contract PropertyOwnershipNFT is ERC721, ERC721URIStorage, Ownable {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error PropertyOwnershipNFT__PropertyAlreadyRegistered(string propertyId);
    error PropertyOwnershipNFT__PropertyNotRegistered(string propertyId);
    error PropertyOwnershipNFT__TransferNotAllowed();
    error PropertyOwnershipNFT__NewOwnerIsZeroAddress();
    error PropertyOwnershipNFT__NotCurrentPropertyOwner(uint256 tokenId, address currentOwner);

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/
    struct Property {
        string propertyId; // external registry / deed ID
        address currentOwner;
        uint256 mintedAt;
        bool exists;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    uint256 private s_nextTokenId;
    mapping(uint256 tokenId => Property) private s_properties;
    mapping(string propertyId => uint256 tokenId) private s_propertyIdToTokenId;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event PropertyMinted(uint256 indexed tokenId, string propertyId, address indexed owner);
    event PropertyTransferred(uint256 indexed tokenId, address indexed previousOwner, address indexed newOwner);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor() ERC721("PropertyOwnershipNFT", "PNFT") Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint a new property NFT after title deed verification.
    /// @param to The verified property owner's address.
    /// @param propertyId Unique identifier from the property registry / title deed.
    /// @param uri Metadata URI (e.g. IPFS link with property details, images, deed hash).
    function mintProperty(address to, string calldata propertyId, string calldata uri) external onlyOwner {
        if (s_propertyIdToTokenId[propertyId] != 0 || _propertyExistsByString(propertyId)) {
            revert PropertyOwnershipNFT__PropertyAlreadyRegistered(propertyId);
        }

        uint256 tokenId = ++s_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        s_properties[tokenId] = Property({propertyId: propertyId, currentOwner: to, mintedAt: block.timestamp, exists: true});
        s_propertyIdToTokenId[propertyId] = tokenId;

        emit PropertyMinted(tokenId, propertyId, to);
    }

    /// @notice Transfer property NFT to new owner when property is sold.
    ///         Can only be called by the contract owner (title authority).
    /// @param tokenId The token representing the property.
    /// @param newOwner The buyer / new verified owner.
    function transferProperty(uint256 tokenId, address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert PropertyOwnershipNFT__NewOwnerIsZeroAddress();
        }

        Property storage prop = s_properties[tokenId];
        if (!prop.exists) {
            revert PropertyOwnershipNFT__PropertyNotRegistered(prop.propertyId);
        }

        address previousOwner = prop.currentOwner;
        prop.currentOwner = newOwner;

        // Internal transfer bypasses the public transfer lock
        _transfer(previousOwner, newOwner, tokenId);

        emit PropertyTransferred(tokenId, previousOwner, newOwner);
    }

    /// @notice Update metadata URI (e.g. after renovation, re-appraisal).
    function updatePropertyURI(uint256 tokenId, string calldata uri) external onlyOwner {
        if (!s_properties[tokenId].exists) {
            revert PropertyOwnershipNFT__PropertyNotRegistered("");
        }
        _setTokenURI(tokenId, uri);
    }

    /*//////////////////////////////////////////////////////////////
                    DISABLE MARKETPLACE TRANSFERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Override to block all transfers except those initiated by the contract itself
    ///      via `transferProperty`. This makes the NFT non-tradeable on marketplaces.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)) and internal admin transfers (msg.sender == address(this) not needed;
        // we rely on the fact that transferProperty calls _transfer directly).
        // Block if it's a non-mint transfer that didn't originate from this contract's onlyOwner functions.
        if (from != address(0) && msg.sender != owner()) {
            revert PropertyOwnershipNFT__TransferNotAllowed();
        }

        return super._update(to, tokenId, auth);
    }

    /// @dev Disable approve — no one should be able to approve marketplace operators.
    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert PropertyOwnershipNFT__TransferNotAllowed();
    }

    /// @dev Disable setApprovalForAll.
    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert PropertyOwnershipNFT__TransferNotAllowed();
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getProperty(uint256 tokenId) external view returns (Property memory) {
        return s_properties[tokenId];
    }

    function getTokenIdByPropertyId(string calldata propertyId) external view returns (uint256) {
        return s_propertyIdToTokenId[propertyId];
    }

    function getNextTokenId() external view returns (uint256) {
        return s_nextTokenId;
    }

    /*//////////////////////////////////////////////////////////////
                       REQUIRED OVERRIDES
    //////////////////////////////////////////////////////////////*/

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /*//////////////////////////////////////////////////////////////
                       INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    function _propertyExistsByString(string memory propertyId) private view returns (bool) {
        uint256 tokenId = s_propertyIdToTokenId[propertyId];
        return s_properties[tokenId].exists;
    }
}
