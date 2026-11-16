import logosJson from "../data/team-logos.json";
import principalsJson from "../data/team-principals.json";
import { CONSTRUCTORS, SEASONS, constructor as teamOf, type Constructor } from "./data";
import { gaps, leadersOf, tenuresOf, type Leadership, type PrincipalFile, type Tenure } from "./teamLogic";
import { logoFor, type TeamLogo, type TeamLogoFile } from "./teamMark";

/** The logo files listed for teams, none by default (see the `about` in the file). */
export const LOGOS = logosJson as unknown as TeamLogoFile;
export const teamLogo = (ref: string): TeamLogo | undefined => logoFor(LOGOS, ref);

/** The hand-written list of who ran each team (see the `about` in the file). Not part of the race dataset. */
export const PRINCIPALS = principalsJson as unknown as PrincipalFile;

export type { Leadership, Tenure };

export const leaders = (constructorRef: string, season: number): Leadership[] => leadersOf(PRINCIPALS, constructorRef, season);
export const tenuresOfPerson = (personRef: string): Tenure[] => tenuresOf(PRINCIPALS, personRef);

/** The teams in the data, most recent first and then by name, the way the team list shows them. */
export const TEAMS: Constructor[] = [...CONSTRUCTORS].sort((a, b) => Math.max(...b.years) - Math.max(...a.years) || a.name.localeCompare(b.name));

export const teamByReference = (ref: string): Constructor | undefined => CONSTRUCTORS.find((c) => c.ref === ref);

/** Teams with no listed leader in some season they raced: empty when the list is complete. */
export const unlistedSeasons = (): string[] => gaps(PRINCIPALS, CONSTRUCTORS);

export { SEASONS, teamOf };

/** The Constructor each tenure belongs to, or undefined if the reference does not match one in the data. */
export const teamOfTenure = (tenure: Tenure): Constructor | undefined => teamByReference(tenure.constructor);
