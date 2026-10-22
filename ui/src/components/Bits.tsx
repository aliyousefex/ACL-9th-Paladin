import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { THRESHOLD } from "../lib/model";

/* ------------------------------------------------------------------ loading */

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

/** Five start lights that light in sequence: the loading state of the whole product. */
export function LightsLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16" role="status" aria-live="polite">
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-6 w-6 rounded-full bg-line"
            style={{ animation: "lights-load 1.5s infinite", animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
      <p className="label">{label}</p>
      <style>{`@keyframes lights-load{0%,10%{background:#262b33;box-shadow:none}30%,70%{background:#e10600;box-shadow:0 0 14px rgb(225 6 0/.6)}90%,100%{background:#262b33;box-shadow:none}}`}</style>
    </div>
  );
}

export function ErrorNote({ title = "Could not load this data", detail }: { title?: string; detail?: string }) {
  return (
    <div className="panel p-6" role="alert">
      <p className="display text-[1.6rem]">{title}</p>
      {detail && <p className="mt-2 text-steel">{detail}</p>}
      <button type="button" className="btn btn-ghost mt-4" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ small readouts */

export function Stat({
  label,
  value,
  note,
  className = "",
  valueClassName = "text-[2.4rem]",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={className}>
      <dt className="label">{label}</dt>
      <dd className={`figure mt-1.5 ${valueClassName}`}>{value}</dd>
      {note && <dd className="mt-1 text-[0.92rem] leading-snug text-mute">{note}</dd>}
    </div>
  );
}

/** Horizontal score bar with the model's cutoff marked. */
export function ScoreBar({
  value,
  colour = "var(--color-signal)",
  height = 8,
  cutoff = true,
  className = "",
}: {
  value: number;
  colour?: string;
  height?: number;
  cutoff?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative bg-line ${className}`} style={{ height }} aria-hidden>
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: colour }}
      />
      {cutoff && (
        <span
          className="absolute -top-[3px] -bottom-[3px] w-px bg-ink/80"
          style={{ left: `${THRESHOLD * 100}%` }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ segmented control */

export interface TabOption<T extends string> {
  id: T;
  label: ReactNode;
  disabled?: boolean;
}

/** A segmented choice: a radio group where the arrow keys, Home and End move the selection. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
  idPrefix,
  className = "",
  size = "md",
}: {
  value: T;
  onChange: (next: T) => void;
  options: TabOption<T>[];
  label: string;
  idPrefix: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = options.filter((option) => !option.disabled);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = enabled.findIndex((option) => option.id === value);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % enabled.length;
    if (event.key === "ArrowLeft") next = (index - 1 + enabled.length) % enabled.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = enabled.length - 1;
    onChange(enabled[next].id);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-tab-${enabled[next].id}`)?.focus());
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`no-scrollbar inline-flex max-w-full overflow-x-auto border border-line2 bg-tower p-[3px] ${className}`}
    >
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            id={`${idPrefix}-tab-${option.id}`}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.id)}
            className={`shrink-0 cursor-pointer font-display font-semibold tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              size === "sm" ? "min-h-8 px-3 text-[0.92rem]" : "min-h-10 px-4 text-[1.05rem]"
            } ${on ? "bg-ink text-paper" : "text-steel hover:text-ink"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ disclosure */

export function Note({ children, kind = "info" }: { children: ReactNode; kind?: "info" | "warn" }) {
  return (
    <p
      className={`border-l-2 py-1 pl-3 text-[0.95rem] leading-snug ${
        kind === "warn" ? "border-amber text-steel" : "border-line2 text-mute"
      }`}
    >
      {children}
    </p>
  );
}
