import { monteCarlo, type SimConfig, type SimEntry } from "./engine";

export interface PitCallOption {
  id: string;
  label: string;
  detail: string;
  config: SimConfig;
}

export interface PitCallResult extends Omit<PitCallOption, "config"> {
  meanFinish: number;
  podiumRate: number;
}

export interface PitCall {
  id: string;
  situation: string;
  prompt: string;
  options: [PitCallOption, PitCallOption];
}

export function buildPitCalls(config: SimConfig): PitCall[] {
  const rainLap = Math.ceil(config.laps * 0.52);
  const neutralPit = config.selected.pitLap ?? Math.round(config.laps * 0.5);
  const safetyLap = Math.round(config.laps * 0.55);
  return [
    {
      id: "window",
      situation: "Traffic window",
      prompt: "Your driver is catching a slower car. Do you stop early for clear air or extend the stint?",
      options: [
        { id: "under", label: "Undercut", detail: `Stop on lap ${Math.max(3, neutralPit - 4)}`, config: { ...config, selected: { ...config.selected, pitLap: Math.max(3, neutralPit - 4) } } },
        { id: "over", label: "Overcut", detail: `Stop on lap ${Math.min(config.laps - 2, neutralPit + 4)}`, config: { ...config, selected: { ...config.selected, pitLap: Math.min(config.laps - 2, neutralPit + 4) } } },
      ],
    },
    {
      id: "safety",
      situation: "Safety-car window",
      prompt: `The field compresses on lap ${safetyLap}. Trade track position for the reduced pit-loss window?`,
      options: [
        { id: "box", label: "Box now", detail: "Take the compressed stop", config: { ...config, safetyCarLap: safetyLap, selected: { ...config.selected, pitLap: safetyLap } } },
        { id: "stay", label: "Stay out", detail: "Protect track position", config: { ...config, safetyCarLap: safetyLap, selected: { ...config.selected, pitLap: Math.min(config.laps - 2, safetyLap + 5) } } },
      ],
    },
    {
      id: "rain",
      situation: "Rain approaching",
      prompt: `Rain reaches the circuit around lap ${rainLap}. Commit to intermediates or remain on slicks?`,
      options: [
        { id: "inters", label: "Fit intermediates", detail: `Change on lap ${rainLap}`, config: { ...config, weather: "mixed", selected: { ...config.selected, pitLap: rainLap, secondCompound: "intermediate" } } },
        { id: "slicks", label: "Stay on slicks", detail: "Wait for conditions to settle", config: { ...config, weather: "mixed", selected: { ...config.selected, pitLap: rainLap, secondCompound: "hard" } } },
      ],
    },
  ];
}

export function resolvePitCall(entries: SimEntry[], call: PitCall, runs = 80): [PitCallResult, PitCallResult] {
  return call.options.map((option) => {
    const result = monteCarlo(entries, option.config, runs);
    return { id: option.id, label: option.label, detail: option.detail, meanFinish: result.meanFinish, podiumRate: result.podiumRate };
  }) as [PitCallResult, PitCallResult];
}

