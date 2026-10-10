export type Pulse = "select" | "step" | "toggle" | "lights";

const GAP: Record<Pulse, number> = {
  select: 0,
  step: 110,
  toggle: 0,
  lights: 0,
};

let lastStep = 0;
let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function haptic(kind: Pulse = "select"): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.visibilityState === "hidden") return;

  const now = performance.now();
  if (kind === "step" && now - lastStep < GAP.step) return;
  if (kind === "step") lastStep = now;

  const pattern = kind === "lights" ? [12, 32, 18] : kind === "toggle" ? 16 : kind === "step" ? 6 : 10;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // A browser can expose vibrate and still reject the call.
  }
  if (window.matchMedia("(pointer: coarse)").matches) knock(kind);
}

function knock(kind: Pulse): void {
  const Context = window.AudioContext;
  if (!Context) return;
  audio ??= new Context();
  const play = () => {
    if (!audio) return;
    noise ??= noiseBuffer(audio);
    const start = audio.currentTime;
    burst(start, kind === "lights" ? 0.07 : 0.04);
    if (kind === "lights") burst(start + 0.05, 0.05);
  };
  if (audio.state === "suspended") void audio.resume().then(play);
  else play();
}

function burst(when: number, level: number): void {
  if (!audio || !noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 700;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(level, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start(when);
  source.stop(when + 0.03);
}

function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.03);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * Math.exp(-index / (length * 0.18));
  }
  return buffer;
}
