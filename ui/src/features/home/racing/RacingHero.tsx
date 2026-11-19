/**
 * The home page's picture of racing: a first-person onboard view of an invented circuit, with other cars passing and being passed.
 *
 * What the page itself carries is small: this frame, the instrument strip, and a poster. The 3D scene (three.js and everything it
 * draws) is a separate chunk that is fetched after the page is up and only while this card is on screen, and it is dropped again
 * when the page is left. If WebGL is missing or fails the poster stays, and says so.
 *
 * It runs by itself. Driving is opt in: click or focus the view and press a driving key (or use the button), and after a few quiet
 * seconds the autopilot takes the car back. Keys are only read while the view has the keyboard, so the page scrolls and forms type
 * as usual everywhere else.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { StartLights } from "../../../components/StartLights";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { href } from "../../../lib/router";
import type { Hud, RacingScene, TowerRow } from "./scene.ts";
import type { RaceEvent } from "./traffic.ts";

type Status = "waiting" | "loading" | "ready" | "fallback";

/** How hard to draw, from what the device says about itself. */
function pickQuality(): { quality: "high" | "medium" | "low"; cars: number } {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = window.matchMedia("(max-width: 640px)").matches;
  const weak = (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2;
  if (weak) return { quality: "low", cars: 3 };
  if (coarse || small) return { quality: "medium", cars: 4 };
  return { quality: "high", cars: 6 };
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The running order's way into the page: the timing tower hands this out so the 10 Hz stream of rows never re-renders the card. */
type TowerApi = { set(rows: TowerRow[]): void };
/** The start lights over the picture, the same way: told at 10 Hz, re-rendered only when the lights change. */
type LightsApi = { set(lit: number, green: boolean, released: boolean): void };

const DRIVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
/** Seconds without a key or a touch before the autopilot takes the car back. */
const IDLE_MS = 7000;

export function RacingHero() {
  const reduced = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<RacingScene | null>(null);
  const keys = useRef(new Set<string>());
  const touch = useRef({ left: false, right: false, gas: false, brake: false });
  const lastInput = useRef(0);
  const speedEl = useRef<HTMLSpanElement>(null);
  const gearEl = useRef<HTMLSpanElement>(null);
  const posEl = useRef<HTMLSpanElement>(null);
  const lapEl = useRef<HTMLSpanElement>(null);
  const deltaEl = useRef<HTMLSpanElement>(null);
  const throttleEl = useRef<HTMLSpanElement>(null);
  const brakeEl = useRef<HTMLSpanElement>(null);
  const gEl = useRef<HTMLSpanElement>(null);
  const tower = useRef<TowerApi | null>(null);
  const lights = useRef<LightsApi | null>(null);
  const card = useRef<HTMLElement>(null);
  const wasReleased = useRef(false);
  const deltaTimer = useRef(0);
  const unmounted = useRef(false);
  const started = useRef(false);
  const loading = useRef(false);

  const [status, setStatus] = useState<Status>("waiting");
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [manual, setManual] = useState(false);
  const [userPlay, setUserPlay] = useState(false);
  const [lit, setLit] = useState(0);
  const [slow, setSlow] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [released, setReleased] = useState(false);
  /** Full screen: the browser's own where it has one, and a card that fills the window where it does not (an iPhone). */
  const [full, setFull] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** Sound is off until it is asked for: browsers do not allow it before a click, and a page that speaks unasked is rude. */
  const [sound, setSound] = useState(false);

  // ---- when the card is on screen, and when the page is
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.05 });
    io?.observe(node);
    const vis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    vis();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  // ---- the start lights count up while the scene loads: the site's own loading motif
  // (only if it takes a while: a quick load shows a picture and nothing flickers)
  useEffect(() => {
    if (status === "ready" || status === "fallback") return;
    const show = window.setTimeout(() => setSlow(true), 1400);
    const timers = [1, 2, 3, 4, 5].map((i) => window.setTimeout(() => setLit(i), 1400 + i * 300));
    timers.push(window.setTimeout(() => setLit(0), 1400 + 6 * 300));
    return () => {
      window.clearTimeout(show);
      timers.forEach(window.clearTimeout);
    };
  }, [status]);

  // ---- the instrument strip is written straight to the page, so a 10 Hz stream of numbers never re-renders React
  const onHud = useCallback((h: Hud) => {
    const set = (el: HTMLElement | null, text: string) => {
      if (el && el.textContent !== text) el.textContent = text;
    };
    set(speedEl.current, String(Math.round(h.kmh)));
    set(gearEl.current, String(h.gear));
    set(posEl.current, `P${h.position}`);
    set(lapEl.current, String(h.lap));
    set(gEl.current, `${Math.abs(h.gLat).toFixed(1)} g`);
    if (throttleEl.current) throttleEl.current.style.transform = `scaleY(${h.throttle.toFixed(2)})`;
    if (brakeEl.current) brakeEl.current.style.transform = `scaleY(${h.brake.toFixed(2)})`;
    tower.current?.set(h.tower);
    lights.current?.set(h.lights, h.green, h.released);
    if (h.released !== wasReleased.current) {
      wasReleased.current = h.released;
      setReleased(h.released);
    }
  }, []);
  const onEvent = useCallback((e: RaceEvent) => {
    if (e.kind === "lap") return;
    const el = deltaEl.current;
    if (!el) return;
    el.textContent = e.kind === "passed" ? "+1" : "−1";
    el.dataset.gain = e.kind === "passed" ? "1" : "0";
    el.style.opacity = "1";
    window.clearTimeout(deltaTimer.current);
    deltaTimer.current = window.setTimeout(() => (el.style.opacity = "0"), 1600);
  }, []);

  // ---- load the scene once the card is on screen, in an idle moment, so the page's own content is never made to wait for it
  useEffect(() => {
    if (!onScreen || started.current) return;
    started.current = true;
    const begin = async () => {
      if (unmounted.current || !canvas.current || loading.current) return;
      loading.current = true;
      if (!hasWebGL()) {
        setStatus("fallback");
        return;
      }
      setStatus("loading");
      try {
        const mod = await import("./scene.ts");
        if (unmounted.current || !canvas.current) return;
        const q = pickQuality();
        const made = await mod.createRacingScene({
          canvas: canvas.current,
          quality: q.quality,
          maxCars: q.cars,
          onHud,
          onEvent,
          onContextLost: () => setStatus("fallback"),
        });
        if (unmounted.current) {
          made.dispose();
          return;
        }
        scene.current = made;
        const box = stage.current!.getBoundingClientRect();
        made.setSize(box.width, box.height);
        setStatus("ready");
      } catch {
        if (!unmounted.current) setStatus("fallback");
      }
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void begin(), { timeout: 1200 });
    else window.setTimeout(() => void begin(), 150);
  }, [onScreen, onHud, onEvent]);

  // ---- release everything when the page is left (and note that a development double-mount is not leaving)
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      started.current = false;
      loading.current = false;
      window.clearTimeout(deltaTimer.current);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  // ---- keep the drawing the size of the card
  useEffect(() => {
    const node = stage.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      scene.current?.setSize(width, height);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // ---- play and pause: only while seen, and not at all under reduced motion until asked
  const wantsToPlay = status === "ready" && onScreen && pageVisible && (!reduced || userPlay);
  useEffect(() => {
    const s = scene.current;
    if (!s || status !== "ready") return;
    if (wantsToPlay) s.play();
    else s.pause();
  }, [status, wantsToPlay]);
  // a still frame instead of motion, for someone who asked the browser for less of it
  useEffect(() => {
    if (status === "ready" && reduced && !userPlay) scene.current?.still(3.9);
  }, [status, reduced, userPlay]);

  // ---- full screen
  useEffect(() => {
    const change = () => setFull(document.fullscreenElement === card.current);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  // a card that fills the window holds the page still behind it
  useEffect(() => {
    if (!expanded) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [expanded]);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled === true;
  const toggleFull = useCallback(async () => {
    const node = card.current;
    if (!node) return;
    try {
      if (full || expanded || document.fullscreenElement) {
        if (document.fullscreenElement) await document.exitFullscreen();
        setExpanded(false);
      } else if (canFullscreen) {
        await node.requestFullscreen({ navigationUI: "hide" });
      } else {
        setExpanded(true);
      }
    } catch {
      // the browser said no (a permissions policy, say): fill the window instead
      setExpanded((on) => !on);
    }
    // the keyboard stays with the picture
    window.setTimeout(() => stage.current?.focus({ preventScroll: true }), 50);
  }, [full, expanded, canFullscreen]);
  const toggleSound = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    // from the click itself: the browser only lets a page start sound from one
    setSound(s.setSound(!s.sound));
  }, []);
  const restart = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    keys.current.clear();
    touch.current = { left: false, right: false, gas: false, brake: false };
    s.restart();
    wasReleased.current = false;
    setReleased(false);
    setManual(false);
    if (reduced) setUserPlay(true);
  }, [reduced]);
  const filled = full || expanded;

  // ---- driving
  const apply = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    const k = keys.current;
    const t = touch.current;
    s.input.throttle = k.has("KeyW") || k.has("ArrowUp") || t.gas ? 1 : 0;
    s.input.brake = k.has("KeyS") || k.has("ArrowDown") || t.brake ? 1 : 0;
    s.input.steer = (k.has("KeyD") || k.has("ArrowRight") || t.right ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") || t.left ? 1 : 0);
    s.input.boost = k.has("Space");
  }, []);
  const take = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    if (reduced) setUserPlay(true);
    s.input.manual = true;
    lastInput.current = performance.now();
    setManual(true);
  }, [reduced]);
  const release = useCallback(() => {
    keys.current.clear();
    touch.current = { left: false, right: false, gas: false, brake: false };
    const s = scene.current;
    if (s) {
      s.input.manual = false;
      s.input.throttle = s.input.brake = s.input.steer = 0;
      s.input.boost = false;
    }
    setManual(false);
  }, []);
  // the autopilot takes the car back when nobody is steering
  useEffect(() => {
    if (!manual) return;
    const id = window.setInterval(() => {
      const idle = keys.current.size === 0 && !Object.values(touch.current).some(Boolean);
      if (idle && performance.now() - lastInput.current > IDLE_MS) release();
    }, 500);
    return () => window.clearInterval(id);
  }, [manual, release]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (status !== "ready") return;
    if (e.key === "Escape") {
      if (manual) {
        e.preventDefault();
        release();
      } else if (expanded) {
        e.preventDefault();
        setExpanded(false);
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const arrow = e.code.startsWith("Arrow");
    if (!manual) {
      // Enter (or a letter or Space) takes the wheel; the arrow keys keep scrolling the page until it has been taken
      if (e.key === "Enter" || (DRIVE_KEYS.has(e.code) && !arrow)) {
        e.preventDefault();
        take();
        if (e.key !== "Enter") keys.current.add(e.code);
        apply();
      }
      return;
    }
    if (DRIVE_KEYS.has(e.code)) {
      e.preventDefault();
      keys.current.add(e.code);
      lastInput.current = performance.now();
      apply();
    }
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (!keys.current.delete(e.code)) return;
    lastInput.current = performance.now();
    apply();
  };
  const onPointerDown = (e: React.PointerEvent) => {
    // a touch is a scroll until the button is used; a mouse click is a deliberate step into the car
    if (e.pointerType === "touch" || status !== "ready") return;
    stage.current?.focus({ preventScroll: true });
    if (!manual) take();
  };
  const hold = (name: keyof typeof touch.current) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      touch.current[name] = true;
      lastInput.current = performance.now();
      apply();
    },
    onPointerUp: () => {
      touch.current[name] = false;
      lastInput.current = performance.now();
      apply();
    },
    onPointerCancel: () => {
      touch.current[name] = false;
      apply();
    },
  });

  const ready = status === "ready";
  const showPoster = !ready;
  const keyCap = (t: string) => <span className="whitespace-nowrap font-semibold text-steel">{t}</span>;
  const hint: React.ReactNode =
    status === "fallback" ? (
      "The 3D view is unavailable in this browser, so a still picture is shown."
    ) : reduced && !userPlay ? (
      "Motion is paused because your device asks for less of it."
    ) : !released && status === "ready" ? (
      "Five red lights, then lights out. Nothing moves until they do."
    ) : manual ? (
      <>Driving: {keyCap("W A S D")}, {keyCap("Space")} boosts, {keyCap("Esc")} lets go.</>
    ) : coarse ? (
      "Autopilot. Take the wheel for on-screen buttons."
    ) : (
      <>Autopilot. Click the view, then {keyCap("W A S D")}.</>
    );

  // The instruments are the same elements in either layout (the strip under the picture, or the small panels over it when it fills the window), so the readouts written straight to them keep working across a change.
  const big = filled ? "text-[1.45rem]" : "text-[1.75rem]";
  const padsShown = ready && manual && coarse;
  const speedNode = <span ref={speedEl} data-hud="speed" className={`racing-num ${big}`}>{"—"}</span>;
  const gearNode = <span ref={gearEl} data-hud="gear" className={`racing-num ${big}`}>{"—"}</span>;
  const posNode = <span ref={posEl} data-hud="position" className={`racing-num ${big}`}>{"—"}</span>;
  const lapNode = <span ref={lapEl} data-hud="lap" className={`racing-num ${big}`}>{"—"}</span>;
  const deltaNode = (
    <span ref={deltaEl} data-gain="0" className="racing-num ml-1.5 text-[0.95rem] text-mute opacity-0 transition-opacity duration-500 data-[gain='1']:text-ink" />
  );
  // throttle and brake: two bars that fill from the bottom, with the sideways load beside them
  const barH = filled ? "h-5" : "h-7";
  const pedalNodes = (
    <>
      <span className={`relative mr-1 w-1.5 self-center bg-line ${barH}`}><span ref={throttleEl} className="absolute inset-0 origin-bottom bg-hit" style={{ transform: "scaleY(0)" }} /></span>
      <span className={`relative mr-2 w-1.5 self-center bg-line ${barH}`}><span ref={brakeEl} className="absolute inset-0 origin-bottom bg-signal" style={{ transform: "scaleY(0)" }} /></span>
    </>
  );
  const gNode = <span ref={gEl} className={`racing-num text-steel ${filled ? "text-[0.85rem]" : "text-[0.95rem]"}`}>0.0 g</span>;

  return (
    <div className="relative" data-racing-hero data-status={status}>
      <section ref={card} className="racing-card border border-line bg-tower" data-expanded={expanded ? "true" : undefined} aria-label="Interactive onboard race preview, illustrative">
        <p className="sr-only">
          An illustrative onboard view from a Formula 1 car on an invented circuit. Other cars pass it and it passes slower ones. The picture is drawn in your browser and is not a real race or telemetry.
        </p>
        <div
          ref={stage}
          tabIndex={ready ? 0 : -1}
          role="group"
          aria-label="Onboard race preview. Press Enter to drive."
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={(e) => {
            if (manual && !e.currentTarget.contains(e.relatedTarget as Node | null)) release();
          }}
          onPointerDown={onPointerDown}
          className={`racing-stage @container relative aspect-[1.28/1] w-full select-none overflow-hidden bg-[#0d1016] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink max-sm:aspect-[1.1/1] ${ready && !manual ? "cursor-pointer" : ""}`}
          style={{ touchAction: manual ? "none" : "pan-y" }}
        >
          <canvas
            ref={canvas}
            aria-hidden
            className="absolute inset-0 block h-full w-full transition-opacity duration-500"
            style={{ opacity: ready ? 1 : 0 }}
          />
          {showPoster && (
            <img
              src="/racing/poster.jpg"
              alt=""
              aria-hidden
              decoding="async"
              onLoad={() => setPosterReady(true)}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
              style={{ opacity: posterReady ? 1 : 0 }}
            />
          )}
          {ready && <TimingTower api={tower} />}
          {ready && <LightsPanel api={lights} />}
          {ready && (
            <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5 sm:right-3 sm:top-3">
              <OverlayButton label={filled ? "Exit full screen" : "Full screen"} onClick={() => void toggleFull()} pressed={filled}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
                  {filled ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
                </svg>
              </OverlayButton>
              <OverlayButton label="Sound" onClick={toggleSound} pressed={sound}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
                  <path d="M4 9.5v5h3.5L12.5 19V5L7.5 9.5H4z" />
                  {sound ? <path d="M16 8.8a4.6 4.6 0 0 1 0 6.4M18.7 6.2a8.2 8.2 0 0 1 0 11.6" /> : <path d="M16.3 9.7l4.6 4.6M20.9 9.7l-4.6 4.6" />}
                </svg>
              </OverlayButton>
              <OverlayButton label="Restart from the grid" onClick={restart}>
                <Icon name="replay" size={19} />
              </OverlayButton>
            </div>
          )}
          {showPoster && slow && status !== "fallback" && (
            <div className="absolute left-3 top-3">
              <StartLights lit={lit} className="h-4 w-3" />
            </div>
          )}
          {ready && reduced && !userPlay && (
            <button type="button" className="btn btn-ghost absolute bottom-3 left-1/2 -translate-x-1/2 bg-tower" onClick={() => setUserPlay(true)}>
              Play preview
            </button>
          )}
          {ready && filled && (
            <div
              className={`pointer-events-none absolute inset-x-3 grid grid-cols-[auto_auto] items-end justify-between gap-y-1 max-[359px]:grid-cols-1 max-sm:portrait:inset-x-2 max-sm:portrait:top-[10.3rem] max-sm:portrait:bottom-auto max-sm:portrait:items-start max-sm:portrait:justify-start max-sm:portrait:gap-x-1.5 ${padsShown ? "bottom-[4.9rem]" : "bottom-3"}`}
              data-racing-overlay
            >
              <div className="flex items-center gap-3.5 justify-self-start whitespace-nowrap bg-tower/90 px-3 py-1.5" aria-hidden>
                <span className="flex items-baseline gap-1">
                  {speedNode}
                  <span className="text-[0.75rem] text-mute">km/h</span>
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-[0.75rem] text-mute">Gear</span>
                  {gearNode}
                </span>
                {/* on a narrow phone the pedals and the sideways load make way, so the two panels sit side by side */}
                <span className="flex items-center gap-1.5 max-[389px]:hidden">
                  {pedalNodes}
                  {gNode}
                </span>
              </div>
              <div className="flex items-center gap-3.5 justify-self-end whitespace-nowrap bg-tower/90 px-3 py-1.5 max-sm:portrait:justify-self-start" aria-hidden>
                <span className="flex items-baseline gap-1">
                  {posNode}
                  <span className="text-[0.75rem] text-mute">/ 20</span>
                  {deltaNode}
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-[0.75rem] text-mute">Lap</span>
                  {lapNode}
                  <span className="text-[0.75rem] text-mute">/ 57</span>
                </span>
              </div>
              <p className="pointer-events-auto col-start-2 flex w-fit items-center gap-2 justify-self-end bg-tower/90 px-2 py-1 text-[0.75rem] leading-none text-mute max-sm:portrait:col-[1/-1] max-sm:portrait:flex-wrap max-sm:portrait:justify-self-start">
                <span>{hint}</span>
                {/* the stage steps into the car on a press; this button is for choosing either way */}
                <button
                  type="button"
                  className="inline-flex min-h-6 items-center whitespace-nowrap text-steel underline decoration-line2 underline-offset-2 hover:text-ink pointer-coarse:min-h-9"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={manual ? release : take}
                  aria-pressed={manual}
                >
                  {manual ? "Back to autopilot" : "Take the wheel"}
                </button>
              </p>
            </div>
          )}
          {ready && manual && coarse && (
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-2" role="group" aria-label="Driving controls">
              <div className="flex gap-2">
                <PadButton label="Steer left" {...hold("left")}>◀</PadButton>
                <PadButton label="Steer right" {...hold("right")}>▶</PadButton>
              </div>
              <div className="flex gap-2">
                <PadButton label="Brake" {...hold("brake")}>Brake</PadButton>
                <PadButton label="Accelerate" {...hold("gas")}>Gas</PadButton>
              </div>
            </div>
          )}
        </div>

        {/* beside the page the instruments are a strip under the picture; full screen they are two small corner panels over it (above), so the picture keeps the whole window */}
        {!filled && (
          <>
            <div className="grid grid-cols-[1.25fr_0.62fr_0.78fr_0.95fr_1fr] border-t border-line2 bg-tower" aria-hidden>
              <Cell>
                {speedNode}
                <span className="ml-1.5 text-[0.8rem] text-mute max-[420px]:hidden">km/h</span>
              </Cell>
              <Cell>
                <span className="mr-1.5 text-[0.8rem] text-mute max-[420px]:hidden">Gear</span>
                {gearNode}
              </Cell>
              <Cell>
                {pedalNodes}
                <span className="max-[520px]:hidden">{gNode}</span>
              </Cell>
              <Cell>
                {posNode}
                <span className="ml-1 text-[0.8rem] text-mute">/ 20</span>
                {deltaNode}
              </Cell>
              <Cell last>
                <span className="mr-1.5 text-[0.8rem] text-mute">Lap</span>
                {lapNode}
                <span className="ml-1 text-[0.8rem] text-mute max-[420px]:hidden">/ 57</span>
              </Cell>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-line px-4 py-1 text-[0.82rem] leading-snug text-mute">
              <p className="py-1.5">{hint}</p>
              <div className="flex flex-wrap items-center gap-x-5">
                {ready && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center text-[0.9rem] text-steel underline decoration-line2 underline-offset-2 hover:text-ink"
                    onClick={manual ? release : take}
                    aria-pressed={manual}
                  >
                    {manual ? "Back to autopilot" : "Take the wheel"}
                  </button>
                )}
                <a className="inline-flex min-h-11 items-center text-[0.9rem] text-steel underline decoration-line2 underline-offset-2 hover:text-ink" href={href("/circuits")}>
                  Explore circuits
                </a>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** The start lights: five red ones coming on in turn, going out, and a moment of green. Gone once the race is on. */
function LightsPanel({ api }: { api: React.MutableRefObject<LightsApi | null> }) {
  const [state, setState] = useState({ lit: 0, green: false, released: false });
  const last = useRef("");
  useEffect(() => {
    api.current = {
      set(lit, green, released) {
        const key = `${lit}|${green}|${released}`;
        if (key === last.current) return;
        last.current = key;
        setState({ lit, green, released });
      },
    };
    return () => {
      api.current = null;
    };
  }, [api]);
  if (state.released && !state.green) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-2.5 -translate-x-1/2 bg-tower/90 px-2.5 py-2 sm:top-3 @max-[479px]:left-[calc(50%+1.6rem)] @max-[329px]:px-1.5 @max-[329px]:py-1.5" data-start-lights data-lit={state.lit} data-green={state.green ? "true" : "false"} aria-hidden>
      <div className="flex gap-2 @max-[329px]:gap-1">
        {[0, 1, 2, 3, 4].map((i) => {
          const on = state.green || i < state.lit;
          return (
            <span
              key={i}
              className={`h-4 w-4 rounded-full transition-colors duration-100 sm:h-[1.15rem] sm:w-[1.15rem] @max-[329px]:h-3 @max-[329px]:w-3 ${
                on ? (state.green ? "bg-hit shadow-[0_0_14px_rgba(61,220,132,.65)]" : "bg-signal shadow-[0_0_14px_rgba(225,6,0,.75)]") : "bg-line2"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function OverlayButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="grid min-h-11 min-w-11 place-items-center border border-line2 bg-tower/90 text-steel hover:text-ink focus-visible:outline-2"
    >
      {children}
    </button>
  );
}

/** A timing tower in the broadcast manner: the cars either side of the player, with the gap in seconds and the player's row inverted. */
function TimingTower({ api }: { api: React.MutableRefObject<TowerApi | null> }) {
  const [rows, setRows] = useState<TowerRow[]>([]);
  const last = useRef("");
  useEffect(() => {
    api.current = {
      set(next) {
        const key = next.map((r) => `${r.position}:${r.label}:${r.gap === null ? "-" : r.gap.toFixed(1)}`).join("|");
        if (key === last.current) return;
        last.current = key;
        setRows(next);
      },
    };
    return () => {
      api.current = null;
    };
  }, [api]);
  if (rows.length === 0) return null;
  const at = rows.findIndex((r) => r.you);
  return (
    <ol className="pointer-events-none absolute left-2.5 top-2.5 w-[6.9rem] bg-tower/90 sm:left-3 sm:top-3 sm:w-[8.4rem]" aria-hidden>
      {rows.map((r, i) => (
        <li
          key={r.position}
          className={`grid h-[1.45rem] grid-cols-[1.9rem_0.3rem_minmax(0,1fr)_auto] items-center gap-x-1.5 pr-2 sm:h-[1.55rem] ${r.you ? "bg-ink text-paper" : "text-ink"} ${i > 0 ? "border-t border-line" : ""}`}
        >
          <span className="racing-num pl-1.5 text-[0.9rem]">P{r.position}</span>
          <span className="h-full" style={{ background: r.colour }} />
          <span className={`racing-num truncate text-[0.9rem] ${r.you ? "" : "text-steel"}`}>{r.you ? "You" : `#${r.label}`}</span>
          <span className="racing-num text-[0.85rem] text-mute">
            {r.you || r.gap === null ? "" : `${i < at ? "\u2212" : "+"}${r.gap.toFixed(1)}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Cell({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return <div className={`flex min-w-0 items-baseline justify-center whitespace-nowrap px-2 py-2.5 ${last ? "" : "border-r border-line"}`}>{children}</div>;
}

function PadButton({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid min-h-14 min-w-14 place-items-center border border-line2 bg-tower px-3 font-[family-name:var(--font-display)] text-[1.05rem] font-semibold text-ink active:bg-panel2"
      style={{ touchAction: "none" }}
      {...rest}
    >
      {children}
    </button>
  );
}
