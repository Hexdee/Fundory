// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";

contract PrizeSavingsPool {
    IERC20 public immutable asset;
    address public owner;

    uint256 public totalSavings;
    uint256 public prizePot;
    uint256 public round;
    address public lastWinner;
    uint256 public lastPrize;

    mapping(address => uint256) public balances;
    mapping(address => bool) private isEntrant;
    mapping(address => uint256) private entrantIndex;
    address[] private entrants;

    bool private locked;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event PrizeSponsored(address indexed account, uint256 amount);
    event PrizeAwarded(uint256 indexed round, address indexed winner, uint256 amount, uint256 randomSeed);

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

    constructor(address asset_, address owner_) {
        require(asset_ != address(0), "asset=0");
        require(owner_ != address(0), "owner=0");

        asset = IERC20(asset_);
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function getEntrantsCount() external view returns (uint256) {
        return entrants.length;
    }

    function oddsBps(address account) external view returns (uint256) {
        if (totalSavings == 0) return 0;
        return (balances[account] * 10_000) / totalSavings;
    }

    function previewWinner(uint256 randomSeed) external view returns (address) {
        return _pickWinner(randomSeed);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(asset.transferFrom(msg.sender, address(this), amount), "transferFrom fail");

        balances[msg.sender] += amount;
        totalSavings += amount;
        _addEntrant(msg.sender);

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        uint256 balance = balances[msg.sender];
        require(balance >= amount, "insufficient");

        balances[msg.sender] = balance - amount;
        totalSavings -= amount;
        if (balances[msg.sender] == 0) {
            _removeEntrant(msg.sender);
        }

        require(asset.transfer(msg.sender, amount), "transfer fail");
        emit Withdrawn(msg.sender, amount);
    }

    function sponsorPrize(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(asset.transferFrom(msg.sender, address(this), amount), "transferFrom fail");
        prizePot += amount;

        emit PrizeSponsored(msg.sender, amount);
    }

    function awardPrize(uint256 randomSeed) external onlyOwner nonReentrant returns (address winner, uint256 amount) {
        amount = prizePot;
        require(amount > 0, "prize=0");
        winner = _pickWinner(randomSeed);
        require(winner != address(0), "no entrants");

        prizePot = 0;
        round += 1;
        lastWinner = winner;
        lastPrize = amount;

        require(asset.transfer(winner, amount), "transfer fail");
        emit PrizeAwarded(round, winner, amount, randomSeed);
    }

    function _pickWinner(uint256 randomSeed) internal view returns (address) {
        uint256 entrantsLength = entrants.length;
        if (entrantsLength == 0 || totalSavings == 0) {
            return address(0);
        }

        uint256 entropy = uint256(
            keccak256(
                abi.encodePacked(
                    randomSeed,
                    block.prevrandao,
                    block.timestamp,
                    entrantsLength,
                    totalSavings,
                    address(this)
                )
            )
        );

        uint256 target = entropy % totalSavings;
        uint256 cumulative;

        for (uint256 i = 0; i < entrantsLength; i++) {
            address account = entrants[i];
            cumulative += balances[account];
            if (target < cumulative) {
                return account;
            }
        }

        return entrants[entrantsLength - 1];
    }

    function _addEntrant(address account) internal {
        if (isEntrant[account]) return;
        entrantIndex[account] = entrants.length;
        entrants.push(account);
        isEntrant[account] = true;
    }

    function _removeEntrant(address account) internal {
        if (!isEntrant[account]) return;

        uint256 idx = entrantIndex[account];
        uint256 lastIdx = entrants.length - 1;

        if (idx != lastIdx) {
            address lastAccount = entrants[lastIdx];
            entrants[idx] = lastAccount;
            entrantIndex[lastAccount] = idx;
        }

        entrants.pop();
        delete entrantIndex[account];
        isEntrant[account] = false;
    }
}
