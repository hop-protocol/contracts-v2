//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

struct Bitmap {
    mapping(uint256 => bytes32) _bitmap;
}

library BitmapLibrary {
    error AlreadyTrue(uint256 index, uint256 chunkIndex, uint256 bitOffset);
    error AlreadyFalse(uint256 index, uint256 chunkIndex, uint256 bitOffset);

    function isTrue(Bitmap storage bitmap, uint256 index) internal view returns (bool) {
        uint256 chunkIndex = index / 255; // Note: Reserves the MSB.
        uint256 bitOffset = index % 255;
        bytes32 bitmapChunk = bitmap._bitmap[chunkIndex];
        return _isTrue(bitmapChunk, bitOffset);
    }

    function switchTrue(Bitmap storage bitmap, uint256 index) internal {
        uint256 chunkIndex = index / 255; // Note: Reserves the MSB.
        uint256 bitOffset = index % 255;
        bytes32 bitmapChunk = bitmap._bitmap[chunkIndex];
        if (_isTrue(bitmapChunk, bitOffset)) revert AlreadyTrue(index, chunkIndex, bitOffset);
        bitmap._bitmap[chunkIndex] = (bitmapChunk | bytes32(1 << bitOffset));
    }

    /* Private */
    function _isTrue(bytes32 bitmapChunk, uint256 bitOffset) private pure returns (bool) {
        return ((bitmapChunk >> bitOffset) & bytes32(uint256(1))) != bytes32(0);
    }

    function switchFalse(Bitmap storage bitmap, uint256 index) internal {
        uint256 chunkIndex = index / 255; // Note: Reserves the MSB.
        uint256 bitOffset = index % 255;
        bytes32 bitmapChunk = bitmap._bitmap[chunkIndex];
        if (!_isTrue(bitmapChunk, bitOffset)) revert AlreadyFalse(index, chunkIndex, bitOffset);
        bitmap._bitmap[chunkIndex] = (bitmapChunk & ~(bytes32(1 << bitOffset)));
    }

    // ToDo: Remove unused code
    // function _setTrue(Bitmap storage bitmap, uint256 chunkIndex, bytes32 bitmapChunk, uint256 bitOffset) private {
    //     bitmap._bitmap[chunkIndex] = (bitmapChunk | bytes32(1 << bitOffset));
    // }

    // function _calcIndexOffset(Bitmap storage bitmap, uint256 index) private view returns (uint256, uint256, bytes32) {
    //     uint256 chunkIndex = index / 255; // Note: Reserves the MSB.
    //     uint256 bitOffset = index % 255;
    //     bytes32 bitmapChunk = bitmap._bitmap[chunkIndex];
    //     return (chunkIndex, bitOffset, bitmapChunk);
    // }
}