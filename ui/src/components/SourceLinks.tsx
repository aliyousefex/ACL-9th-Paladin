const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** "Sources: the-race.com, wikipedia.org", each a full-height target so it can be pressed on a phone. */
export function SourceLinks({ sources, className = "" }: { sources: string[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 text-[0.82rem] text-mute ${className}`}>
      <span>Sources:</span>
      {sources.map((source) => (
        <a key={source} href={source} className="inline-flex min-h-11 items-center underline decoration-line2 underline-offset-2 hover:text-ink" rel="noopener noreferrer">
          {hostOf(source)}
        </a>
      ))}
    </div>
  );
}
