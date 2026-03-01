import { formatUnits } from "viem";

type FormatInput = bigint | number | null | undefined;

export const formatAmount = (amount: FormatInput, decimals = 6): string => {
  if (amount === null || amount === undefined) return "0.00";

  const numeric =
    typeof amount === "bigint"
      ? Number(formatUnits(amount, decimals))
      : Number(amount);

  if (!Number.isFinite(numeric)) return "0.00";

  const abs = Math.abs(numeric);
  let suffix = "";
  let divisor = 1;

  if (abs >= 1e12) {
    divisor = 1e12;
    suffix = "T";
  } else if (abs >= 1e9) {
    divisor = 1e9;
    suffix = "B";
  } else if (abs >= 1e6) {
    divisor = 1e6;
    suffix = "M";
  } else if (abs >= 1e3) {
    divisor = 1e3;
    suffix = "K";
  }

  const value = numeric / divisor;
  return `${value.toFixed(2)}${suffix}`;
};
