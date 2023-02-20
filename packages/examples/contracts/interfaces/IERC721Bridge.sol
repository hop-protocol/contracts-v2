// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IERC721Bridge {
    event Sent(
        address indexed recipient,
        uint256 indexed tokenId,
        uint256 indexed toChainId
    );
    event Minted(
        address indexed recipient,
        uint256 indexed tokenId
    );
    // TODO: should from chainId be added?
    event Confirmed(
        address indexed recipient,
        uint256 indexed tokenId
    );

}
