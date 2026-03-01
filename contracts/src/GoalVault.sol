// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {IYieldStrategy} from "./interfaces/IYieldStrategy.sol";

contract GoalVault {
    IERC20 public immutable asset;
    IYieldStrategy public immutable strategy;
    address public immutable owner;
    uint256 public immutable goalId;
    string public goalName;
    uint256 public targetAmount;

    uint256 public totalShares;
    mapping(address => uint256) public shares;

    bool private locked;

    event Deposited(address indexed from, address indexed beneficiary, uint256 amount, uint256 sharesMinted);
    event Withdrawn(address indexed to, uint256 amount, uint256 sharesBurned);
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "reentrancy");
        locked = true;
        _;
        locked = false;
    }

    constructor(
        address asset_,
        address strategy_,
        address owner_,
        uint256 goalId_,
        string memory name_,
        uint256 targetAmount_
    ) {
        require(asset_ != address(0), "asset=0");
        require(strategy_ != address(0), "strategy=0");
        require(owner_ != address(0), "owner=0");
        require(bytes(name_).length > 0, "name empty");
        require(targetAmount_ > 0, "target=0");

        asset = IERC20(asset_);
        strategy = IYieldStrategy(strategy_);
        owner = owner_;
        goalId = goalId_;
        goalName = name_;
        targetAmount = targetAmount_;
        require(address(strategy.asset()) == asset_, "strategy asset");
        require(asset.approve(strategy_, type(uint256).max), "approve fail");
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant returns (uint256 mintedShares) {
        mintedShares = _deposit(msg.sender, owner, amount);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant returns (uint256 burnedShares) {
        require(amount > 0, "amount=0");

        uint256 assets = _totalAssets();
        require(assets > 0, "empty");
        require(totalShares > 0, "no shares");

        burnedShares = _previewWithdraw(amount, assets);
        require(shares[msg.sender] >= burnedShares, "insufficient shares");

        shares[msg.sender] -= burnedShares;
        totalShares -= burnedShares;

        _pullFromStrategy(amount);
        require(asset.transfer(msg.sender, amount), "transfer fail");
        emit Withdrawn(msg.sender, amount, burnedShares);
    }

    function totalAssets() external view returns (uint256) {
        return _totalAssets();
    }

    function pricePerShareE18() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        uint256 assets = _totalAssets();
        return (assets * 1e18) / totalShares;
    }

    function previewDeposit(uint256 amount) external view returns (uint256) {
        return _previewDeposit(amount, _totalAssets());
    }

    function previewWithdraw(uint256 amount) external view returns (uint256) {
        return _previewWithdraw(amount, _totalAssets());
    }

    function _deposit(address from, address beneficiary, uint256 amount) internal returns (uint256 mintedShares) {
        require(amount > 0, "amount=0");

        uint256 assets = _totalAssets();
        mintedShares = _previewDeposit(amount, assets);
        require(mintedShares > 0, "zero shares");

        require(asset.transferFrom(from, address(this), amount), "transferFrom fail");
        _deployToStrategy(amount);
        shares[beneficiary] += mintedShares;
        totalShares += mintedShares;

        emit Deposited(from, beneficiary, amount, mintedShares);
    }

    function _previewDeposit(uint256 amount, uint256 assets) internal view returns (uint256) {
        if (totalShares == 0) return amount;
        if (assets == 0) return 0;
        return (amount * totalShares) / assets;
    }

    function _previewWithdraw(uint256 amount, uint256 assets) internal view returns (uint256) {
        if (totalShares == 0 || assets == 0) return 0;
        return _mulDivUp(amount, totalShares, assets);
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        uint256 z = x * y;
        if (z == 0) return 0;
        return (z - 1) / d + 1;
    }

    function _totalAssets() internal view returns (uint256) {
        return asset.balanceOf(address(this)) + strategy.balanceOf(address(this));
    }

    function _deployToStrategy(uint256 amount) internal {
        if (amount == 0) return;
        strategy.deposit(amount);
    }

    function _pullFromStrategy(uint256 amount) internal {
        uint256 vaultBalance = asset.balanceOf(address(this));
        if (vaultBalance >= amount) return;
        uint256 needed = amount - vaultBalance;
        strategy.withdraw(needed, address(this));
    }
}
