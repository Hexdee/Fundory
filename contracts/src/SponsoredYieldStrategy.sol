// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {IYieldStrategy} from "./interfaces/IYieldStrategy.sol";

/// @notice Non-minting yield strategy. Yield is funded by a sponsor (manager)
/// and accrued over time using aprBps. Safe for real ERC20 assets (testnet/mainnet).
contract SponsoredYieldStrategy is IYieldStrategy {
    struct Position {
        uint256 principal;
        uint256 accrued;
        uint256 lastAccrual;
    }

    IERC20 public immutable override asset;
    uint256 public immutable override aprBps;
    address public immutable manager;

    uint256 public totalPrincipal;
    uint256 public totalAccrued;

    mapping(address => Position) private positions;

    event Deposited(address indexed vault, uint256 amount);
    event Withdrawn(address indexed vault, address indexed to, uint256 amount);
    event YieldAccrued(address indexed vault, uint256 interest, uint256 accruedTotal);
    event YieldSponsored(address indexed sponsor, uint256 amount);

    constructor(address asset_, uint256 aprBps_, address manager_) {
        require(asset_ != address(0), "asset=0");
        require(aprBps_ > 0, "apr=0");
        require(manager_ != address(0), "manager=0");
        asset = IERC20(asset_);
        aprBps = aprBps_;
        manager = manager_;
    }

    function balanceOf(address account) external view override returns (uint256) {
        Position memory p = positions[account];
        if (p.lastAccrual == 0 || p.principal == 0) {
            return p.principal + p.accrued;
        }

        uint256 elapsed = block.timestamp - p.lastAccrual;
        uint256 pending = _calculateInterest(p.principal, elapsed);
        if (pending == 0) return p.principal + p.accrued;

        uint256 surplus = _availableSurplus();
        if (pending > surplus) pending = surplus;
        return p.principal + p.accrued + pending;
    }

    function deposit(uint256 amount) external override {
        require(amount > 0, "amount=0");
        _accrue(msg.sender);

        positions[msg.sender].principal += amount;
        totalPrincipal += amount;

        require(asset.transferFrom(msg.sender, address(this), amount), "transferFrom fail");
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount, address to) external override {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        _accrue(msg.sender);

        Position storage p = positions[msg.sender];
        uint256 available = p.principal + p.accrued;
        require(available >= amount, "insufficient");

        uint256 fromAccrued = amount <= p.accrued ? amount : p.accrued;
        if (fromAccrued > 0) {
            p.accrued -= fromAccrued;
            totalAccrued -= fromAccrued;
        }

        uint256 fromPrincipal = amount - fromAccrued;
        if (fromPrincipal > 0) {
            p.principal -= fromPrincipal;
            totalPrincipal -= fromPrincipal;
        }

        require(asset.transfer(to, amount), "transfer fail");
        emit Withdrawn(msg.sender, to, amount);
    }

    function sponsorYield(uint256 amount) external {
        require(msg.sender == manager, "only manager");
        require(amount > 0, "amount=0");
        require(asset.transferFrom(msg.sender, address(this), amount), "transferFrom fail");
        emit YieldSponsored(msg.sender, amount);
    }

    function principalOf(address account) external view returns (uint256) {
        return positions[account].principal;
    }

    function accruedOf(address account) external view returns (uint256) {
        return positions[account].accrued;
    }

    function _accrue(address account) internal {
        Position storage p = positions[account];
        uint256 nowTs = block.timestamp;
        uint256 last = p.lastAccrual;

        if (last == 0) {
            p.lastAccrual = nowTs;
            return;
        }
        if (p.principal == 0) {
            p.lastAccrual = nowTs;
            return;
        }

        uint256 elapsed = nowTs - last;
        if (elapsed == 0) return;

        uint256 rawInterest = _calculateInterest(p.principal, elapsed);
        if (rawInterest > 0) {
            uint256 surplus = _availableSurplus();
            uint256 interest = rawInterest > surplus ? surplus : rawInterest;
            if (interest > 0) {
                p.accrued += interest;
                totalAccrued += interest;
                emit YieldAccrued(account, interest, p.accrued);
            }
        }

        p.lastAccrual = nowTs;
    }

    function _availableSurplus() internal view returns (uint256) {
        uint256 backing = totalPrincipal + totalAccrued;
        uint256 bal = asset.balanceOf(address(this));
        if (bal <= backing) return 0;
        return bal - backing;
    }

    function _calculateInterest(uint256 principal, uint256 elapsed) internal view returns (uint256) {
        return (principal * aprBps * elapsed) / (365 days * 10000);
    }
}

