// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {IYieldStrategy} from "./interfaces/IYieldStrategy.sol";

interface IMintableERC20 {
    function mint(address to, uint256 amount) external;
}

contract MockYieldStrategy is IYieldStrategy {
    struct Position {
        uint256 principal;
        uint256 lastAccrual;
    }

    IERC20 public immutable override asset;
    uint256 public immutable override aprBps;

    mapping(address => Position) private positions;

    event Deposited(address indexed vault, uint256 amount);
    event Withdrawn(address indexed vault, address indexed to, uint256 amount);
    event YieldAccrued(address indexed vault, uint256 interest, uint256 newPrincipal);

    constructor(address asset_, uint256 aprBps_) {
        require(asset_ != address(0), "asset=0");
        require(aprBps_ > 0, "apr=0");
        asset = IERC20(asset_);
        aprBps = aprBps_;
    }

    function balanceOf(address account) external view override returns (uint256) {
        Position memory position = positions[account];
        if (position.principal == 0 || position.lastAccrual == 0) return position.principal;
        uint256 elapsed = block.timestamp - position.lastAccrual;
        uint256 interest = _calculateInterest(position.principal, elapsed);
        return position.principal + interest;
    }

    function deposit(uint256 amount) external override {
        require(amount > 0, "amount=0");
        _accrue(msg.sender);
        positions[msg.sender].principal += amount;
        require(asset.transferFrom(msg.sender, address(this), amount), "transferFrom fail");
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount, address to) external override {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        require(position.principal >= amount, "insufficient");
        position.principal -= amount;
        require(asset.transfer(to, amount), "transfer fail");
        emit Withdrawn(msg.sender, to, amount);
    }

    function principalOf(address account) external view returns (uint256) {
        return positions[account].principal;
    }

    function lastAccrual(address account) external view returns (uint256) {
        return positions[account].lastAccrual;
    }

    function _accrue(address account) internal {
        Position storage position = positions[account];
        uint256 last = position.lastAccrual;
        uint256 nowTs = block.timestamp;
        if (last == 0) {
            position.lastAccrual = nowTs;
            return;
        }
        if (position.principal == 0) {
            position.lastAccrual = nowTs;
            return;
        }
        uint256 elapsed = nowTs - last;
        if (elapsed == 0) return;
        uint256 interest = _calculateInterest(position.principal, elapsed);
        if (interest > 0) {
            position.principal += interest;
            IMintableERC20(address(asset)).mint(address(this), interest);
            emit YieldAccrued(account, interest, position.principal);
        }
        position.lastAccrual = nowTs;
    }

    function _calculateInterest(uint256 principal, uint256 elapsed) internal view returns (uint256) {
        return (principal * aprBps * elapsed) / (365 days * 10000);
    }
}
