import site from "../data/site.json";

export type MetricName = "PR-AUC" | "ROC-AUC" | "F1" | "Precision" | "Recall";

export function metricAt(model: string, split: string, metric: MetricName): number {
  const row = site.metrics.find((item) => item.model === model && item.split === split);
  return row ? row[metric] : 0;
}

export function thresholdAt(model: string): number {
  const row = site.metrics.find((item) => item.model === model && item.split === "validation");
  return row?.threshold ?? 0;
}

export function ablationOf(variant: string) {
  return site.ablation.find((row) => row.variant === variant) ?? site.ablation[0];
}
