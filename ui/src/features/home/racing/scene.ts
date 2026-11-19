/**
 * The onboard preview's renderer: it owns the WebGL context, the camera in the player's cockpit, the other cars, the lighting, and the
 * loop. The race itself is traffic.ts; this file only turns its (s, d) positions into a picture and sends a few numbers back.
 *
 * It is loaded on demand (the page imports it dynamically), so none of three.js is on the homepage's critical path.
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { circuit, type TrackPoint } from "./track.ts";
import { createRaceAudio } from "./audio.ts";
import { gripLat } from "./dynamics.ts";
import { CAR_LENGTH, NUMBERS, createRace, gearFor, revFraction, stepRace, FIELD, LAPS, type Input, type Race, type RaceEvent } from "./traffic.ts";
import { speedFx } from "./post.ts";
import {
  EYE,
  LIVERIES,
  PLAYER_LIVERY,
  assembleCar,
  buildCarGeometry,
  NUMBER_PLATES,
  bodyMaterial,
  buildSteeringWheel,
  carMaterials,
  liveryTexture,
  numberAtlas,
  numberCell,
  playerMaterials,
  frontWheelGroups,
  type CarGeometry,
} from "./cars.ts";
import { buildWorld, type World } from "./world.ts";
import * as tex from "./textures.ts";

/** One line of the running order around the player. */
export interface TowerRow {
  position: number;
  /** The car's number, or "You". */
  label: string;
  /** Seconds to the player, or null when the gap is not worth stating (the car is too far away to be seen). */
  gap: number | null;
  /** The car's livery colour: a constructor colour identifies a competitor, as everywhere on the site. */
  colour: string;
  you: boolean;
}

export interface Hud {
  kmh: number;
  gear: number;
  position: number;
  lap: number;
  field: number;
  laps: number;
  boost: boolean;
  /** 0 to 1 of the way through the gear: the rev lights. */
  rev: number;
  throttle: number;
  brake: number;
  /** Sideways and forwards acceleration, in g (a right-hand bend is positive). */
  gLat: number;
  gLong: number;
  /** The running order around the player: up to two cars ahead, the player, up to two behind. */
  tower: TowerRow[];
  /** The start: lights lit (0 to 5), whether they are showing green, and whether the race is on. */
  lights: number;
  green: boolean;
  released: boolean;
}

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  quality: tex.Quality;
  maxCars: number;
  seed?: number;
  onHud?: (h: Hud) => void;
  onEvent?: (e: RaceEvent) => void;
  onContextLost?: () => void;
}

export interface RacingScene {
  /** The controls: the page writes to this, the model reads it every step. */
  readonly input: Input;
  setSize(width: number, height: number): void;
  /** Sound (the engine, the other cars, the spotter on the radio) is off until it is asked for, from a click or a key. */
  readonly sound: boolean;
  /** Returns whether the sound is on afterwards: false where the browser cannot make it. */
  setSound(on: boolean): boolean;
  play(): void;
  pause(): void;
  /** Run the race on for this long without drawing, then draw one frame (for a still picture). */
  still(seconds: number): void;
  readonly playing: boolean;
  /** Back to the grid, with the lights. */
  restart(): void;
  dispose(): void;
}

const DPR_CAP: Record<tex.Quality, number> = { high: 1.75, medium: 1.5, low: 1 };
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export async function createRacingScene(opts: SceneOptions): Promise<RacingScene> {
  const { canvas, quality } = opts;
  const track = circuit();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", powerPreference: "high-performance", stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = quality !== "low";
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, DPR_CAP[quality]);
  renderer.setPixelRatio(dpr);

  const lost = (e: Event) => {
    e.preventDefault();
    opts.onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", lost);

  const world: World = await buildWorld({ quality, maxAnisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  const scene = new THREE.Scene();
  scene.add(world.root);
  scene.fog = new THREE.Fog(world.fogColour, 70, 520);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(world.skyScene, 0, 0.1, 120);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 1.0;
  pmrem.dispose();

  // ---- sun and its shadow, which follows the player
  const sun = world.sun;
  const SHADOW = quality === "high" ? 2048 : 1024;
  const R = 90;
  if (quality !== "low") {
    sun.castShadow = true;
    sun.shadow.mapSize.set(SHADOW, SHADOW);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 520 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
  }
  const lightRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), world.sunDir).normalize();
  const lightUp = new THREE.Vector3().crossVectors(world.sunDir, lightRight).normalize();
  const texel = (R * 2) / SHADOW;
  const shadowAt = new THREE.Vector3();

  // ---- cars
  const mats = carMaterials();
  const geos: CarGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const { geo } = buildCarGeometry(LIVERIES[i], true, i === 0);
    if (i > 0) for (const k of ["carbon", "rubber", "metal", "glow"] as const) geo[k].dispose();
    geos.push(geo);
  }
  const shared = geos[0];
  // each team's paint is one picture over the whole car; a livery's material carries its own
  const atlasSize = quality === "high" ? 2048 : 1024;
  const paints = [0, 1, 2, 3, 4, 5].map((i) => liveryTexture(i, atlasSize));
  const liveryMats = [0, 1, 2, 3, 4].map((i) => bodyMaterial(paints[i], true));
  const blobTexture = new THREE.CanvasTexture(tex.blobTexture());
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: true });
  const blobGeo = new THREE.PlaneGeometry(2.9, 6.8).rotateX(-Math.PI / 2);
  const shadows = quality !== "low";
  // the race numbers: a plate each side of the fin and one on the nose, cut from one atlas
  const numberTexture = new THREE.CanvasTexture(numberAtlas(NUMBERS));
  numberTexture.colorSpace = THREE.SRGBColorSpace;
  numberTexture.anisotropy = 8;
  const numberMat = new THREE.MeshBasicMaterial({ map: numberTexture, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const helmetMats: THREE.MeshPhysicalMaterial[] = [];
  const slots = Array.from({ length: opts.maxCars }, () => {
    const car = assembleCar({ ...shared, body: geos[0].body }, mats, shadows);
    car.body.material = liveryMats[0];
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.position.set(0, 0.03, 0.25);
    car.group.add(blob);
    const helmetMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
    helmetMats.push(helmetMat);
    const helmet = new THREE.Mesh(shared.helmet!, helmetMat);
    helmet.castShadow = shadows;
    car.group.add(helmet);
    const plates = NUMBER_PLATES.map((p) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), numberMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.set(p.rx, p.ry, 0);
      car.group.add(mesh);
      return mesh;
    });
    car.group.visible = false;
    car.group.frustumCulled = true;
    scene.add(car.group);
    return { ...car, helmetMat, plates, livery: -1, number: -1 };
  });
  /** Put a car in a team's livery and give it its number and its driver's helmet: done when a car is created, where nobody sees it. */
  const dress = (slot: (typeof slots)[number], livery: number, number: number) => {
    if (slot.livery !== livery) {
      slot.body.geometry = geos[livery].body;
      slot.body.material = liveryMats[livery];
      slot.livery = livery;
    }
    if (slot.number !== number) {
      slot.number = number;
      const [u0, u1, v0, v1] = numberCell(NUMBERS, number);
      for (const plate of slot.plates) {
        const uv = plate.geometry.attributes.uv as THREE.BufferAttribute;
        uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]);
        uv.needsUpdate = true;
      }
    }
    // team-mates wear different helmets: the team's own, and then a plain white one or the car's second colour
    const l = LIVERIES[livery];
    const options = [l.helmet, "#f2f2ef", l.secondary, l.primary];
    slot.helmetMat.color.set(options[number % options.length]);
  };

  // ---- the player's car: the same car, with the helmet left out and the camera where the driver's eyes are
  const player = buildCarGeometry(LIVERIES[PLAYER_LIVERY], false, false);
  const pMats = playerMaterials(mats, paints[PLAYER_LIVERY]);
  const playerCar = assembleCar(player.geo, pMats, shadows);
  const front = frontWheelGroups(player.frontWheelSets, pMats);
  front.forEach((w) => playerCar.group.add(w));
  const wheel = buildSteeringWheel();
  playerCar.group.add(wheel.group);
  scene.add(playerCar.group);

  const camera = new THREE.PerspectiveCamera(78, 1, 0.07, 1400);
  // the picture goes through a small chain: the scene (antialiased), the camera look, and the tone mapping for the screen
  const composer =
    quality === "low"
      ? null
      : new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: quality === "high" ? 4 : 2 }));
  const fx = new ShaderPass(speedFx);
  if (composer) {
    composer.setPixelRatio(dpr);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(fx);
    composer.addPass(new OutputPass());
  }
  const draw = () => (composer ? composer.render() : renderer.render(scene, camera));
  camera.position.copy(EYE);
  playerCar.group.add(camera);
  scene.add(sun.target);

  // ---- the race
  const audio = createRaceAudio();
  let race: Race = createRace(opts.seed ?? 7, opts.maxCars);
  const input: Input = { throttle: 0, brake: 0, steer: 0, boost: false, manual: false };
  const tp: TrackPoint = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0, curv: 0 };
  const tp2: TrackPoint = { ...tp };
  const camWorld = new THREE.Vector3();
  const yawOf = (p: TrackPoint) => Math.atan2(-p.tx, -p.tz);
  let gear = 5;
  let aspect = 1;

  const place = (group: THREE.Object3D, s: number, d: number, yawExtra: number, pitchExtra: number, roll: number, lift = 0) => {
    track.into(s, tp);
    track.into(s + 3, tp2);
    const slope = Math.atan2(tp2.y - tp.y, 3);
    group.position.set(tp.x + tp.rx * d, tp.y + lift, tp.z + tp.rz * d);
    group.rotation.set(slope + pitchExtra, yawOf(tp) + yawExtra, roll, "YXZ");
  };

  let shakePhase = 0;
  const update = (dt: number) => {
    const p = race.player;
    // other cars
    race.cars.forEach((c, i) => {
      const slot = slots[i];
      if (!c.active) {
        slot.group.visible = false;
        return;
      }
      slot.group.visible = true;
      dress(slot, c.livery, c.number);
      place(slot.group, c.s, c.d, c.yaw, clamp(c.a * 0.0006, -0.03, 0.016), 0);
    });

    // the player's car carries the road's vibration (the camera is bolted to it, so the cockpit stays still in the picture and the world shakes)
    const speed = clamp(p.v / 85, 0, 1);
    shakePhase += dt;
    const t = shakePhase;
    const rough = 0.25 + 0.75 * speed;
    const bump = rough * (Math.sin(t * 57) * 0.5 + Math.sin(t * 33.7 + 1.3) * 0.35 + Math.sin(t * 91) * 0.15);
    const sway = rough * (Math.sin(t * 41 + 0.4) * 0.5 + Math.sin(t * 23.1) * 0.5);
    const aLat = p.v * p.v * track.into(p.s, tp).curv;
    const lean = clamp(aLat / 42, -1, 1);
    const kerb = p.kerb;
    place(playerCar.group, p.s, p.d, p.yaw, bump * 0.0016 + Math.sin(t * 95) * 0.006 * kerb, lean * -0.012 + sway * 0.0012 + Math.sin(t * 71) * 0.006 * kerb, bump * 0.0045 + Math.sin(t * 95) * 0.012 * kerb);

    // the driver's head: leaning into braking and the bends, looking into a corner a little before it
    const brake = clamp(-p.a / 40, 0, 1);
    const push = clamp(p.a / 18, 0, 1);
    camera.position.set(EYE.x - lean * 0.045, EYE.y - brake * 0.012 + push * 0.004, EYE.z - brake * 0.035);
    const ahead = track.into(p.s + 26, tp).curv;
    const look = clamp(ahead * 70, -0.1, 0.1) + p.steer * 0.04;
    camera.rotation.set(-brake * 0.026 + push * 0.012 - 0.085, -look, lean * 0.028, "YXZ");
    // the front wheels steer, the wheel in the driver's hands turns
    for (const w of front) w.rotation.y = -p.steer * 0.3;
    wheel.steer(-p.steer * 1.15);

    // wide enough to see a car alongside, but not so wide that the picture bends: the field of view follows the shape of the frame
    const hFov = (92 + speed * 3 + p.boost * 3) * (Math.PI / 180);
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
    camera.fov = clamp((vFov * 180) / Math.PI, 62, 86);
    camera.updateProjectionMatrix();

    // the sky and hills stay at the horizon, the sun's shadow follows the player
    camera.getWorldPosition(camWorld);
    for (const f of world.followers) {
      f.position.x = camWorld.x;
      f.position.z = camWorld.z;
      if (f === world.followers[0]) f.position.y = camWorld.y;
    }
    track.into(p.s + 50, tp);
    shadowAt.set(tp.x, tp.y, tp.z);
    const a = Math.round(shadowAt.dot(lightRight) / texel) * texel;
    const b = Math.round(shadowAt.dot(lightUp) / texel) * texel;
    const c = shadowAt.dot(world.sunDir);
    shadowAt.copy(lightRight).multiplyScalar(a).addScaledVector(lightUp, b).addScaledVector(world.sunDir, c);
    sun.target.position.copy(shadowAt);
    sun.position.copy(shadowAt).addScaledVector(world.sunDir, 260);
  };

  const kmh = () => race.player.v * 3.6;
  let hudAt = 0;
  let wheelAt = 0;
  const hudState: Hud = { kmh: 0, gear: 1, position: 0, lap: 0, field: FIELD, laps: LAPS, boost: false, rev: 0, throttle: 0, brake: 0, gLat: 0, gLong: 0, tower: [], lights: 0, green: false, released: false };
  /** The cars on the road nearest the player, ahead and behind, as rows of a timing tower. */
  const buildTower = (): TowerRow[] => {
    const p = race.player;
    const live = race.cars.filter((c) => c.active);
    const ahead = live.filter((c) => c.g > 0).sort((a, b) => a.g - b.g).slice(0, 2);
    const behind = live.filter((c) => c.g < 0).sort((a, b) => b.g - a.g).slice(0, 2);
    const row = (c: (typeof live)[number], position: number): TowerRow => {
      const metres = Math.abs(c.g) - CAR_LENGTH;
      // the time gap at the speed the car behind is doing
      const gap = Math.abs(c.g) > 380 ? null : Math.max(0, metres) / Math.max(c.g > 0 ? p.v : c.v, 20);
      return { position, label: String(c.number), gap, colour: LIVERIES[c.livery].primary, you: false };
    };
    const rows: TowerRow[] = [];
    // a car on the road is the next in the order only if it is the nearest; the cars not drawn are further off than any shown
    ahead.reverse().forEach((c, i, all) => rows.push(row(c, race.position - (all.length - i))));
    rows.push({ position: race.position, label: "You", gap: null, colour: LIVERIES[PLAYER_LIVERY].secondary, you: true });
    behind.forEach((c, i) => rows.push(row(c, race.position + 1 + i)));
    return rows;
  };
  const emit = (now: number, force = false) => {
    if (!force && now - hudAt < 90) return;
    hudAt = now;
    gear = gearFor(kmh(), gear);
    hudState.kmh = kmh();
    hudState.gear = gear;
    hudState.position = race.position;
    hudState.lap = race.lap;
    hudState.boost = race.player.boost > 0.5;
    hudState.rev = revFraction(kmh(), gear);
    hudState.throttle = race.player.throttle;
    hudState.brake = race.player.brake;
    // the sideways load the tyres can carry is the most the car feels, however fast it is going into the bend
    const sideways = race.player.v * race.player.v * track.into(race.player.s, tp).curv;
    const cap = race.player.v > 0 ? gripLat(race.player.v) : 0;
    hudState.gLat = (input.manual ? Math.sign(sideways) * Math.min(Math.abs(sideways), cap) : sideways) / 9.81;
    hudState.gLong = race.player.a / 9.81;
    hudState.tower = buildTower();
    hudState.lights = race.lights;
    hudState.green = race.green;
    hudState.released = race.released;
    opts.onHud?.(hudState);
  };
  const drain = () => {
    if (race.events.length === 0) return;
    for (const e of race.events) opts.onEvent?.(e);
    race.events.length = 0;
  };
  const drawWheel = (now: number, force = false) => {
    if (!force && now - wheelAt < 66) return;
    wheelAt = now;
    wheel.draw(gear, kmh(), revFraction(kmh(), gear), race.position, race.lap);
  };

  // ---- the loop
  let raf = 0;
  let last = 0;
  let litNow = -1;
  let greenNow = false;
  let runs = 0;
  let playing = false;
  let slowFrames = 0;
  let frames = 0;
  let ema = 16;
  const adapt = (ms: number) => {
    ema += (ms - ema) * 0.08;
    if (++frames % 90 !== 0) return;
    if (ema > 22 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.25);
      renderer.setPixelRatio(dpr);
      composer?.setPixelRatio(dpr);
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      composer?.setSize(canvas.clientWidth, canvas.clientHeight);
    } else if (ema > 26 && ++slowFrames >= 2 && sun.castShadow) {
      sun.castShadow = false;
    }
  };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    stepRace(race, dt, input);
    update(dt);
    emit(now);
    drawWheel(now);
    audio.update(race, dt);
    drain();
    syncLights();
    fx.uniforms.uSpeed.value = clamp(race.player.v / 85, 0, 1) * (1 + race.player.boost * 0.5);
    fx.uniforms.uTime.value = now / 1000;
    draw();
    adapt(dt * 1000);
  };
  const syncLights = () => {
    if (race.lights === litNow && race.green === greenNow) return;
    litNow = race.lights;
    greenNow = race.green;
    world.setStartLights(litNow, greenNow);
  };
  const sync = () => {
    update(0);
    syncLights();
    emit(performance.now(), true);
    drawWheel(performance.now(), true);
  };
  sync();

  const self: RacingScene = {
    input,
    get playing() {
      return playing;
    },
    setSize(w, h) {
      if (w <= 0 || h <= 0) return;
      aspect = w / h;
      camera.aspect = aspect;
      renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      fx.uniforms.uAspect.value = aspect;
      camera.updateProjectionMatrix();
      sync();
      if (!playing) draw();
    },
    get sound() {
      return audio.on;
    },
    setSound(on) {
      if (on) return audio.enable();
      audio.disable();
      return false;
    },
    play() {
      if (playing) return;
      playing = true;
      audio.run(true);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    pause() {
      playing = false;
      audio.run(false);
      cancelAnimationFrame(raf);
    },
    restart() {
      runs++;
      audio.reset();
      race = createRace((opts.seed ?? 7) + runs, opts.maxCars);
      input.manual = false;
      input.throttle = input.brake = input.steer = 0;
      input.boost = false;
      litNow = -1;
      sync();
      if (!playing) draw();
    },
    still(seconds) {
      race = createRace(opts.seed ?? 7, opts.maxCars);
      const off: Input = { ...input, manual: false };
      for (let t = 0; t < seconds; t += 1 / 30) stepRace(race, 1 / 30, off);
      race.events.length = 0;
      sync();
      draw();
    },
    dispose() {
      playing = false;
      audio.dispose();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", lost);
      const seen = new Set<unknown>();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry && !seen.has(mesh.geometry)) {
          seen.add(mesh.geometry);
          mesh.geometry.dispose();
        }
      });
      for (const g of geos) g.body.dispose();
      shared.helmet?.dispose();
      for (const m of [...liveryMats, ...helmetMats, numberMat]) m.dispose();
      for (const t2 of [...paints, numberTexture]) t2.dispose();
      for (const sl of slots) for (const p of sl.plates) p.geometry.dispose();
      shared.carbon.dispose();
      shared.rubber.dispose();
      shared.metal.dispose();
      shared.glow.dispose();
      for (const m of [mats.body, pMats.body, mats.carbon, mats.rubber, mats.metal, mats.glow, blobMat]) m.dispose();
      blobTexture.dispose();
      blobGeo.dispose();
      wheel.dispose();
      world.dispose();
      envTarget.dispose();
      composer?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  return self;
}
