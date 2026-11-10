export interface SharedDecision {
  lap: number;
  driverId: number;
  seconds: number;
}

export function parseSharedDecision(hash: string): SharedDecision | null {
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  if (!params.has("dl") || !params.has("dd") || !params.has("ds")) return null;
  const value = { lap: Number(params.get("dl")), driverId: Number(params.get("dd")), seconds: Number(params.get("ds")) };
  if (!Number.isInteger(value.lap) || value.lap < 0 || !Number.isInteger(value.driverId) || !Number.isFinite(value.seconds) || Math.abs(value.seconds) > 20) return null;
  return value;
}

export function sharedDecisionHash(route: string, value: SharedDecision): string {
  const params = new URLSearchParams({ dl: String(value.lap), dd: String(value.driverId), ds: String(value.seconds) });
  return `#${route}?${params}`;
}
