import { href } from "../lib/router";

/** Shown when a link names a driver or circuit that is not in the data. */
export function Missing({ kind, reference, backTo }: { kind: string; reference: string; backTo: string }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pt-32 pb-10">
      <p className="eyebrow">{kind} not found</p>
      <h1 className="display mt-3 text-[3rem]">Nothing called “{reference}”</h1>
      <p className="mt-4 text-steel">That {kind.toLowerCase()} is not part of the 2022–2024 data this site covers.</p>
      <a className="btn mt-6" href={href(backTo)}>
        Browse all
      </a>
    </div>
  );
}
