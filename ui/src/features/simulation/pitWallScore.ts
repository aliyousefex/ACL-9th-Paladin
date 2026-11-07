export interface ScoredOption {
  id: string;
  meanFinish: number;
  podiumRate: number;
}

/** Lower mean finish wins; podium rate is the deterministic tiebreak. */
export function winningOption<T extends ScoredOption>(results: [T, T]): string {
  return [...results].sort((a, b) => a.meanFinish - b.meanFinish || b.podiumRate - a.podiumRate)[0].id;
}
