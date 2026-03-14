export const factoryAbi = [
  {
    type: "function",
    name: "createGoal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "targetAmount", type: "uint256" },
      { name: "strategy", type: "address" },
      { name: "mode", type: "uint8" },
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
      { name: "mode", type: "uint8" },
      { name: "createdAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "updateGoalMode",
    stateMutability: "nonpayable",
    inputs: [
      { name: "goalId", type: "uint256" },
      { name: "mode", type: "uint8" },
    ],
    outputs: [],
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
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "decimals", type: "uint8" }],
  },
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

export const bonzoVaultAbi = [
  {
    type: "function",
    name: "allowToken0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowToken1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "decimals", type: "uint8" }],
  },
] as const;

export const bonzoDepositGuardAbi = [
  {
    type: "function",
    name: "depositToICHIVaultAndTryWrapToHTS",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "vaultDeployer", type: "address" },
      { name: "token", type: "address" },
      { name: "erc20Amount", type: "uint256" },
      { name: "minimumProceeds", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "vaultTokens", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawFromICHIVaultAndTryUnwrapToERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "vaultDeployer", type: "address" },
      { name: "shares", type: "uint256" },
      { name: "to", type: "address" },
      { name: "minAmount0", type: "uint256" },
      { name: "minAmount1", type: "uint256" },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
] as const;

export const erc20WrapperAbi = [
  {
    type: "function",
    name: "erc20Counterpart",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const prizeSavingsPoolAbi = [
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "balances",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSavings",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "prizePot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEntrantsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "oddsBps",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "round",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "lastWinner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "lastPrize",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "sponsorPrize",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "awardPrize",
    stateMutability: "nonpayable",
    inputs: [{ name: "randomSeed", type: "uint256" }],
    outputs: [
      { name: "winner", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
] as const;
