/**
 * Who ran each team, as a pure function of the hand-written list in data/team-principals.json (see its `about`). Kept apart from the
 * JSON import so the rules can be tested on any list. A tenure is a person with a title at one team over a run of seasons.
 */

export interface Principal {
  ref: string;
  name: string;
  nationality: string;
  flag: string | null;
}

export interface Tenure {
  constructor: string;
  person: string;
  title: string;
  firstSeason: number;
  lastSeason: number;
  note: string | null;
  sources: string[];
}

export interface PrincipalFile {
  contract: string;
  checked: string;
  about: string;
  people: Principal[];
  tenures: Tenure[];
}

export interface Leadership {
  person: Principal;
  tenure: Tenure;
}

/** The people who led a team in a season, in the order they took over. A mid-season change gives two. */
export function leadersOf(file: PrincipalFile, constructorRef: string, season: number): Leadership[] {
  const people = new Map(file.people.map((p) => [p.ref, p]));
  return file.tenures
    .filter((t) => t.constructor === constructorRef && t.firstSeason <= season && season <= t.lastSeason)
    .sort((a, b) => a.firstSeason - b.firstSeason || a.lastSeason - b.lastSeason)
    .flatMap((tenure) => {
      const person = people.get(tenure.person);
      return person ? [{ person, tenure }] : [];
    });
}

/** The tenures of one person, earliest first: where and when they led a team within the seasons covered. */
export function tenuresOf(file: PrincipalFile, personRef: string): Tenure[] {
  return file.tenures.filter((t) => t.person === personRef).sort((a, b) => a.firstSeason - b.firstSeason);
}

/** "2022", or "2022–2024". */
export function seasonSpan(tenure: Pick<Tenure, "firstSeason" | "lastSeason">): string {
  return tenure.firstSeason === tenure.lastSeason ? String(tenure.firstSeason) : `${tenure.firstSeason}–${tenure.lastSeason}`;
}

/**
 * A title in the sentence it is used in: lower case, because "Team Principal and CEO" is a name only on a card. "team principal" for
 * the usual one, and the exact title otherwise, so a team representative is never called a principal.
 */
export function titleInSentence(title: string): string {
  return title
    .split(" ")
    .map((word) => (word === "CEO" ? word : word.toLowerCase()))
    .join(" ");
}

/** Whether a title is the usual one. Anything else (a team representative, a CEO and principal) is said as it is. */
export function isPlainPrincipal(title: string): boolean {
  return title === "Team Principal";
}

/** Every season of a team's life in the data that nobody is listed for. Empty when the list is complete. */
export function gaps(file: PrincipalFile, teams: { ref: string; years: number[] }[]): string[] {
  const missing: string[] = [];
  for (const team of teams) {
    for (const year of team.years) if (leadersOf(file, team.ref, year).length === 0) missing.push(`${team.ref} ${year}`);
  }
  return missing;
}
