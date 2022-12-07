//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

// This library is inspired by the Arbitrum Outbox state management proposed by shotaronowhere (@shotaro)
// https://github.com/OffchainLabs/nitro/blob/1420d00a0906cfd71448d792f19ade01425d079e/contracts/src/bridge/Outbox.sol

struct Bitmap {
    mapping(uint256 => bytes32) _bitmap;
}

library BitmapLibrary {
    error AlreadyTrue(uint256 index, uint256 chunkIndex, uint256 bitOffset);
    error AlreadyFalse(uint256 index, uint256 chunkIndex, uint256 bitOffset);

    function isTrue(Bitmap storage bitmap, uint256 index) internal view returns (bool) {
        uint256 chunkIndex = index / 256;
        uint256 bitOffset = index % 256;
        bytes32 bitmapChunk = bitmap._bitmap[chunkIndex];
        return _isTrue(bitmapChunk, bitOffset);
    }

    function switchTrue(Bitmap storage bitmap, uint256 index) internal {
        uint256 chunkIndex = index / 256;
        uint256 bitOffset = index % 256;
        bytes32 bitmapChunk = bitmap._bitmap[chunkIndex];
        if (_isTrue(bitmapChunk, bitOffset)) revert AlreadyTrue(index, chunkIndex, bitOffset);
        bitmap._bitmap[chunkIndex] = (bitmapChunk | bytes32(1 << bitOffset));
    }

    function switchFalse(Bitmap storage bitmap, uint256 index) internal {
        uint256 chunkIndex = index / 256;
        uint256 bitOffset = index % 256;
        bytes32 bitmapChunk = bitmap._bitmap[chunkIndex];
        if (!_isTrue(bitmapChunk, bitOffset)) revert AlreadyFalse(index, chunkIndex, bitOffset);
        bitmap._bitmap[chunkIndex] = (bitmapChunk & ~bytes32(1 << bitOffset));
    }

    /* Private */
    function _isTrue(bytes32 bitmapChunk, uint256 bitOffset) private pure returns (bool) {
        return ((bitmapChunk >> bitOffset) & bytes32(uint256(1))) != bytes32(0);
    }
}