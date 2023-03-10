// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MessengerMock is Ownable {

    address public target;
    address public counterpart;
    bytes public pendingMessage;
    uint256 public immutable chainId;

    constructor(uint256 _chainId) {
        chainId = _chainId;
    }

    fallback () external payable {
        // Cross-chain verification done on the target contracts
        (bool success, bytes memory res) = payable(target).call{value: msg.value}(msg.data);
        if (!success) {
            // Bubble up error message
            assembly { revert(add(res,0x20), res) }
        }
    }

    function dispatchMessage(
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        external
        payable
        returns (bytes32 messageId)
    {
        // toChainId and to are ignored for the mock. The rest of the data is mocked.
        bytes32 messageId = keccak256(abi.encodePacked(msg.sender, block.number, block.timestamp));
        uint256 fromChainId = getChainId();
        address from = msg.sender;

        pendingMessage = abi.encodePacked(data, messageId, fromChainId, from);
    }

    function executePendingMessage() public {
        counterpart.call(pendingMessage);
    }

    function setCounterpart(address _counterpart) external onlyOwner {
        counterpart = _counterpart;
    }

    function setTarget(address _target) external onlyOwner {
        target = _target;
    }

    function getChainId() public view virtual returns (uint256) {
        return chainId;
    }
}
