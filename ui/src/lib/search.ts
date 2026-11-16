/**
 * Search over races, drivers, circuits and pages. Pure functions, so the ranking is tested without a browser.
 * Matching ignores case and accents ("sao paulo" finds "São Paulo"), needs every typed word to match somewhere, and
 * ranks a title that starts with the query above one that merely contains it.
 */

export type SearchKind = "page" | "race" | "driver" | "team" | "leader" | "circuit";

export interface SearchItem {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  /** Hash route to open, such as "/race/2024/monaco". */
  to: string;
  /** Extra words that should find this item but are not shown (a driver's code, a circuit's country). */
  keywords: string;
  /** Breaks ties between equally good matches, higher first. Races use their date, so the newest edition leads. */
  weight?: number;
}

/** Lower-case, accent-free text for matching. */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/gi, "o")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const KIND_ORDER: Record<SearchKind, number> = { page: 0, race: 1, driver: 2, team: 3, leader: 4, circuit: 5 };

interface Prepared {
  item: SearchItem;
  title: string;
  words: string[];
  all: string;
}

export function prepare(items: readonly SearchItem[]): Prepared[] {
  return items.map((item) => {
    const title = normalise(item.title);
    return { item, title, words: title.split(" "), all: normalise(`${item.title} ${item.subtitle} ${item.keywords}`) };
  });
}

function score(entry: Prepared, query: string, tokens: string[]): number {
  if (!tokens.every((token) => entry.all.includes(token))) return -1;
  if (entry.title === query) return 100;
  if (entry.title.startsWith(query)) return 80;
  if (tokens.every((token) => entry.words.some((word) => word.startsWith(token)))) return 60;
  if (entry.title.includes(query)) return 50;
  if (tokens.every((token) => entry.title.includes(token))) return 40;
  return 20;
}

/** The best matches first. An empty query returns `fallback` (the suggestions shown before typing). */
export function search(prepared: readonly Prepared[], text: string, limit = 12, fallback: readonly SearchItem[] = []): SearchItem[] {
  const query = normalise(text);
  if (!query) return fallback.slice(0, limit);
  const tokens = query.split(" ");
  return prepared
    .map((entry) => ({ entry, value: score(entry, query, tokens) }))
    .filter(({ value }) => value >= 0)
    .sort((a, b) => b.value - a.value || KIND_ORDER[a.entry.item.kind] - KIND_ORDER[b.entry.item.kind] || (b.entry.item.weight ?? 0) - (a.entry.item.weight ?? 0) || a.entry.item.title.localeCompare(b.entry.item.title) || a.entry.item.id.localeCompare(b.entry.item.id))
    .slice(0, limit)
    .map(({ entry }) => entry.item);
}
