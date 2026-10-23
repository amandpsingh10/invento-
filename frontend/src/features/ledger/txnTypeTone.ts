import type { StockTxnType } from "@/types";

export function txnTypeTone(type: StockTxnType) {
  switch (type) {
    case "PURCHASE":
      return "success" as const;
    case "ISSUE":
      return "warning" as const;
    case "RETURN":
      return "purple" as const;
    case "ADJUSTMENT":
    case "CORRECTION":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}
