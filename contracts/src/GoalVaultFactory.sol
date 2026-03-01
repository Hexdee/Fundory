// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GoalVault} from "./GoalVault.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IYieldStrategy} from "./interfaces/IYieldStrategy.sol";

contract GoalVaultFactory {
    struct GoalInfo {
        address owner;
        address vault;
        string name;
        uint256 targetAmount;
        address strategy;
        uint256 createdAt;
    }

    IERC20 public immutable asset;
    uint256 public goalCount;

    mapping(uint256 => GoalInfo) public goals;
    mapping(address => uint256[]) public goalsByOwner;

    event GoalCreated(
        uint256 indexed goalId,
        address indexed owner,
        address vault,
        string name,
        uint256 targetAmount,
        address strategy
    );

    constructor(address asset_) {
        require(asset_ != address(0), "asset=0");
        asset = IERC20(asset_);
    }

    function createGoal(string calldata name, uint256 targetAmount, address strategy)
        external
        returns (uint256 goalId, address vault)
    {
        require(bytes(name).length > 0, "name empty");
        require(targetAmount > 0, "target=0");
        require(strategy != address(0), "strategy=0");
        require(address(IYieldStrategy(strategy).asset()) == address(asset), "strategy asset");

        goalId = ++goalCount;

        GoalVault v = new GoalVault({
            asset_: address(asset),
            strategy_: strategy,
            owner_: msg.sender,
            goalId_: goalId,
            name_: name,
            targetAmount_: targetAmount
        });

        vault = address(v);
        goals[goalId] = GoalInfo({
            owner: msg.sender,
            vault: vault,
            name: name,
            targetAmount: targetAmount,
            strategy: strategy,
            createdAt: block.timestamp
        });
        goalsByOwner[msg.sender].push(goalId);

        emit GoalCreated(goalId, msg.sender, vault, name, targetAmount, strategy);
    }

    function getGoalsByOwner(address owner) external view returns (uint256[] memory) {
        return goalsByOwner[owner];
    }
}
