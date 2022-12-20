// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/crosschain/optimism/LibOptimism.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Connector.sol";
import "./interfaces/optimism/messengers/iOVM_L1CrossDomainMessenger.sol";

contract L1OptimismConnector is Connector, Ownable {
    address public l1CrossDomainMessenger;
    uint256 public defaultL2GasLimit;
    mapping (bytes4 => uint256) public l2GasLimitForSignature;

    constructor(
        address target,
        address _l1CrossDomainMessenger
    )
        Connector(target) 
    {
        l1CrossDomainMessenger = _l1CrossDomainMessenger;
    }

    function setL2GasLimitForSignature(uint256 _l2GasLimit, bytes4 signature) external onlyOwner {
        l2GasLimitForSignature[signature] = _l2GasLimit;
    }

    // Internal functions

    function _forwardCrossDomainMessage() internal override {
        uint256 l2GasLimit = _l2GasLimitForCalldata(msg.data);

        iOVM_L1CrossDomainMessenger(l1CrossDomainMessenger).sendMessage(
            counterpart,
            msg.data,
            uint32(l2GasLimit)
        );
    }

    function _verifyCrossDomainSender() internal override view {
        address crossChainSender = LibOptimism.crossChainSender(l1CrossDomainMessenger);
        if (crossChainSender != counterpart) revert NotCounterpart();
    }

    // Private functions

    function _l2GasLimitForCalldata(bytes memory _calldata) private view returns (uint256) {
        uint256 l2GasLimit;

        if (_calldata.length >= 4) {
            bytes4 functionSignature = bytes4(_toUint32(_calldata, 0));
            l2GasLimit = l2GasLimitForSignature[functionSignature];
        }

        if (l2GasLimit == 0) {
            l2GasLimit = defaultL2GasLimit;
        }

        return l2GasLimit;
    }

    // source: https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol
    function _toUint32(bytes memory _bytes, uint256 _start) private pure returns (uint32) {
        require(_bytes.length >= _start + 4, "OVM_MSG_WPR: out of bounds");
        uint32 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x4), _start))
        }

        return tempUint;
    }
}
