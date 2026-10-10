import { useState } from "react";
import { num } from "../lib/format";
import { haptic } from "../lib/haptic";

const FLAGS = [1, 1, 0, 1, 0, 0];

export function FormWindow() {
  const [leaked, setLeaked] = useState(false);
  const windowFlags = leaked ? FLAGS.slice(1) : FLAGS.slice(0, 5);
  const mean = windowFlags.reduce((sum, flag) => sum + flag, 0) / windowFlags.length;

  return (
    <div>
      <p className="max-w-[68ch] text-steel">
        Six flags in a row. The last one is the race being predicted. These flags illustrate the shift. They are not a driver's record.
      </p>
      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Illustrated podium flags">
        {FLAGS.map((flag, index) => {
          const current = index === FLAGS.length - 1;
          const inside = leaked ? index > 0 : index < FLAGS.length - 1;
          return (
            <li
              key={`${index}-${flag}`}
              className={`border px-2 py-3 ${current ? "border-signal" : "border-line"} ${inside ? "text-ink" : "text-steel"}`}
            >
              <span className="block text-[0.85rem] text-steel">{current ? "This race" : `Race ${index + 1}`}</span>
              <span className="figure mt-2 block text-[2rem]">{flag === 1 ? "Podium" : "Out"}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <p>
          <span className="figure block text-[3rem]">{num(mean, 1)}</span>
          <span className="mt-1 block text-steel">{leaked ? "Window includes this race. Illegal." : "Previous five only. This is the feature."}</span>
        </p>
        <button
          type="button"
          aria-pressed={leaked}
          onClick={() => {
            haptic("toggle");
            setLeaked((value) => !value);
          }}
          className="switch"
        >
          Count this race in the window
        </button>
      </div>
      <p className="mt-6 max-w-[68ch]">
        Constructor form does the same shift one level up. The two cars in a race are averaged first, so a teammate cannot see the other car's result from the same start. That race mean is then moved to the following race. Today's pair, in this illustration, would be a podium and a miss: mean {num(0.5, 1)}, stored for the next round, not for today.
      </p>
    </div>
  );
}
