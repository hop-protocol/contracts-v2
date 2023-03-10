// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/MerkleProof.sol";
import "../../libraries/token/ERC721/ERC721CrossChain.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";

contract ERC721CrossChainMerkleDrop is ERC721CrossChain, Ownable {
    using BitMaps for BitMaps.BitMap;

    bytes32 public immutable merkleRoot;
    BitMaps.BitMap private claimed;

    event MerkleRootSet(bytes32 merkleRoot);
    event Claimed(address indexed claimant, uint256 serialNumber);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _supportedChainIds,
        address _messengerAddress,
        bytes32 _merkleRoot
    )
        ERC721CrossChain(
            _name,
            _symbol,
            _supportedChainIds,
            _messengerAddress
        )
    {
        merkleRoot = _merkleRoot;
        emit MerkleRootSet(merkleRoot);
    }

    function mintToken(uint256 serialNumber, bytes32[] calldata merkleProof) external {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, serialNumber));
        (bool valid, uint256 index) = MerkleProof.verify(merkleProof, merkleRoot, leaf);
        require(valid, "ERC721CrossChainMerkleDrop: Valid proof required.");
        require(!isClaimed(index), "ERC721CrossChainMerkleDrop: Token already claimed.");
        
        claimed.set(index);
        emit Claimed(msg.sender, serialNumber);

        _mintWrapperAndConfirm(serialNumber, 0);
    }

    /**
     * @dev Returns true if the claim at the given index in the merkle tree has already been made.
     * @param index The index into the merkle tree.
     */
    function isClaimed(uint256 index) public view returns (bool) {
        return claimed.get(index);
    }

    function setTargetAddressesByChainId(uint256[] memory chainIds, address[] memory targetAddresses) public onlyOwner {
        require(chainIds.length == targetAddresses.length, "ERC721CrossChainMerkleDrop: Length must match");
        for (uint256 i = 0; i < chainIds.length; i++) {
            _setCrossChain721AddressByChainId(chainIds[i], targetAddresses[i]);
        }
    }
}
