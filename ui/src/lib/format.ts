export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function num(value: number, digits = 3): string {
  return value.toFixed(digits);
}

export function integer(value: number): string {
  return Math.round(value).toLocaleString("en-GB");
}

export function gap(value: number, digits = 3): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

const FEATURE_LABELS: Record<string, string> = {
  grid_position: "Grid position",
  pit_lane_start: "Pit-lane start",
  front_row: "Front row",
  field_size: "Field size",
  qualifying_position: "Qualifying position",
  qualifying_time_seconds: "Qualifying time",
  qualifying_missing: "Qualifying missing",
  driver_podium_rate_5: "Driver podium rate, previous 5",
  constructor_podium_rate_5: "Constructor podium rate, previous 5",
  driver_races_before: "Starts already done",
  driver_points_before: "Driver points before",
  driver_rank_before: "Driver rank before",
  constructor_points_before: "Constructor points before",
  constructor_rank_before: "Constructor rank before",
  driver_age: "Age",
  round: "Round",
  year: "Year",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}
