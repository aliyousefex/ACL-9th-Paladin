import { haptic } from "../lib/haptic";

const SPANS = [
  { name: "Training", seasons: "1950-2019", year: 1984, start: 1950, end: 2019 },
  { name: "Validation", seasons: "2020-2021", year: 2021, start: 2020, end: 2021 },
  { name: "Test", seasons: "2022-2024", year: 2023, start: 2022, end: 2024 },
] as const;

const FIRST = 1950;
const LAST = 2024;

export function SeasonSpine({ year, onYear }: { year: number; onYear: (year: number) => void }) {
  const span = SPANS.find((item) => year >= item.start && year <= item.end) ?? SPANS[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Locked split">
        {SPANS.map((item) => {
          const on = item.name === span.name;
          return (
            <button
              key={item.name}
              type="button"
              aria-pressed={on}
              onClick={() => {
                haptic("select");
                onYear(item.year);
              }}
              className="switch"
            >
              {item.name}
              <span className="mt-1 block text-[0.92rem]">{item.seasons}</span>
            </button>
          );
        })}
      </div>
      <div className="relative mt-5 h-3 bg-line" aria-hidden>
        {SPANS.map((item) => (
          <span
            key={item.name}
            className={`absolute top-0 h-3 ${item.name === "Validation" ? "bg-signal" : "bg-steel"}`}
            style={{
              left: `${((item.start - FIRST) / (LAST - FIRST)) * 100}%`,
              width: `${((item.end - item.start) / (LAST - FIRST)) * 100}%`,
            }}
          />
        ))}
        <span
          className="absolute top-[-4px] h-5 w-0.5 bg-ink"
          style={{ left: `${((year - FIRST) / (LAST - FIRST)) * 100}%` }}
        />
      </div>
      <p className="mt-3 text-steel">
        {year} sits in {span.name.toLowerCase()}. Validation is two seasons wide. That is the whole selection window.
      </p>
    </div>
  );
}
