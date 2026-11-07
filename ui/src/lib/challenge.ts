export interface ChallengePick {
  ids: number[];
  submittedAt: string;
}

export const challengeKey = (raceId: number) => `paladin:pick:${raceId}`;

/**
 * A stored pick is trusted only if it is exactly three distinct whole-number driver ids. Anything else
 * (an old format, a hand-edited value) is treated as no pick rather than scored.
 */
export function parsePick(value: string | null): ChallengePick | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ChallengePick> | null;
    const ids = parsed?.ids;
    if (!Array.isArray(ids) || ids.length !== 3 || !ids.every((id) => Number.isInteger(id)) || new Set(ids).size !== 3) return null;
    return { ids, submittedAt: typeof parsed?.submittedAt === "string" ? parsed.submittedAt : "" };
  } catch {
    return null;
  }
}

/**
 * Challenge scoring, stated once. A pick is three drivers; each one that finished on the podium scores a point,
 * whatever the order. This is the question the model was trained on (does this driver finish in the top three?),
 * so a person and Paladin are scored the same way. Finishing order is deliberately not scored.
 */
export function scoreChallenge(picked: readonly number[], actualPodium: readonly number[]): number {
  return [...new Set(picked)].filter((id) => actualPodium.includes(id)).length;
}

export function readChallenge(raceId: number): ChallengePick | null {
  try {
    return parsePick(localStorage.getItem(challengeKey(raceId)));
  } catch {
    return null;
  }
}

export function saveChallenge(raceId: number, pick: ChallengePick): boolean {
  try {
    localStorage.setItem(challengeKey(raceId), JSON.stringify(pick));
    window.dispatchEvent(new CustomEvent("paladin:challenge"));
    return true;
  } catch {
    return false;
  }
}

export function removeChallenge(raceId: number): void {
  try {
    localStorage.removeItem(challengeKey(raceId));
    window.dispatchEvent(new CustomEvent("paladin:challenge"));
  } catch { /* memory state still resets */ }
}

export function readBookmarks(): number[] {
  try {
    return JSON.parse(localStorage.getItem("paladin:bookmarked-races") ?? "[]") as number[];
  } catch {
    return [];
  }
}

export function toggleBookmark(raceId: number): number[] {
  const current = readBookmarks();
  const next = current.includes(raceId) ? current.filter((id) => id !== raceId) : [...current, raceId];
  try { localStorage.setItem("paladin:bookmarked-races", JSON.stringify(next)); } catch { /* keep current visit usable */ }
  return next;
}

/**
 * The "Surprise me" rule, stated once: every race is equally likely and the pick never looks at results.
 * `random` is injectable so the rule can be tested.
 */
export function pickUniform<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)));
  return items[index];
}
