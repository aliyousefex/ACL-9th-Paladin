import type { CSSProperties } from "react";

export function StartLights({
  lit,
  pace = false,
  className = "h-8 w-3",
}: {
  lit: number;
  pace?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 ${pace ? "" : "lamp-driven"}`} aria-hidden>
      {Array.from({ length: 5 }, (_, lamp) => {
        const on = pace || lamp < lit;
        return (
          <span
            key={lamp}
            className={`lamp ${className} ${on ? "is-on" : ""}`}
            style={{ "--i": lamp } as CSSProperties}
          />
        );
      })}
    </div>
  );
}
