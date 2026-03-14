// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GoalVault} from "./GoalVault.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IYieldStrategy} from "./interfaces/IYieldStrategy.sol";

contract GoalVaultFactory {
    uint8 public constant GOAL_MODE_MAX_YIELD = 0;
    uint8 public constant GOAL_MODE_PRIZED_YIELD = 1;
    uint8 public constant GOAL_MODE_SELECT_STRATEGY = 2;

    struct GoalInfo {
        address owner;
        address vault;
        string name;
        uint256 targetAmount;
        address strategy;
        uint8 mode;
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
        address strategy,
        uint8 mode
    );
    event GoalModeUpdated(uint256 indexed goalId, address indexed owner, uint8 mode);

    constructor(address asset_) {
        require(asset_ != address(0), "asset=0");
        asset = IERC20(asset_);
    }

    function createGoal(string calldata name, uint256 targetAmount, address strategy, uint8 mode)
        external
        returns (uint256 goalId, address vault)
    {
        require(bytes(name).length > 0, "name empty");
        require(targetAmount > 0, "target=0");
        require(strategy != address(0), "strategy=0");
        require(mode <= GOAL_MODE_SELECT_STRATEGY, "mode invalid");
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
            mode: mode,
            createdAt: block.timestamp
        });
        goalsByOwner[msg.sender].push(goalId);

        emit GoalCreated(goalId, msg.sender, vault, name, targetAmount, strategy, mode);
    }

    function updateGoalMode(uint256 goalId, uint8 mode) external {
        require(mode <= GOAL_MODE_SELECT_STRATEGY, "mode invalid");
        GoalInfo storage goal = goals[goalId];
        require(goal.owner != address(0), "goal missing");
        require(goal.owner == msg.sender, "not owner");

        goal.mode = mode;
        emit GoalModeUpdated(goalId, msg.sender, mode);
    }

    function getGoalsByOwner(address owner) external view returns (uint256[] memory) {
        return goalsByOwner[owner];
    }
}
