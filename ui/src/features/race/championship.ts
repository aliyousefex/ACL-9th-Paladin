export interface ChampionshipStanding {
  id: number;
  points: number;
  originalRank: number;
}

export interface AlternateStanding extends ChampionshipStanding {
  rank: number;
  pointsDelta: number;
  rankDelta: number;
}

/** Reassigns the two drivers' recorded race points without changing the season's points pool. */
export function swapChampionshipPoints(
  standings: ChampionshipStanding[],
  challengerId: number,
  occupantId: number,
  challengerRacePoints: number,
  occupantRacePoints: number,
): AlternateStanding[] {
  const adjusted = standings
    .map((standing) => {
      const pointsDelta =
        standing.id === challengerId
          ? occupantRacePoints - challengerRacePoints
          : standing.id === occupantId
            ? challengerRacePoints - occupantRacePoints
            : 0;
      return { ...standing, points: standing.points + pointsDelta, pointsDelta };
    })
    .sort((a, b) => b.points - a.points || a.originalRank - b.originalRank);

  return adjusted.map((standing, index) => ({
    ...standing,
    rank: index + 1,
    rankDelta: standing.originalRank - (index + 1),
  }));
}
