# ERC-5164: Cross-Chain Execution

[`ERC-5164`](https://eips.ethereum.org/EIPS/eip-5164) defines an interface that supports execution across EVM networks. This repo contains the `IMessageDispatcher` and `IMessageExecutor` interfaces for use with `ERC-5164` compliant messengers. This repo also provides two convenience contracts that can be extended, `MessageExecutor` and `MessageReceiver`.

## Implementing ERC-5164

### Dispatch a message

Your `MessageDispatcher` should inherit from `IMessageDispatcher` and implement the `dispatchMessage` function. When `dispatchMessage` is called, it's recommended to encode the message and transport it to its destination. Transporting a message may involve emiting a special event, storing a hash of the message, or passing it to external transport layer like a rollup's native message bridge.

__Example:__
```solidity
contract MyMessageDispatcher is IMessageDispatcher {
    function dispatchMessage(uint256 toChainId, address to, bytes calldata data) external payable returns (bytes32) {
        bytes32 messageId = keccak256(abi.encode(
            block.chainid,
            msg.sender,
            toChainId,
            to,
            data
        ));

        emit MessageSent(messageId, msg.sender, toChainId, to, data);

        transportLayer.transport(toChainId, messageId);

        return messageId;
    }
}
```

### Execute a message

Your `MessageExecutor` should inherit from `IMessageExecutor`. Each implementation may choose how the message execution is initiated. When a messsage is executed, the `ERC-5164` validation data (`messageId`, `fromChainId`, `from`) should be appended to the message's `data` payload. The provided `MessageExecutor` convenience contract does this automatically when you call `execute`.

__Example:__
```solidity
contract MyMessageExecutor is MessageExecutor {
    function executeMessage(
        uint256 fromChainId,
        address from,
        address to,
        bytes calldata data,
        Proof memory proof
    ) external {
        require(proof.isValid, "Invalid proof");

        bytes32 messageId = keccak256(abi.encode(
            fromChainId,
            msg.sender,
            block.chainid,
            to,
            data
        ));

        _execute(messageId, fromChainId, from, to, data);
    }
}
```

### Receive a message

When receiving a message, inherit from [`MessageReceiver`](https://github.com/hop-protocol/contracts-v2/blob/master/packages/messenger/contracts/erc5164/MessageReceiver.sol) to access the `EIP-5164` validation data -- `messageId`, `from`, and `fromChainId`.

__Example:__
```solidity
contract MyContract is MessageReceiver {
    event MyMessageHandleEvent {
        bytes32 indexed messageId /*,
        ... your event params*/
    }

    function myFunction() external {
        // Parse the cross-chain context from the call
        (bytes32 messageId, address from, uint256 fromChainId) = _crossChainContext();

        // Validate the cross-chain caller
        require(msg.sender == hopMessageBridge, "Invalid sender");
        require(from == expectedCrossChainSender, "Invalid cross-chain sender");
        require(fromChainId == expectedCrossChainId, "Invalid cross-chain chainId");

        // Execute your business logic
        emit MyMessageHandleEvent(messageId, /* your event params */);
    }
}
```

## Usage

### Compile Contracts
```shell
npm run compile
```
