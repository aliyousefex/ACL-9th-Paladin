/**
 * The sound of the onboard preview, made in the browser and only once somebody asks for it.
 *
 *  - The player's engine: a V6-ish note (a sawtooth and a square an octave up, through a filter that opens with the throttle) whose
 *    pitch follows the revs the instruments show, with a dip at each gear change, crackle when the throttle is lifted at speed and
 *    a rumble over the kerbs.
 *  - Wind, which grows with speed, and tyre noise when the car is near the limit of its grip.
 *  - Each car on the road has its own voice, panned to the side it is on and shifted in pitch as it comes up and goes by (a
 *    Doppler shift, a little exaggerated), so a pass is heard before it is seen.
 *  - The spotter's radio (see callouts.ts): a two-tone chirp and the line spoken by the browser's own speech voice.
 *
 * Nothing is loaded and nothing is recorded: every sound is an oscillator or noise shaped by filters. There is no audio file, and
 * the page never creates an audio context until the person presses the sound button (browsers do not allow it earlier either).
 */
import { createSpotter, type Callout } from "./callouts.ts";
import { gripLat } from "./dynamics.ts";
import { gearFor, revFraction, type Race } from "./traffic.ts";
import type { TrackPoint } from "./track.ts";

export interface RaceAudio {
  /** Whether the sound is switched on. */
  readonly on: boolean;
  /** Switch it on. Must be called from a click or a key press. Returns false where the browser has no Web Audio. */
  enable(): boolean;
  disable(): void;
  /** The picture is running (true) or at rest (false): sound rests with it. */
  run(running: boolean): void;
  /** Back to the grid. */
  reset(): void;
  /** Called once a frame with the race as it is, and the events not yet handed to the page. */
  update(race: Race, dt: number): void;
  dispose(): void;
}

const MAX_VOICES = 8;
const SPEED_OF_SOUND = 343;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Engine revs, rpm, from the gear and how far through it the car is: a sawtooth as the real thing has between gear changes. */
const revs = (gear: number, fraction: number) => (gear === 1 ? 4500 + 8000 * fraction : 8200 + 4300 * fraction);
/** A V6 fires three times a revolution, twice a revolution for each of its two banks: about rpm / 20 Hz. */
const firing = (rpm: number) => rpm / 20;

interface Voice {
  gain: GainNode;
  pan: StereoPannerNode;
  lowpass: BiquadFilterNode;
  a: OscillatorNode;
  b: OscillatorNode;
  whoosh: GainNode;
}

interface Graph {
  master: GainNode;
  shift: GainNode;
  engineA: OscillatorNode;
  engineB: OscillatorNode;
  engineC: OscillatorNode;
  engineLowpass: BiquadFilterNode;
  engineGain: GainNode;
  rasp: BiquadFilterNode;
  raspGain: GainNode;
  wind: BiquadFilterNode;
  windGain: GainNode;
  tyre: BiquadFilterNode;
  tyreGain: GainNode;
  rumble: OscillatorNode;
  rumbleGain: GainNode;
  pop: GainNode;
  voices: Voice[];
  sources: AudioScheduledSourceNode[];
}

export function createRaceAudio(): RaceAudio {
  let ctx: AudioContext | null = null;
  let graph: Graph | null = null;
  let on = false;
  let running = true;
  let gear = 1;
  let previousThrottle = 0;
  let previousGear = 1;
  let sinceUpdate = 1;
  let speaking = false;
  let speakingPriority = 0;
  const spotter = createSpotter();
  const scratch: TrackPoint = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0, curv: 0 };
  const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

  const noiseBuffer = (c: AudioContext) => {
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buffer.getChannelData(0);
    // a fixed sequence, so the sound is the same every time
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    return buffer;
  };

  const build = (c: AudioContext): Graph => {
    const sources: AudioScheduledSourceNode[] = [];
    const noise = noiseBuffer(c);
    const hiss = (offset: number) => {
      const n = c.createBufferSource();
      n.buffer = noise;
      n.loop = true;
      n.start(0, offset);
      sources.push(n);
      return n;
    };
    const osc = (type: OscillatorType, freq: number) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.start();
      sources.push(o);
      return o;
    };
    const gain = (v: number) => {
      const g = c.createGain();
      g.gain.value = v;
      return g;
    };
    const filter = (type: BiquadFilterType, f: number, q = 0.7) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };

    const master = gain(0);
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 5;
    master.connect(compressor).connect(c.destination);

    // the engine: three oscillators through a soft clipper and a filter that opens with the throttle
    const shape = c.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 2.6) / Math.tanh(2.6);
    }
    shape.curve = curve;
    const engineA = osc("sawtooth", 300);
    const engineB = osc("square", 600);
    const engineC = osc("sawtooth", 150);
    const mix = gain(1);
    engineA.connect(gain(0.5)).connect(mix);
    engineB.connect(gain(0.16)).connect(mix);
    engineC.connect(gain(0.32)).connect(mix);
    const engineLowpass = filter("lowpass", 1500, 0.9);
    const engineGain = gain(0);
    const shift = gain(1);
    mix.connect(shape).connect(engineLowpass).connect(engineGain).connect(shift).connect(master);
    // the rasp of the exhaust
    const rasp = filter("bandpass", 2400, 0.9);
    const raspGain = gain(0);
    hiss(0.1).connect(rasp).connect(raspGain).connect(shift);
    // wind
    const wind = filter("lowpass", 400, 0.6);
    const windGain = gain(0);
    hiss(0.7).connect(wind).connect(windGain).connect(master);
    // tyres at the limit
    const tyre = filter("bandpass", 1400, 2.2);
    const tyreGain = gain(0);
    hiss(1.3).connect(tyre).connect(tyreGain).connect(master);
    // the kerbs
    const rumble = osc("square", 36);
    const rumbleFilter = filter("lowpass", 120, 0.8);
    const rumbleGain = gain(0);
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);
    // the crackle when the throttle is lifted
    const popFilter = filter("highpass", 900, 0.7);
    const pop = gain(0);
    hiss(1.7).connect(popFilter).connect(pop).connect(master);

    // the other cars
    const voices: Voice[] = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      const a = osc("sawtooth", 300);
      const b = osc("square", 600);
      const mixV = gain(1);
      a.connect(gain(0.55)).connect(mixV);
      b.connect(gain(0.14)).connect(mixV);
      const lowpass = filter("lowpass", 2000, 0.8);
      const g = gain(0);
      const pan = c.createStereoPanner();
      mixV.connect(lowpass).connect(g).connect(pan).connect(master);
      // the rush of air as one goes by
      const rush = filter("bandpass", 1100, 0.6);
      const whoosh = gain(0);
      hiss(0.3 + i * 0.17).connect(rush).connect(whoosh).connect(pan);
      voices.push({ gain: g, pan, lowpass, a, b, whoosh });
    }
    return { master, shift, engineA, engineB, engineC, engineLowpass, engineGain, rasp, raspGain, wind, windGain, tyre, tyreGain, rumble, rumbleGain, pop, voices, sources };
  };

  const to = (param: AudioParam, value: number, tc = 0.045) => {
    if (ctx) param.setTargetAtTime(value, ctx.currentTime, tc);
  };

  /** Two short tones, as a radio makes before somebody speaks. */
  const chirp = () => {
    if (!ctx || !graph) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1450, t);
    o.frequency.setValueAtTime(1950, t + 0.085);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.01);
    g.gain.setValueAtTime(0.09, t + 0.15);
    g.gain.linearRampToValueAtTime(0, t + 0.17);
    o.connect(g).connect(graph.master);
    o.start(t);
    o.stop(t + 0.2);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };

  const pickVoice = (): SpeechSynthesisVoice | null => {
    if (!synth) return null;
    const voices = synth.getVoices();
    if (voices.length === 0) return null;
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const rank = (v: SpeechSynthesisVoice) =>
      (v.lang.toLowerCase().startsWith("en-gb") ? 4 : 0) + (/male|daniel|george|ryan|guy|david|arthur|oliver/i.test(v.name) && !/female/i.test(v.name) ? 3 : 0) + (v.localService ? 1 : 0);
    return english.sort((a, b) => rank(b) - rank(a))[0] ?? null;
  };

  const say = (line: Callout) => {
    if (!synth) {
      chirp();
      return;
    }
    const busy = speaking || synth.speaking;
    // a quiet line is dropped while a louder one is being said; a louder one cuts in
    if (busy && line.priority <= speakingPriority) return;
    if (busy) synth.cancel();
    chirp();
    const u = new SpeechSynthesisUtterance(line.text);
    const v = pickVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else u.lang = "en-GB";
    u.rate = 1.14;
    u.pitch = 0.85;
    u.volume = 1;
    speaking = true;
    speakingPriority = line.priority;
    const done = () => {
      speaking = false;
      speakingPriority = 0;
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  };

  const silence = () => {
    if (synth) synth.cancel();
    speaking = false;
    speakingPriority = 0;
  };

  const crackle = (g: Graph, count: number) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let k = 0; k < count; k++) {
      const at = t + 0.03 + k * 0.075 + ((k * 37) % 5) * 0.01;
      g.pop.gain.setValueAtTime(0, at);
      g.pop.gain.linearRampToValueAtTime(0.2 - k * 0.025, at + 0.004);
      g.pop.gain.linearRampToValueAtTime(0, at + 0.03);
    }
  };

  const self: RaceAudio = {
    get on() {
      return on;
    },
    enable() {
      if (on) return true;
      const Context = typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (!Context) return false;
      try {
        ctx ??= new Context();
        graph ??= build(ctx);
      } catch {
        return false;
      }
      on = true;
      sinceUpdate = 1;
      void ctx.resume();
      graph.master.gain.cancelScheduledValues(ctx.currentTime);
      graph.master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.12);
      return true;
    },
    disable() {
      if (!on || !ctx || !graph) return;
      on = false;
      silence();
      spotter.reset();
      graph.master.gain.cancelScheduledValues(ctx.currentTime);
      graph.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      const c = ctx;
      window.setTimeout(() => {
        if (!on && c.state === "running") void c.suspend();
      }, 400);
    },
    run(now) {
      running = now;
      if (!ctx || !on) return;
      if (now) void ctx.resume();
      else {
        silence();
        void ctx.suspend();
      }
    },
    reset() {
      spotter.reset();
      silence();
      gear = 1;
      previousGear = 1;
    },
    update(race, dt) {
      if (!on || !ctx || !graph || !running) return;
      // the sound is set up in steps of about 30 per second: plenty for a pitch, and few calls
      sinceUpdate += dt;
      const lines = spotter.step(race, race.events);
      if (lines.length > 0) say(lines[0]);
      if (sinceUpdate < 0.033) return;
      sinceUpdate = 0;

      const g = graph;
      const p = race.player;
      const kmh = p.v * 3.6;
      gear = gearFor(kmh, gear);
      const fraction = revFraction(kmh, gear);
      // on the grid the engine is held up while the lights count, then the car goes
      const lit = race.released ? 0 : race.lights;
      const rpm = race.released ? revs(gear, fraction) : 5200 + 2800 * (lit / 5) + (lit > 0 ? 0 : 0);
      const f = firing(rpm);
      const throttle = race.released ? p.throttle : 0.25 + 0.5 * (lit / 5);

      to(g.engineA.frequency, f, 0.03);
      to(g.engineB.frequency, f * 2.005, 0.03);
      to(g.engineC.frequency, f * 0.5, 0.03);
      to(g.engineLowpass.frequency, 650 + 3600 * throttle + 1500 * fraction + 900 * p.boost, 0.05);
      to(g.engineGain.gain, 0.1 + 0.3 * throttle + 0.06 * fraction, 0.05);
      to(g.rasp.frequency, 1800 + rpm * 0.25, 0.05);
      to(g.raspGain.gain, 0.012 + 0.07 * throttle + 0.02 * p.boost, 0.06);

      // a change of gear: the power is cut for a moment
      if (gear !== previousGear) {
        const t = ctx.currentTime;
        g.shift.gain.cancelScheduledValues(t);
        g.shift.gain.setValueAtTime(gear > previousGear ? 0.25 : 0.55, t);
        g.shift.gain.linearRampToValueAtTime(1, t + (gear > previousGear ? 0.1 : 0.07));
        if (gear < previousGear && kmh > 120) crackle(g, 2);
        previousGear = gear;
      }
      // the throttle lifted at speed: the exhaust crackles
      if (previousThrottle > 0.8 && throttle < 0.15 && kmh > 160) crackle(g, 3 + Math.round(kmh / 120));
      previousThrottle = throttle;

      // the air, the tyres and the road
      to(g.wind.frequency, 280 + kmh * 9, 0.08);
      to(g.windGain.gain, 0.015 + 0.3 * (kmh / 330) ** 2, 0.1);
      const curv = race.track.into(p.s, scratch).curv;
      const ratio = (p.v * p.v * Math.abs(curv)) / gripLat(p.v);
      to(g.tyre.frequency, 1100 + 700 * ratio, 0.08);
      to(g.tyreGain.gain, 0.28 * clamp((ratio - 0.72) / 0.5, 0, 1) + 0.05 * p.brake * Math.min(1, kmh / 150), 0.07);
      to(g.rumble.frequency, 26 + kmh * 0.12, 0.1);
      to(g.rumbleGain.gain, 0.32 * p.kerb, 0.06);

      // the other cars
      for (let i = 0; i < g.voices.length; i++) {
        const v = g.voices[i];
        const c = race.cars[i];
        if (!c || !c.active) {
          to(v.gain.gain, 0, 0.05);
          to(v.whoosh.gain, 0, 0.05);
          continue;
        }
        const across = c.d - p.d;
        const dist = Math.sqrt(c.g * c.g + across * across + 1.2);
        // the engine's note, shifted as the car approaches or recedes (a little more than physics gives, so it is heard)
        const approach = (c.g > 0 ? 1 : -1) * (p.v - c.v);
        const carKmh = c.v * 3.6;
        const carGear = gearFor(carKmh, 1);
        const base = firing(race.released ? revs(carGear, revFraction(carKmh, carGear)) : 6500);
        const doppler = clamp(SPEED_OF_SOUND / (SPEED_OF_SOUND - approach * 2.4), 0.8, 1.25);
        to(v.a.frequency, base * doppler, 0.04);
        to(v.b.frequency, base * 2.004 * doppler, 0.04);
        const near = 1 / (1 + (dist / 11) ** 2);
        const level = (race.released ? 0.3 : 0.12) * near * clamp(1 - dist / 220, 0, 1);
        to(v.gain.gain, level, 0.05);
        to(v.lowpass.frequency, 450 + 3800 / (1 + dist / 35), 0.06);
        to(v.pan.pan, clamp(across / 6, -1, 1), 0.04);
        // the rush as it goes by
        const rel = Math.abs(p.v - c.v);
        const rush = 1 / (1 + (dist / 4.5) ** 2);
        to(v.whoosh.gain, 0.34 * rush * clamp(rel / 22, 0.1, 1), 0.035);
      }
    },
    dispose() {
      on = false;
      silence();
      if (graph) for (const s of graph.sources) {
        try {
          s.stop();
        } catch {
          // already stopped
        }
      }
      graph = null;
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
  return self;
}
