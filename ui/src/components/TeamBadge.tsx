import { onColour } from "../lib/data";
import { teamCode } from "../lib/teamMark";
import { teamLogo } from "../lib/teams";

/**
 * A team's tile, the counterpart of a driver's Portrait: the team's colour, with its mark on it (the file listed for it in
 * data/team-logos.json) or, for a team with no free file, its three-letter code. The mark is drawn in one colour, white or black
 * whichever reads on the team's colour, as the code is, so the tiles match. Decorative: the team's name is always written beside
 * it. The size comes from the class (the code is drawn at 2.4em of whatever text size the tile sits in, so it scales with the tile).
 */
export function TeamBadge({ team, colour, className = "" }: { team: { ref: string }; colour: string; className?: string }) {
  const logo = teamLogo(team.ref);
  const ink = onColour(colour);
  return (
    <div
      aria-hidden
      className={`relative isolate grid place-items-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(160deg, ${colour} 0%, color-mix(in srgb, ${colour} 62%, #0a0b0e) 100%)` }}
    >
      {logo ? (
        <img
          src={`${import.meta.env.BASE_URL}teams/${logo.file}`}
          alt=""
          width={logo.width}
          height={logo.height}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain p-[19%]"
          style={{ filter: ink === "#ffffff" ? "brightness(0) invert(1)" : "brightness(0)" }}
        />
      ) : (
        <span className="font-display text-[2.4em] leading-none font-bold tracking-wide" style={{ color: ink }}>
          {teamCode(team.ref)}
        </span>
      )}
    </div>
  );
}
