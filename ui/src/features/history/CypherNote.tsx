import type { CypherBlock } from "../../lib/graph";

/** "{ driverA: 1, driverB: 830 }" with the viewer's current choices filled in. */
export function withParameters(block: CypherBlock, values: Record<string, number>): string {
  if (!block.parameters) return "";
  const entries = Object.entries(values);
  return entries.length > 0 ? `{ ${entries.map(([key, value]) => `${key}: ${value}`).join(", ")} }` : block.parameters;
}

/**
 * The Cypher that asks the same question of the real Milestone 2 graph. The page answers from a static export of the
 * same CSV files, so this is shown for reading, not run here, and the label says so.
 */
export function CypherNote({ blocks, values = {} }: { blocks: CypherBlock[]; values?: Record<string, number> }) {
  return (
    <details className="group mt-6 border border-line bg-tower">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-display text-[1rem] font-semibold tracking-wide uppercase text-steel hover:text-ink">
        The Cypher behind this answer
        <span aria-hidden className="text-mute transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-5 border-t border-line px-4 py-4">
        <p className="text-[0.92rem] text-mute">
          This page answers from a static export of the same CSV files that were loaded into Neo4j, because the website cannot reach a database. The export is checked against independent recomputation, but this query has not been run against a live graph: run it on yours before relying on it.
        </p>
        {blocks.map((block, i) => (
          <div key={i}>
            <p className="text-[0.95rem] text-steel">{block.description}</p>
            {block.parameters && (
              <p className="mt-1 text-[0.85rem] text-mute">
                Parameters: <code className="text-steel">{withParameters(block, values)}</code>
              </p>
            )}
            <pre className="mt-2 overflow-x-auto border border-line bg-paper p-3 text-[0.82rem] leading-relaxed text-steel">
              <code>{block.query}</code>
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}
