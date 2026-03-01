// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./IERC20.sol";

interface IYieldStrategy {
    function asset() external view returns (IERC20);
    function aprBps() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount, address to) external;
}
