// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

uint256 constant ONE_WEEK = 604800;

uint256 constant HUB_CHAIN_ID = 5;
uint256 constant SPOKE_CHAIN_ID_0 = 420;
uint256 constant SPOKE_CHAIN_ID_1 = 84531;

address constant TREASURY = 0x1111000000000000000000000000000000001111;
address constant PUBLIC_GOODS = 0x2222000000000000000000000000000000002222;
address constant ARBITRARY_EOA = 0x3333000000000000000000000000000000003333;
uint256 constant MIN_PUBLIC_GOODS_BPS = 100_000;

// Fee distribution
uint256 constant FULL_POOL_SIZE = 100_000_000_000_000_000; // 0.1
uint256 constant MAX_TRANSPORT_FEE_ABSOLUTE = 50_000_000_000_000_000; // 0.05
uint256 constant MAX_TRANSPORT_FEE_BPS = 30_000; // 300%
uint256 constant EXIT_TIME = 60; // 1 min for testnet

// Fee collection
uint256 constant MAX_BUNDLE_MESSAGES = 32;
uint256 constant MESSAGE_FEE = 7_000_000_000_000;
uint256 constant TRANSPORT_FEE = 7_000_000_000_000_000; // 0.007
uint256 constant RELAY_WINDOW = 12 * 3600; // 12 hours

// Message
uint256 constant DEFAULT_RESULT = 1234;
bytes32 constant DEFAULT_COMMITMENT = 0x1234500000000000000000000000000000000000000000000000000000012345;
uint256 constant DEFAULT_FROM_CHAIN_ID = SPOKE_CHAIN_ID_0;
uint256 constant DEFAULT_TO_CHAIN_ID = HUB_CHAIN_ID;