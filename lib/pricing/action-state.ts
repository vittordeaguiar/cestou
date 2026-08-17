export type PriceEstimateActionState = {
  status: "idle" | "success" | "partial" | "error" | "rate_limited";
  message?: string;
  estimatedTotal?: number;
  itemsProcessed?: number;
  itemsNotFound?: number;
  itemsFailed?: number;
};

export const initialPriceEstimateActionState: PriceEstimateActionState = {
  status: "idle",
};
