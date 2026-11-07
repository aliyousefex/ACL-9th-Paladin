import { useEffect, useMemo, useRef, useState } from "react";
import { CircuitThumb } from "../../components/CircuitMap";
import { Icon } from "../../components/Icon";
import { Tag } from "../../components/Provenance";
import { RACE_CIRCUITS, currentLayout, type Circuit } from "../../lib/data";
import { TrackAttack } from "./TrackAttack";
import { PodiumSprint } from "./PodiumSprint";

const QUIZ_CIRCUITS = RACE_CIRCUITS.filter((circuit) => currentLayout(circuit).thumb);

function choicesFor(index: number): Circuit[] {
  const count = QUIZ_CIRCUITS.length;
  const correct = QUIZ_CIRCUITS[index % count];
  const choices = [correct, QUIZ_CIRCUITS[(index * 5 + 7) % count], QUIZ_CIRCUITS[(index * 7 + 13) % count], QUIZ_CIRCUITS[(index * 11 + 19) % count]];
  const unique = [...new Map(choices.map((circuit) => [circuit.circuitId, circuit])).values()];
  for (const circuit of QUIZ_CIRCUITS) {
    if (unique.length === 4) break;
    if (!unique.some((item) => item.circuitId === circuit.circuitId)) unique.push(circuit);
  }
  const rotation = index % unique.length;
  return [...unique.slice(rotation), ...unique.slice(0, rotation)];
}

export function ChallengeHub() {
  return (
    <section id="challenges" aria-labelledby="challenges-title" className="scroll-mt-28 border-y border-line py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="challenges-title" className="display text-[2.4rem] sm:text-[3.4rem]">Read the track. Make the call.</h2>
          <p className="mt-3 max-w-[68ch] text-[1rem] leading-relaxed text-steel">Short challenges built from Paladin’s held-out races, circuit atlas and timing language. They are games, not additional model evaluation.</p>
        </div>
        <Tag kind="illustrative">Interactive challenge</Tag>
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <CircuitQuiz />
        <PitRelease />
      </div>
      <PodiumSprint />
      <TrackAttack />
    </section>
  );
}

function CircuitQuiz() {
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const correct = QUIZ_CIRCUITS[round % QUIZ_CIRCUITS.length];
  const meta = currentLayout(correct);
  const choices = useMemo(() => choicesFor(round), [round]);
  const answered = answer !== null;

  const choose = (circuit: Circuit) => {
    if (answered) return;
    setAnswer(circuit.circuitId);
    if (circuit.circuitId === correct.circuitId) setScore((value) => value + 1);
  };

  return (
    <div className="panel overflow-hidden">
      <div className="grid min-h-[31rem] md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative grid min-h-72 place-items-center border-b border-line bg-tower p-8 md:border-r md:border-b-0">
          <CircuitThumb meta={meta} className="h-64 w-full max-w-[480px]" stroke={answered ? "#f4f4f2" : "#c5cad1"} width={11} accent="#262b33" />
          <div className="absolute top-4 left-4">
            <p className="label">Circuit identification</p>
            <p className="mt-1 text-[0.82rem] text-mute">Question {round + 1} · score {score}</p>
          </div>
          {answered && (
            <div className="absolute right-4 bottom-4 bg-tower/95 px-4 py-3 text-right" aria-live="polite">
              <p className={`font-display text-[1.05rem] font-bold uppercase ${answer === correct.circuitId ? "text-hit" : "text-signal-text"}`}>{answer === correct.circuitId ? "Correct" : "Not this time"}</p>
              <p className="mt-1 text-[0.85rem] text-steel">{correct.name} · {correct.location || correct.country}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col p-5">
          <h3 className="display text-[1.8rem]">Name this circuit</h3>
          <p className="mt-2 text-[0.88rem] leading-snug text-mute">The outline comes from the same verified circuit data used by the race pages.</p>
          <div className="mt-5 grid gap-2" role="group" aria-label="Circuit choices">
            {choices.map((circuit) => {
              const chosen = answer === circuit.circuitId;
              const isCorrect = circuit.circuitId === correct.circuitId;
              return (
                <button key={circuit.circuitId} type="button" disabled={answered} onClick={() => choose(circuit)} className={`min-h-12 border px-3 py-2 text-left font-display text-[1.05rem] font-semibold uppercase transition-colors disabled:cursor-default ${answered && isCorrect ? "border-hit bg-hit text-paper" : chosen ? "border-signal bg-signal text-white" : "border-line2 bg-panel text-steel hover:border-steel hover:text-ink"}`}>
                  {circuit.name}
                </button>
              );
            })}
          </div>
          {answered && <button type="button" className="btn mt-auto w-full" onClick={() => { setRound((value) => value + 1); setAnswer(null); }}>Next circuit <Icon name="arrowRight" size={16} /></button>}
          {!answered && <p className="mt-auto pt-5 text-[0.78rem] text-mute">Country, layout name and labels stay hidden until you answer.</p>}
        </div>
      </div>
    </div>
  );
}

type ReleaseState = "idle" | "waiting" | "ready" | "result" | "false-start";

function PitRelease() {
  const [state, setState] = useState<ReleaseState>("idle");
  const [reaction, setReaction] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(() => {
    try { return Number(localStorage.getItem("paladin:pit-release-best")) || null; } catch { return null; }
  });
  const timer = useRef(0);
  const readyAt = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const start = () => {
    window.clearTimeout(timer.current);
    setReaction(null);
    setState("waiting");
    const delay = 1100 + Math.random() * 1900;
    timer.current = window.setTimeout(() => {
      readyAt.current = performance.now();
      setState("ready");
    }, delay);
  };

  const release = () => {
    if (state === "waiting") {
      window.clearTimeout(timer.current);
      setState("false-start");
      return;
    }
    if (state !== "ready") return;
    const value = Math.round(performance.now() - readyAt.current);
    setReaction(value);
    setState("result");
    if (best === null || value < best) {
      setBest(value);
      try { localStorage.setItem("paladin:pit-release-best", String(value)); } catch { /* current score remains visible */ }
    }
  };

  const active = state === "waiting" || state === "ready";
  return (
    <div className="panel flex min-h-[31rem] flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="display text-[1.8rem]">Pit release</h3>
          <p className="mt-2 max-w-[42ch] text-[0.9rem] leading-snug text-mute">Start the sequence, wait for all four wheel signals to turn green, then release the car as quickly as you can.</p>
        </div>
        <span className="tag tag-illus">Timing game</span>
      </div>

      <div className="my-auto py-10 text-center">
        <div className="mx-auto grid max-w-[300px] grid-cols-4 gap-3" aria-hidden>
          {[0, 1, 2, 3].map((wheel) => (
            <span key={wheel} className={`h-16 border border-line2 transition-colors ${state === "ready" ? "bg-hit" : state === "false-start" ? "bg-signal" : state === "waiting" ? "bg-amber" : "bg-panel2"}`} />
          ))}
        </div>
        <div className="mt-7 min-h-20" aria-live="polite">
          {state === "idle" && <p className="display text-[2rem]">Ready on the marks</p>}
          {state === "waiting" && <p className="display text-[2rem] text-amber">Hold…</p>}
          {state === "ready" && <p className="display text-[2.5rem] text-hit">Release</p>}
          {state === "false-start" && <><p className="display text-[2rem] text-signal-text">Unsafe release</p><p className="mt-2 text-steel">You went before the green signal.</p></>}
          {state === "result" && <><p className="figure text-[3.4rem]">{reaction}<span className="text-[1.1rem] text-mute"> ms</span></p><p className="mt-1 text-steel">{reaction !== null && reaction < 220 ? "Elite reaction" : reaction !== null && reaction < 350 ? "Clean release" : "Room on the gun"}</p></>}
        </div>
      </div>

      {active ? (
        <button type="button" className={`btn min-h-14 w-full !text-[1.2rem] ${state === "ready" ? "!bg-hit !text-paper" : ""}`} onClick={release}>{state === "ready" ? "Release car" : "Hold position"}</button>
      ) : (
        <button type="button" className="btn min-h-14 w-full !text-[1.2rem]" onClick={start}>{state === "idle" ? "Start sequence" : "Try again"}</button>
      )}
      <p className="mt-3 flex items-center justify-between text-[0.8rem] text-mute"><span>Local reflex game · no historical pit data</span><span>Best {best === null ? "—" : `${best} ms`}</span></p>
    </div>
  );
}
