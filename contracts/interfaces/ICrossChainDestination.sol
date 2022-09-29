//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

interface ICrossChainDestination {

    // ToDo: including the message `data` in these event costs +1,576 gas. Worth it?
    event MessageRelayed(
        bytes32 messageId,
        uint256 fromChainId,
        address indexed from,
        address indexed to
    );

    event MessageReverted(
        bytes32 messageId,
        uint256 fromChainId,
        address indexed from,
        address indexed to
    );

    function getXDomainSender() external view returns (address);
    function getXDomainChainId() external view returns (uint256);
}
