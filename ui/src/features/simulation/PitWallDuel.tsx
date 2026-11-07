import { useMemo, useState } from "react";
import type { SimConfig, SimEntry } from "./engine";
import { buildPitCalls, resolvePitCall } from "./pitWall";
import { winningOption } from "./pitWallScore";

export function PitWallDuel({ entries, config, driverName }: { entries: SimEntry[]; config: SimConfig; driverName: string }) {
  const calls = useMemo(() => buildPitCalls(config), [config]);
  const results = useMemo(() => calls.map((call) => resolvePitCall(entries, call)), [calls, entries]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const completed = calls.filter((call) => answers[call.id]).length;
  const score = calls.reduce((sum, call, index) => sum + (answers[call.id] === winningOption(results[index]) ? 1 : 0), 0);

  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="pit-wall-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="pit-wall-title" className="display text-[1.8rem]">Pit Wall Duel</h3>
          <p className="mt-2 max-w-[68ch] text-steel">Make three calls for {driverName}. Each answer is judged across 80 seeded runs; lower mean finishing position wins the call.</p>
        </div>
        <div className="border border-line2 px-4 py-2 text-right" aria-live="polite">
          <p className="label">Calls won</p>
          <p className="figure text-[1.8rem]">{score} <span className="text-[0.9rem] text-mute">/ {completed}</span></p>
        </div>
      </div>

      <ol className="mt-6 divide-y divide-line border-y border-line">
        {calls.map((call, callIndex) => {
          const answer = answers[call.id];
          const winner = winningOption(results[callIndex]);
          return (
            <li key={call.id} className="grid gap-4 py-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
              <div>
                <p className="font-display text-[1.05rem] font-bold tracking-[0.08em] uppercase">{call.situation}</p>
                <p className="mt-1 text-[0.78rem] text-mute">Decision {callIndex + 1} of {calls.length}</p>
              </div>
              <div>
                <p className="max-w-[65ch] leading-snug text-steel">{call.prompt}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {call.options.map((option, optionIndex) => {
                    const summary = results[callIndex][optionIndex];
                    const chosen = answer === option.id;
                    const best = answer && winner === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAnswers((current) => ({ ...current, [call.id]: option.id }))}
                        aria-pressed={chosen}
                        className={`min-h-24 border p-4 text-left transition-colors ${chosen ? "border-amber bg-panel2" : "border-line2 bg-panel hover:border-steel"}`}
                      >
                        <span className="block font-display text-[1.05rem] font-bold uppercase">{option.label}</span>
                        <span className="mt-1 block text-[0.8rem] text-mute">{option.detail}</span>
                        {answer && <span className={`mt-3 block text-[0.82rem] ${best ? "text-good" : "text-steel"}`}>Mean P{summary.meanFinish.toFixed(1)} · {Math.round(summary.podiumRate * 100)}% podiums{best ? " · stronger call" : ""}</span>}
                      </button>
                    );
                  })}
                </div>
                {answer && <p className="mt-3 text-[0.84rem] text-mute">The comparison changes only the decision described above and keeps the driver, seed sequence and other strategy settings aligned.</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {completed === calls.length && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-line2 bg-tower p-4" role="status">
          <p className="font-display text-[1.15rem] font-bold uppercase">{score === 3 ? "Clean sweep" : score === 2 ? "Pit wall approved" : "Review the data"} · {score} of 3 stronger calls</p>
          <button type="button" className="btn btn-ghost !min-h-9" onClick={() => setAnswers({})}>Run the duel again</button>
        </div>
      )}
    </section>
  );
}
