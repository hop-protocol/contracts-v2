//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../interfaces/ICrossChainSource.sol";
import "../interfaces/ICrossChainDestination.sol";

interface ICrossChain is ICrossChainSource, ICrossChainDestination {}
