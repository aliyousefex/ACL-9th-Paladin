export interface AttackState {
  progress: number;
  speed: number;
  elapsed: number;
  penalty: number;
  incidents: number;
  lastIncident: number;
  finished: boolean;
}

export interface GhostSample {
  time: number;
  progress: number;
}

export function initialAttackState(): AttackState {
  return { progress: 0, speed: 0.045, elapsed: 0, penalty: 0, incidents: 0, lastIncident: -1, finished: false };
}

export function curvatureAt(samples: [number, number][], progress: number): number {
  if (samples.length < 25) return 0;
  const at = Math.min(samples.length - 1, Math.floor(progress * (samples.length - 1)));
  const reach = Math.max(4, Math.floor(samples.length / 90));
  const before = samples[(at - reach + samples.length) % samples.length];
  const point = samples[at];
  const after = samples[(at + reach) % samples.length];
  const a = Math.atan2(point[1] - before[1], point[0] - before[0]);
  const b = Math.atan2(after[1] - point[1], after[0] - point[0]);
  const delta = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  return Math.min(1, delta / 1.15);
}

/** Illustrative fixed-step driving rule: throttle builds speed; high curvature lowers the safe speed. */
export function advanceAttack(state: AttackState, throttle: boolean, samples: [number, number][], dt = 0.05): AttackState {
  if (state.finished) return state;
  const curvature = curvatureAt(samples, state.progress);
  let speed = Math.max(0.035, Math.min(0.14, state.speed + (throttle ? 0.075 : -0.11) * dt));
  const safeSpeed = 0.145 - curvature * 0.105;
  const canPenalize = state.lastIncident < 0 || state.progress - state.lastIncident > 0.045;
  const incident = curvature > 0.2 && speed > safeSpeed * 1.08 && canPenalize;
  if (incident) speed *= 0.58;
  const progress = Math.min(1, state.progress + speed * dt);
  return {
    progress,
    speed,
    elapsed: state.elapsed + dt,
    penalty: state.penalty + (incident ? 1.5 : 0),
    incidents: state.incidents + (incident ? 1 : 0),
    lastIncident: incident ? state.progress : state.lastIncident,
    finished: progress >= 1,
  };
}

export function ghostProgressAt(trace: GhostSample[], time: number): number {
  if (trace.length === 0) return 0;
  if (time <= trace[0].time) return trace[0].progress;
  const after = trace.findIndex((sample) => sample.time >= time);
  if (after < 0) return 1;
  const a = trace[after - 1];
  const b = trace[after];
  const span = Math.max(0.001, b.time - a.time);
  return a.progress + (b.progress - a.progress) * ((time - a.time) / span);
}

export function ghostTimeAt(trace: GhostSample[], progress: number): number | null {
  if (trace.length === 0) return null;
  if (progress <= trace[0].progress) return trace[0].time;
  const after = trace.findIndex((sample) => sample.progress >= progress);
  if (after < 0) return trace[trace.length - 1].time;
  const a = trace[after - 1];
  const b = trace[after];
  const span = Math.max(0.0001, b.progress - a.progress);
  return a.time + (b.time - a.time) * ((progress - a.progress) / span);
}
