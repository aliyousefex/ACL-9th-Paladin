import type { LabModel, LabMode } from "./engine";

export interface LabShare { raceId: number; laps: number; seed: number; model: LabModel; mode: LabMode; controlledId: number | null; drivers: number[]; grid: number[] }

export function encodeLabShare(value: LabShare): string {
  const params = new URLSearchParams({ r: String(value.raceId), l: String(value.laps), s: String(value.seed), m: value.model, o: value.mode, d: value.drivers.join("."), g: value.grid.join(".") });
  if (value.controlledId !== null) params.set("c", String(value.controlledId));
  return params.toString();
}

export function decodeLabShare(query: string): Partial<LabShare> {
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  const integer = (key: string) => { const raw = params.get(key); if (raw === null || raw === "") return undefined; const value = Number(raw); return Number.isInteger(value) && value > 0 ? value : undefined; };
  const list = (key: string) => [...new Set((params.get(key) ?? "").split(".").map(Number).filter((value) => Number.isInteger(value) && value > 0))].slice(0, 20);
  const model = params.get("m");
  const mode = params.get("o");
  return {
    raceId: integer("r"), laps: integer("l"), seed: integer("s"), controlledId: integer("c") ?? null,
    model: (["grid", "coursework", "research", "hybrid"].includes(model ?? "") ? model : undefined) as LabModel | undefined,
    mode: (["simulator", "strategist", "battle"].includes(mode ?? "") ? mode : undefined) as LabMode | undefined,
    drivers: list("d"), grid: list("g"),
  };
}
