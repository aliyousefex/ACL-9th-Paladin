/**
 * The mark a team wears on its card. A real logo is a registered trademark and no free source covers every team, so the site
 * draws the same plain tile for all of them: the team's colour and its three-letter timing-screen code. A team's own logo file
 * takes the tile's place when one is listed in data/team-logos.json (see its `about`).
 */

/** The code on the tile, as the timing screens write it. Hand-written because a team's name does not always shorten into it. */
export const TEAM_CODES: Readonly<Record<string, string>> = {
  mclaren: "MCL",
  williams: "WIL",
  ferrari: "FER",
  red_bull: "RBR",
  sauber: "SAU",
  alfa: "ALF",
  aston_martin: "AMR",
  mercedes: "MER",
  haas: "HAA",
  alphatauri: "ATR",
  alpine: "ALP",
  rb: "RB",
};

export interface TeamLogo {
  /** The constructor's `ref`. */
  constructor: string;
  /** File name under public/teams/. */
  file: string;
  width: number;
  height: number;
  /** Where the file came from, who made it and on what terms it may be used: all three are required. */
  source: string;
  author: string;
  licence: string;
}

export interface TeamLogoFile {
  contract: string;
  about: string;
  logos: TeamLogo[];
}

/** The code for a team, or its first three letters in capitals when the table has no entry for it. */
export function teamCode(ref: string): string {
  return TEAM_CODES[ref] ?? ref.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
}

/** The logo file listed for a team, if any. */
export function logoFor(file: TeamLogoFile, ref: string): TeamLogo | undefined {
  return file.logos.find((logo) => logo.constructor === ref);
}
