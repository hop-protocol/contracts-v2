// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@hop-protocol/ERC5164/contracts/IMessageExecutor.sol";
import "@hop-protocol/ERC5164/contracts/MessageReceiver.sol";
import "../utils/ExecutorLib.sol";
import "../utils/Initializable.sol";

error InvalidCounterpart(address counterpart);
error InvalidBridge(address msgSender);
error InvalidFromChainId(uint256 fromChainId);

abstract contract Alias is MessageReceiver, Initializable {
    using ExecutorLib for address;

    address public baseExecutor;
    uint256 public sourceChain;
    address public sourceDispatcher;

    event ETHReceived(address indexed sender, uint256 amount);

    function initialize(address _baseExecutor, uint256 _sourceChain, address _sourceDispatcher) public initializer {
        require(_baseExecutor != address(0), "ALS: baseExecutor cannot be zero address");
        require(_sourceDispatcher != address(0), "ALS: sourceDispatcher cannot be zero address");
        require(_sourceChain != 0, "ALS: sourceChain cannot be zero");

        baseExecutor = _baseExecutor;
        sourceDispatcher = _sourceDispatcher;
        sourceChain = _sourceChain;
    }

    receive () external payable {
        emit ETHReceived(msg.sender, msg.value);
    }

    function forwardMessage(
        address to,
        uint256 value,
        bytes calldata data
    )
        external
    {
        (, uint256 _fromChainId, address _from) = _crossChainContext();
        require(_fromChainId == sourceChain, "ALS: Invalid _fromChainId");
        require(_from == sourceDispatcher, "ALS: Invalid _from");
        require(address(this).balance >= value, "ALS: Insufficient balance");

        to.execute(data, value);
    }
}
