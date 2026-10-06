// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Fixed supply token with a permanent SHA-256 project manifest commitment.
/// @dev No owner, further minting, pause, tax, upgrade, sale, escrow, or liquidity functions.
contract GenesisToken is ERC20 {
    bytes32 public immutable genesisHash;

    constructor(string memory name_, string memory symbol_, uint256 supply_, bytes32 genesisHash_)
        ERC20(name_, symbol_)
    {
        require(bytes(name_).length > 0 && bytes(name_).length <= 64, "Invalid name");
        require(bytes(symbol_).length > 0 && bytes(symbol_).length <= 12, "Invalid symbol");
        require(supply_ > 0 && supply_ <= 1e30, "Invalid supply");
        require(genesisHash_ != bytes32(0), "Missing genesis");
        genesisHash = genesisHash_;
        _mint(msg.sender, supply_);
    }
}
