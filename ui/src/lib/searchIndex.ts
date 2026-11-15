import { DRIVERS, RACES, RACE_CIRCUITS, circuit, raceHref } from "./data";
import type { SearchItem } from "./search";

/** The destinations a viewer might type a name for. */
export const PAGE_ITEMS: SearchItem[] = [
  { id: "page:season", kind: "page", title: "Season calendar", subtitle: "All 68 held-out Grands Prix, 2022 to 2024", to: "/", keywords: "home races standings schedule" },
  { id: "page:analysis", kind: "page", title: "Error Atlas", subtitle: "Where Paladin and the starting grid hit and miss", to: "/analysis", keywords: "analysis errors misses baseline grid failures" },
  { id: "page:league", kind: "page", title: "Season league", subtitle: "Call races blind and compare with Paladin and a friend", to: "/league", keywords: "game challenge beat the model score share code friend card" },
  { id: "page:history", kind: "page", title: "History graph", subtitle: "Teammate chains, driver careers, circuit podiums", to: "/history", keywords: "knowledge graph neo4j teammates connections milestone 2" },
  { id: "page:lab", kind: "page", title: "Race Lab", subtitle: "Simulations and what-if scenarios", to: "/race-lab", keywords: "simulation strategy scenario" },
  { id: "page:model", kind: "page", title: "The model and its limits", subtitle: "Metrics, features, calibration and caveats", to: "/model", keywords: "research logistic regression features calibration roc pr auc" },
  { id: "page:method", kind: "page", title: "Method and data", subtitle: "How the data was cleaned, split and checked", to: "/method", keywords: "walkthrough leakage split reproducibility cleaning" },
  { id: "page:guide", kind: "page", title: "How to read this site", subtitle: "What every marker and value means", to: "/guide", keywords: "legend markers provenance model output historical record simulation illustrative your input source key explain" },
  { id: "page:drivers", kind: "page", title: "Driver archive", subtitle: "Every driver of the held-out seasons", to: "/drivers", keywords: "drivers archive" },
  { id: "page:circuits", kind: "page", title: "Circuit archive", subtitle: "Circuit maps and records", to: "/circuits", keywords: "circuits tracks maps archive" },
];

export function buildIndex(): SearchItem[] {
  const races: SearchItem[] = RACES.map((race) => {
    const track = circuit(race.circuitId);
    return {
      id: `race:${race.id}`,
      kind: "race",
      title: `${race.name} ${race.year}`,
      subtitle: `Round ${race.round} · ${track.name}, ${track.country}`,
      to: raceHref(race),
      keywords: `${track.location} ${track.country} ${race.year}`,
      weight: race.year * 100 + race.round,
    };
  });
  const drivers: SearchItem[] = DRIVERS.map((driver) => ({
    id: `driver:${driver.id}`,
    kind: "driver",
    title: driver.name,
    subtitle: `${driver.nationality} · ${driver.code}`,
    to: `/drivers/${driver.ref}`,
    keywords: `${driver.code} ${driver.ref} ${driver.last}`,
  }));
  const circuits: SearchItem[] = RACE_CIRCUITS.map((track) => ({
    id: `circuit:${track.circuitId}`,
    kind: "circuit",
    title: track.name,
    subtitle: `${track.location}, ${track.country}`,
    to: `/circuits/${track.ref}`,
    keywords: `${track.ref} ${track.location} ${track.country}`,
  }));
  return [...PAGE_ITEMS, ...races, ...drivers, ...circuits];
}

/** Shown before anything is typed: the main destinations and the most recent races. */
export function suggestions(): SearchItem[] {
  const index = buildIndex();
  const latest = [...RACES].slice(-3).reverse().map((race) => index.find((item) => item.id === `race:${race.id}`)!);
  return [...PAGE_ITEMS.filter((item) => ["page:season", "page:analysis", "page:history", "page:model"].includes(item.id)), ...latest];
}
