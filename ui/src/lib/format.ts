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
  year: "Year",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

export function ordinal(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

/** 92345 ms -> 1:32.345 */
export function lapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = (ms % 60000) / 1000;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

/** 70.332 s -> 1:10.332 */
export function qualifyingTime(seconds: number): string {
  return lapTime(Math.round(seconds * 1000));
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function signed(value: number, digits = 2): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
}

export const FEATURE_GROUP: Record<string, string> = {
  grid_position: "Grid",
  pit_lane_start: "Grid",
  front_row: "Grid",
  field_size: "Grid",
  qualifying_position: "Qualifying",
  qualifying_time_seconds: "Qualifying",
  qualifying_missing: "Qualifying",
  driver_podium_rate_5: "Form",
  constructor_podium_rate_5: "Form",
  driver_races_before: "Form",
  driver_points_before: "Standings",
  driver_rank_before: "Standings",
  constructor_points_before: "Standings",
  constructor_rank_before: "Standings",
  driver_age: "Context",
  year: "Context",
};
