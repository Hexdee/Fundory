export const factoryAbi = [
  {
    type: "function",
    name: "createGoal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "targetAmount", type: "uint256" },
      { name: "strategy", type: "address" },
    ],
    outputs: [
      { name: "goalId", type: "uint256" },
      { name: "vault", type: "address" },
    ],
  },
  {
    type: "function",
    name: "getGoalsByOwner",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "goalIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "goals",
    stateMutability: "view",
    inputs: [{ name: "goalId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "vault", type: "address" },
      { name: "name", type: "string" },
      { name: "targetAmount", type: "uint256" },
      { name: "strategy", type: "address" },
      { name: "createdAt", type: "uint256" },
    ],
  },
] as const;

export const vaultAbi = [
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    type: "function",
    name: "pricePerShareE18",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "price", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "shares",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "sharesMinted", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "sharesBurned", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;
