// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "@hop-protocol/ERC5164/contracts/MessageExecutor.sol";
import "./VerificationManager.sol";
import "../libraries/Bitmap.sol";

struct BundleProof {
    bytes32 bundleId;
    uint256 treeIndex;
    bytes32[] siblings;
    uint256 totalLeaves;
}

contract Executor is MessageExecutor {
    using BitmapLibrary for Bitmap;

    address public verificationManager;
    mapping(bytes32 => Bitmap) private spentMessagesForBundleId;

    constructor(address _verificationManager) {
        verificationManager = _verificationManager;
    }

    function executeMessage(
        uint256 fromChainId,
        address from,
        address to,
        bytes calldata data,
        BundleProof memory bundleProof
    ) external {
        bytes32 messageId = getMessageId(
            bundleProof.bundleId,
            bundleProof.treeIndex,
            fromChainId,
            from,
            getChainId(),
            to,
            data
        );
        bytes32 bundleRoot = Lib_MerkleTree.processProof(
            messageId,
            bundleProof.treeIndex,
            bundleProof.siblings,
            bundleProof.totalLeaves
        );

        bool isVerified = VerificationManager(verificationManager).isMessageVerified(
            fromChainId,
            bundleProof.bundleId,
            bundleRoot,
            bundleProof.treeIndex,
            messageId,
            to
        );
        if (!isVerified) revert MessageVerificationFailed(verificationManager, fromChainId, bundleProof.bundleId, messageId, to);

        Bitmap storage spentMessages = spentMessagesForBundleId[bundleProof.bundleId];
        spentMessages.switchTrue(bundleProof.treeIndex); // Reverts if already true

        // ToDo: Log BunldeId? treeIndex?
        _execute(messageId, fromChainId, from, to, data);
    }

    function isMessageSpent(bytes32 bundleId, uint256 index) public view returns (bool) {
        Bitmap storage spentMessages = spentMessagesForBundleId[bundleId];
        return spentMessages.isTrue(index);
    }

    // ToDo: Deduplicate
    function getMessageId(
        bytes32 bundleId,
        uint256 treeIndex,
        uint256 fromChainId,
        address from,
        uint256 toChainId,
        address to,
        bytes calldata data
    )
        public
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                bundleId,
                treeIndex,
                fromChainId,
                from,
                toChainId,
                to,
                data
            )
        );
    }

    // ToDo: Deduplicate
    /**
     * @notice getChainId can be overridden by subclasses if needed for compatibility or testing purposes.
     * @dev Get the current chainId
     * @return chainId The current chainId
     */
    function getChainId() public virtual view returns (uint256 chainId) {
        return block.chainid;
    }
}
