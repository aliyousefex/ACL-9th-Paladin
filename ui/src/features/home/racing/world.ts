/**
 * The circuit's surroundings, built once from the track's centre line: the road and its run-off as strips of ground, kerbs on the
 * insides of the corners, barriers with advert panels and a catch fence, grandstands, a pit building with its pit lane, the
 * start/finish gantry and two bridges over the road, trees, the sky and a ring of hills.
 *
 * Everything repeated along the road is an InstancedMesh, so the whole lap is a few dozen draw calls. The sky, the tarmac and the grass
 * are photographs and scans from Poly Haven (CC0, see public/racing/LICENSE.txt); the markings, kerbs, adverts and structures are
 * drawn in textures.ts. If a scan fails to load the painted textures stand in for it. The world is built in stages with a yield
 * between them so the page stays responsive.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../../../lib/random.ts";
import { circuit, wrap, type TrackPoint } from "./track.ts";
import * as tex from "./textures.ts";

export interface WorldOptions {
  quality: tex.Quality;
  maxAnisotropy: number;
}

export interface World {
  root: THREE.Group;
  sun: THREE.DirectionalLight;
  /** Unit vector from the scene towards the sun. */
  sunDir: THREE.Vector3;
  hemi: THREE.HemisphereLight;
  /** Things that follow the camera so they are always at the horizon. */
  followers: THREE.Object3D[];
  skyScene: THREE.Scene;
  fogColour: THREE.Color;
  /** Light the gantry's start lights: how many are red, or all of them green. */
  setStartLights(count: number, green: boolean): void;
  dispose(): void;
}

const BARRIER_D = 11.7;
const GROUND_Y = -6;
const FLAT = 36;
const SPAN = 66;

const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The height of the terrain beside the road, relative to the road, at a given distance from the centre line. */
function terrainDy(d: number, roadY: number): number {
  const a = Math.abs(d);
  if (a <= FLAT) return 0;
  const t = Math.min(1, (a - FLAT) / (SPAN - FLAT));
  const smooth = t * t * (3 - 2 * t);
  return (GROUND_Y - roadY) * smooth;
}

export async function buildWorld(opts: WorldOptions): Promise<World> {
  const track = circuit();
  const L = track.length;
  const rng = mulberry32(2024);
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const canvasTexture = (c: HTMLCanvasElement, repeat = true, srgb = true): THREE.CanvasTexture => {
    const t = own(new THREE.CanvasTexture(c));
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = opts.maxAnisotropy;
    return t;
  };
  const low = opts.quality === "low";
  const tp: TrackPoint = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0, curv: 0 };
  const yaw = (p: TrackPoint) => Math.atan2(-p.tx, -p.tz);

  // ---------------------------------------------------------------- light and sky
  const loader = new THREE.TextureLoader();
  const load = (url: string, srgb: boolean, repeat: boolean): Promise<THREE.Texture | null> =>
    new Promise((resolve) => {
      loader.load(
        url,
        (t) => {
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = opts.maxAnisotropy;
          disposables.push(t);
          resolve(t);
        },
        undefined,
        () => resolve(null),
      );
    });
  const SPRITE_NAMES = ["tree-fir-a", "tree-fir-b", "tree-broad-a", "tree-broad-b", "bush-a", "bush-b"] as const;
  const [skyPhoto, aDiff, aNor, aRough, gDiff, gNor, gRough, ...sprites] = await Promise.all([
    load("/racing/sky.jpg", true, false),
    load("/racing/asphalt-diff.jpg", true, true),
    load("/racing/asphalt-nor.jpg", false, true),
    load("/racing/asphalt-rough.jpg", false, true),
    load("/racing/grass-diff.jpg", true, true),
    load("/racing/grass-nor.jpg", false, true),
    load("/racing/grass-rough.jpg", false, true),
    ...SPRITE_NAMES.map((n) => load(`/racing/${n}.webp`, true, false)),
  ]);
  const scans = !!(aDiff && aNor && aRough && gDiff && gNor && gRough);

  // The sun is where the photograph has it (found once, from the picture: u 0.6035, v 0.2341, 47.9 degrees up). The dome is turned about
  // the vertical axis so that the sun sits behind and to the right of a car on the main straight, which lights the cars ahead of it.
  const SUN_U = 0.6035;
  const SUN_V = 0.2341;
  const phi = SUN_U * Math.PI * 2;
  const theta = SUN_V * Math.PI;
  const photoSun = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  const wanted = Math.atan2(0.42, -0.62); // azimuth of "behind and to the right" in the ground plane (z, x)
  const skyYaw = Math.atan2(photoSun.z, photoSun.x) - wanted;
  const sunDir = photoSun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), skyYaw).normalize();
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.castShadow = false;
  const hemi = new THREE.HemisphereLight(0xa9c3e6, 0x5b6a4a, 0.4);

  const skyMap = skyPhoto ?? canvasTexture(tex.fallbackSky(), false);
  const skyMat = own(new THREE.MeshBasicMaterial({ map: skyMap, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  const skyDome = new THREE.Mesh(own(new THREE.SphereGeometry(1000, 48, 24)), skyMat);
  skyDome.renderOrder = -10;
  skyDome.frustumCulled = false;
  skyDome.rotation.y = skyYaw;
  root.add(skyDome);

  // a small scene of the same sky above a dull ground, turned into the reflections on the cars and the tarmac
  const skyScene = new THREE.Scene();
  const envDome = new THREE.Mesh(own(new THREE.SphereGeometry(50, 40, 20)), own(new THREE.MeshBasicMaterial({ map: skyMap, side: THREE.BackSide })));
  envDome.rotation.y = skyYaw;
  const envGround = new THREE.Mesh(own(new THREE.CircleGeometry(49, 32).rotateX(-Math.PI / 2)), own(new THREE.MeshBasicMaterial({ color: 0x4e4f4a })));
  envGround.position.y = -0.4;
  skyScene.add(envDome, envGround);

  // a faint line of far hills in the haze, so the horizon is not a ruled line
  const hillRings: THREE.Mesh[] = [];
  for (const [i, ring] of [{ r: 960, h: 120, tint: "rgba(121,134,156,1)", seed: 4, op: 0.55 }, { r: 900, h: 70, tint: "rgba(108,124,128,1)", seed: 9, op: 0.6 }].entries()) {
    const t = canvasTexture(tex.hillTexture(ring.seed, ring.tint, 0.9), false);
    t.wrapS = THREE.RepeatWrapping;
    const mat = own(new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false, side: THREE.BackSide, opacity: ring.op, toneMapped: false }));
    const mesh = new THREE.Mesh(own(new THREE.CylinderGeometry(ring.r, ring.r, ring.h, 48, 1, true)), mat);
    mesh.position.y = ring.h / 2 - 8;
    mesh.renderOrder = -9 + i;
    mesh.frustumCulled = false;
    root.add(mesh);
    hillRings.push(mesh);
  }
  // the haze is the colour of the photograph just above its horizon
  const fogColour = new THREE.Color().setRGB(166 / 255, 172 / 255, 188 / 255, THREE.SRGBColorSpace);
  await yieldFrame();

  // ---------------------------------------------------------------- the ground
  const groundMap = canvasTexture(tex.groundTexture(opts.quality));
  groundMap.wrapS = THREE.ClampToEdgeWrapping;
  const groundMat = own(new THREE.MeshStandardMaterial({ map: groundMap, roughness: 1, metalness: 0, vertexColors: true }));
  if (scans) {
    // the painted map says where the lines, run-off and grass are; the scans say what each is made of. Tarmac and grass are told apart by
    // the distance from the centre line (the u coordinate of the strip), and blended over a metre so there is no seam.
    groundMat.normalMap = aNor;
    groundMat.normalScale.set(0.9, 0.9);
    groundMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uADiff: { value: aDiff },
        uANor: { value: aNor },
        uARough: { value: aRough },
        uGDiff: { value: gDiff },
        uGNor: { value: gNor },
        uGRough: { value: gRough },
      });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nuniform sampler2D uADiff, uANor, uARough, uGDiff, uGNor, uGRough;")
        .replace(
          "#include <normalmap_pars_fragment>",
          `#include <normalmap_pars_fragment>
          // 0 on the tarmac and its run-off, 1 on the grass
          float grassMask() { return smoothstep(12.3, 13.4, abs(vMapUv.x * 72.0 - 36.0)); }
          // the tarmac scan is a 2 m square laid along the road, the grass scan a 15 m square laid on the ground
          vec2 asphaltUv() { return vec2(vMapUv.x * 36.0, vMapUv.y * 9.0); }
          vec2 grassUv() { return vec2(vMapUv.x * 4.8, vMapUv.y * 1.2); }`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          {
            float gm = grassMask();
            float aLum = dot(texture2D(uADiff, asphaltUv()).rgb, vec3(0.3333));
            float gLum = dot(texture2D(uGDiff, vWPos.xz / 15.0).rgb, vec3(0.3333));
            float aMod = clamp(aLum / 0.034, 0.5, 2.1);
            float gMod = clamp(gLum / 0.13, 0.55, 1.8);
            diffuseColor.rgb *= mix(aMod, gMod, gm);
          }`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = roughness;
          {
            float gm = grassMask();
            roughnessFactor *= mix(texture2D(uARough, asphaltUv()).g, texture2D(uGRough, grassUv()).g, gm);
          }`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#ifdef USE_NORMALMAP_TANGENTSPACE
          {
            float gm = grassMask();
            vec3 nA = texture2D(uANor, asphaltUv()).xyz * 2.0 - 1.0;
            vec3 nG = texture2D(uGNor, grassUv()).xyz * 2.0 - 1.0;
            vec3 mapN = normalize(mix(nA, nG, gm));
            mapN.xy *= normalScale;
            normal = normalize(tbn * mapN);
          }
          #endif`,
        );
    };
  } else {
    groundMat.roughness = 0.92;
  }

  // across the road: distance from the centre line, then the height of the terrain there, then u in the ground texture
  const cols = [-SPAN, -52, -FLAT, -20, -12.4, -7.3, -6.8, -3, 0, 3, 6.8, 7.3, 12.4, 20, FLAT, 52, SPAN];
  const rowsPerChunk = low ? 60 : 40;
  const count = track.count;
  const shade = (i: number) => 0.93 + 0.09 * Math.sin(i * 0.037 + 1.3) * Math.sin(i * 0.0113) + 0.04 * Math.sin(i * 0.31);
  for (let start = 0; start < count; start += rowsPerChunk) {
    const end = Math.min(start + rowsPerChunk, count);
    const rows = end - start + 1;
    const pos = new Float32Array(rows * cols.length * 3);
    const uv = new Float32Array(rows * cols.length * 2);
    const colr = new Float32Array(rows * cols.length * 3);
    const idx: number[] = [];
    for (let r = 0; r < rows; r++) {
      const i = start + r;
      const p = track.table[i % count];
      const sh = shade(i);
      for (let c = 0; c < cols.length; c++) {
        const d = cols[c];
        const o = r * cols.length + c;
        pos[o * 3] = p.x + p.rx * d;
        pos[o * 3 + 1] = p.y + terrainDy(d, p.y);
        pos[o * 3 + 2] = p.z + p.rz * d;
        uv[o * 2] = (Math.max(-FLAT, Math.min(FLAT, d)) + FLAT) / (FLAT * 2);
        uv[o * 2 + 1] = (i * track.step) / tex.ROAD.tile;
        // the tarmac and run-off vary slowly along the lap; the outer slopes darken into the distance
        const tone = Math.abs(d) < 12.6 ? sh : 0.86 + 0.2 * (sh - 0.93) + (Math.abs(d) > FLAT ? -0.1 * Math.min(1, (Math.abs(d) - FLAT) / 20) : 0);
        colr[o * 3] = colr[o * 3 + 1] = colr[o * 3 + 2] = tone;
        if (r < rows - 1 && c < cols.length - 1) {
          const a = o;
          const b = o + cols.length;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.BufferAttribute(colr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, groundMat);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // beyond the strip, the land goes on level with the floor of the valley
  const plain = new THREE.Mesh(own(new THREE.PlaneGeometry(6000, 6000)), own(new THREE.MeshStandardMaterial({ color: 0x4d6a3a, roughness: 1 })));
  plain.rotation.x = -Math.PI / 2;
  plain.position.y = GROUND_Y - 0.06;
  plain.receiveShadow = true;
  root.add(plain);
  await yieldFrame();

  // ---------------------------------------------------------------- kerbs, the start line, the pit lane
  const kerbMap = canvasTexture(tex.kerbTexture());
  const kerbMat = own(new THREE.MeshStandardMaterial({ map: kerbMap, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const ribbon = (from: number, to: number, d0: number, d1: number, dy: number, vScale: number, u: [number, number] = [0, 1]): THREE.BufferGeometry => {
    const n = Math.max(2, Math.round((to - from) / track.step) + 1);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k < n; k++) {
      const s = from + k * track.step;
      track.into(s, tp);
      for (const [d, uu] of [[d0, u[0]], [d1, u[1]]] as const) {
        pos.push(tp.x + tp.rx * d, tp.y + dy, tp.z + tp.rz * d);
        uv.push(uu, (k * track.step) / vScale);
      }
      if (k < n - 1) {
        const a = k * 2;
        // the strip faces up whichever way it runs across the road
        if (d1 > d0) idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  // kerbs sit on the inside of every bend, and on the outside where the car runs wide on the way out
  const kerbParts: THREE.BufferGeometry[] = [];
  let runStart = -1;
  let runSide = 0;
  let peak = 0;
  const flush = (endIdx: number) => {
    if (runStart < 0) return;
    const from = runStart * track.step - 8;
    const to = endIdx * track.step + 8;
    if (to - from > 30) {
      kerbParts.push(ribbon(from, to, runSide * 7.0, runSide * 8.4, 0.035, 4.8));
      if (peak > 0.011) kerbParts.push(ribbon((from + to) / 2, to + 26, -runSide * 7.0, -runSide * 8.4, 0.035, 4.8));
    }
    runStart = -1;
    peak = 0;
  };
  let gapCount = 0;
  for (let i = 0; i < count; i++) {
    const k = track.table[i].curv;
    if (Math.abs(k) > 0.0045) {
      const side = k > 0 ? 1 : -1;
      if (runStart >= 0 && side !== runSide) flush(i);
      if (runStart < 0) {
        runStart = i;
        runSide = side;
      }
      peak = Math.max(peak, Math.abs(k));
      gapCount = 0;
    } else if (runStart >= 0 && ++gapCount > 8) flush(i - gapCount);
  }
  flush(count);
  const kerbs = new THREE.Mesh(own(mergeGeometries(kerbParts.map((g) => (g.index ? g.toNonIndexed() : g)), false)!), kerbMat);
  kerbs.receiveShadow = true;
  root.add(kerbs);

  // the start/finish line, and the pit lane with its wall on the right of the main straight
  const lineMat = own(new THREE.MeshStandardMaterial({ map: canvasTexture(tex.lineTexture(), false), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  const line = new THREE.Mesh(own(ribbon(-0.5, 0.5, -6.7, 6.7, 0.02, 1, [0, 1])), lineMat);
  line.receiveShadow = true;
  root.add(line);

  const pit = { from: L - 220, to: 340 };
  const inPit = (s: number) => s >= pit.from || s <= pit.to;
  const pitGeo = own(mergeGeometries([ribbon(pit.from, L, 12.55, 19.6, 0.012, 18, [0.639, 0.641]), ribbon(0, pit.to, 12.55, 19.6, 0.012, 18, [0.639, 0.641])].map((g) => g.toNonIndexed()), false)!);
  const pitLane = new THREE.Mesh(pitGeo, own(new THREE.MeshStandardMaterial({ map: groundMap, roughness: 0.9, color: 0xdde0e4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  pitLane.receiveShadow = true;
  root.add(pitLane);
  await yieldFrame();

  // ---------------------------------------------------------------- barriers, fence and pit wall
  const segs = Math.floor(L / 6);
  const place = (s: number, d: number, extraYaw: number, y: number, out: THREE.Matrix4, sx = 1, sy = 1) => {
    track.into(s, tp);
    const p = new THREE.Vector3(tp.x + tp.rx * d, tp.y + y, tp.z + tp.rz * d);
    out.compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw(tp) + extraYaw), new THREE.Vector3(sx, sy, 1));
    return out;
  };
  const m = new THREE.Matrix4();
  const wallGeo = own(new THREE.BoxGeometry(0.45, 1.05, 6.02));
  const wallMat = own(new THREE.MeshStandardMaterial({ color: 0x8c8f94, roughness: 0.9 }));
  const capGeo = own(new THREE.BoxGeometry(0.56, 0.07, 6.02));
  const capMat = own(new THREE.MeshStandardMaterial({ color: 0xd3d5d8, roughness: 0.8 }));
  const fenceGeo = own(new THREE.PlaneGeometry(6.02, 3.7));
  const fenceMat = own(new THREE.MeshStandardMaterial({ map: canvasTexture(tex.fenceTexture()), transparent: true, alphaTest: 0.03, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }));
  (fenceMat.map as THREE.Texture).repeat.set(6.02 / 0.9, 3.7 / 0.9);
  const postGeo = own(new THREE.BoxGeometry(0.11, 4.9, 0.11));
  const faceGeo = own(new THREE.PlaneGeometry(6.0, 0.98).rotateY(-Math.PI / 2));
  const faceMats = tex.PANELS.map((style) => own(new THREE.MeshStandardMaterial({ map: canvasTexture(tex.panelTexture(style), false), roughness: 0.55 })));

  type Slot = { s: number; side: -1 | 1; panel: number };
  const walls: Slot[] = [];
  const pitWalls: number[] = [];
  for (let k = 0; k < segs; k++) {
    const s = k * 6 + 3;
    for (const side of [-1, 1] as const) {
      if (side === 1 && inPit(s)) {
        pitWalls.push(s);
        continue;
      }
      walls.push({ s, side, panel: (k + (side === 1 ? 2 : 0)) % faceMats.length });
    }
  }
  const wallMesh = own(new THREE.InstancedMesh(wallGeo, wallMat, walls.length));
  const capMesh = own(new THREE.InstancedMesh(capGeo, capMat, walls.length));
  const fenceMesh = own(new THREE.InstancedMesh(fenceGeo, fenceMat, walls.length));
  const postMesh = own(new THREE.InstancedMesh(postGeo, wallMat, walls.length));
  const faceCounts = faceMats.map(() => 0);
  walls.forEach((w) => faceCounts[w.panel]++);
  const faceMeshes = faceMats.map((mat, i) => own(new THREE.InstancedMesh(faceGeo, mat, faceCounts[i])));
  const faceFill = faceMats.map(() => 0);
  walls.forEach((w, i) => {
    const d = w.side * BARRIER_D;
    const flip = w.side === -1 ? Math.PI : 0;
    wallMesh.setMatrixAt(i, place(w.s, d, flip, 0.525, m));
    capMesh.setMatrixAt(i, place(w.s, d, flip, 1.085, m));
    fenceMesh.setMatrixAt(i, place(w.s, d, flip + Math.PI / 2, 1.05 + 1.85, m));
    postMesh.setMatrixAt(i, place(w.s - 3, d, 0, 1.05 + 2.45, m));
    // the face is on the track side: the plane faces -x in the barrier's frame, so the left barrier is turned about
    faceMeshes[w.panel].setMatrixAt(faceFill[w.panel]++, place(w.s, d + (w.side === 1 ? -0.231 : 0.231), flip, 0.54, m));
  });
  for (const mesh of [wallMesh, capMesh, fenceMesh, postMesh, ...faceMeshes]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  fenceMesh.castShadow = !low;
  postMesh.castShadow = !low;
  faceMeshes.forEach((f) => (f.receiveShadow = true));

  // the pit wall: low, with a white top, between the track and the pit lane
  const pitWallGeo = own(new THREE.BoxGeometry(0.5, 1.0, 6.02));
  const pitWallMat = own(new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.7 }));
  const pitWallMesh = own(new THREE.InstancedMesh(pitWallGeo, pitWallMat, pitWalls.length));
  pitWalls.forEach((s, i) => pitWallMesh.setMatrixAt(i, place(s, 11.4, 0, 0.5, m)));
  pitWallMesh.frustumCulled = false;
  pitWallMesh.castShadow = true;
  root.add(pitWallMesh);
  await yieldFrame();

  // ---------------------------------------------------------------- buildings: pit building, gantry, bridges
  const facade = canvasTexture(tex.facadeTexture());
  const buildingMat = own(new THREE.MeshStandardMaterial({ map: facade, roughness: 0.5, metalness: 0.1 }));
  const roofMat = own(new THREE.MeshStandardMaterial({ color: 0xc8ccd1, roughness: 0.7 }));
  const steel = own(new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.6 }));
  const white = own(new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.6 }));

  const pitLen = (L - pit.from) + pit.to;
  const pitMid = wrap(pit.from + pitLen / 2, L);
  {
    const g = new THREE.Group();
    const front = new THREE.Mesh(own(new THREE.BoxGeometry(11, 9.5, pitLen)), buildingMat);
    // the facade texture runs along the building: map its u to length
    const uvs = front.geometry.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setX(i, uvs.getX(i) * (pitLen / 32));
    front.position.set(0, 4.75, 0);
    front.castShadow = true;
    front.receiveShadow = true;
    const roof = new THREE.Mesh(own(new THREE.BoxGeometry(13.5, 0.5, pitLen + 2)), roofMat);
    roof.position.set(-1.2, 9.75, 0);
    roof.castShadow = true;
    g.add(front, roof);
    track.into(pitMid, tp);
    g.position.set(tp.x + tp.rx * 27, tp.y, tp.z + tp.rz * 27);
    // the building's length runs along z, its face (the texture) is on -x, which must face the track
    g.rotation.y = yaw(tp) + 0;
    root.add(g);
    // each bay on the facade faces -x: the box's own -x face is the one with the texture by default only on that side, so turn it to the track
    front.material = buildingMat;
  }

  // start/finish gantry
  const startLamps: THREE.MeshStandardMaterial[] = [];
  {
    track.into(0, tp);
    const g = new THREE.Group();
    const beam = new THREE.Mesh(own(new THREE.BoxGeometry(31, 1.5, 1.4)), steel);
    beam.position.y = 9.1;
    const banner = new THREE.Mesh(own(new THREE.PlaneGeometry(30, 3.75)), own(new THREE.MeshBasicMaterial({ map: canvasTexture(tex.bannerTexture(), false) })));
    banner.position.set(0, 9.1, 0.72);
    // the light rack hangs under the beam, facing the cars on the grid
    const rack = new THREE.Mesh(own(new THREE.BoxGeometry(7, 1.5, 0.5)), own(new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.4 })));
    rack.position.set(0, 7.15, 0.1);
    g.add(beam, banner, rack);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(own(new THREE.BoxGeometry(1.4, 9.6, 1.4)), steel);
      post.position.set(s * 14.3, 4.8, 0);
      post.castShadow = true;
      g.add(post);
    }
    beam.castShadow = true;
    banner.castShadow = true;
    // five lamps, each its own material, so they can come on one by one
    const lampGeo = own(new THREE.SphereGeometry(0.42, 16, 12));
    for (let k = 0; k < 5; k++) {
      const mat = own(new THREE.MeshStandardMaterial({ color: 0x2a0707, emissive: 0xff2015, emissiveIntensity: 0, roughness: 0.35 }));
      startLamps.push(mat);
      const l = new THREE.Mesh(lampGeo, mat);
      l.position.set(-1.1 * 2 + k * 1.1, 7.15, 0.45);
      g.add(l);
    }
    g.position.set(tp.x, tp.y, tp.z);
    g.rotation.y = yaw(tp);
    root.add(g);
  }

  // two bridges over the road
  const bridgeAt = [wrap(track.straight.from + 520, L), wrap(L * 0.6, L)];
  bridgeAt.forEach((s, bi) => {
    track.into(s, tp);
    const g = new THREE.Group();
    const deck = new THREE.Mesh(own(new THREE.BoxGeometry(34, 1.0, 6)), white);
    deck.position.y = 8.4;
    deck.castShadow = true;
    deck.receiveShadow = true;
    const rail = new THREE.Mesh(own(new THREE.BoxGeometry(34, 1.1, 0.12)), steel);
    rail.position.set(0, 9.55, 2.9);
    const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(14, 2.1)), faceMats[(bi * 2 + 1) % faceMats.length]);
    sign.position.set(0, 7.9, 3.02);
    g.add(deck, rail, sign);
    for (const sd of [-1, 1]) {
      const pillar = new THREE.Mesh(own(new THREE.BoxGeometry(1.8, 8.4, 3.4)), white);
      pillar.position.set(sd * 15.3, 4.2, 0);
      pillar.castShadow = true;
      g.add(pillar);
    }
    g.position.set(tp.x, tp.y, tp.z);
    g.rotation.y = yaw(tp);
    root.add(g);
  });
  await yieldFrame();

  // ---------------------------------------------------------------- grandstands
  const crowdMats = tex.CROWDS.map((crowd) => own(new THREE.MeshStandardMaterial({ map: canvasTexture(tex.crowdTexture(crowd)), roughness: 0.92 })));
  const benchMat = own(new THREE.MeshStandardMaterial({ map: canvasTexture(tex.benchTexture()), roughness: 0.9 }));
  const flagGeo = own(new THREE.PlaneGeometry(0.9, 0.58));
  const poleGeo = own(new THREE.CylinderGeometry(0.012, 0.012, 2.4, 5));
  const railMat = own(new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.4, metalness: 0.6 }));
  const hoardGeo = own(new THREE.BoxGeometry(1, 1, 0.08));
  const standGeo = (len: number, tiers: number): { risers: THREE.BufferGeometry; treads: THREE.BufferGeometry; frame: THREE.BufferGeometry } => {
    const riserParts: THREE.BufferGeometry[] = [];
    const treadParts: THREE.BufferGeometry[] = [];
    const frameParts: THREE.BufferGeometry[] = [];
    const rise = 0.48;
    const run = 0.82;
    const clean = (g: THREE.BufferGeometry) => {
      const out = g.index ? g.toNonIndexed() : g;
      for (const name of Object.keys(out.attributes)) if (!["position", "normal", "uv"].includes(name)) out.deleteAttribute(name);
      return out;
    };
    for (let k = 0; k < tiers; k++) {
      // the riser faces the track and carries the crowd; the tread above it is concrete with a bench on it
      const riser = new THREE.PlaneGeometry(len, rise).rotateY(Math.PI);
      riser.translate(0, k * rise + rise / 2, k * run);
      const ruv = riser.attributes.uv;
      for (let i = 0; i < ruv.count; i++) ruv.setX(i, ruv.getX(i) * (len / 16));
      riserParts.push(clean(riser));
      const tread = new THREE.PlaneGeometry(len, run).rotateX(-Math.PI / 2);
      tread.translate(0, (k + 1) * rise, k * run + run / 2);
      const tuv = tread.attributes.uv;
      for (let i = 0; i < tuv.count; i++) tuv.setX(i, tuv.getX(i) * (len / 4));
      treadParts.push(clean(tread));
    }
    const depth = tiers * run;
    const height = tiers * rise;
    // roof, columns, back wall, and the steel rails along the front and the aisles
    frameParts.push(clean(new THREE.BoxGeometry(len + 2, 0.3, depth + 5.5).translate(0, height + 3.7, depth / 2 + 0.6)));
    for (let x = -len / 2; x <= len / 2 + 0.1; x += Math.max(8, len / 6)) frameParts.push(clean(new THREE.BoxGeometry(0.4, height + 3.7, 0.4).translate(x, (height + 3.7) / 2, depth + 2.8)));
    frameParts.push(clean(new THREE.BoxGeometry(len, height + 3.9, 0.3).translate(0, (height + 3.9) / 2, depth + 0.1)));
    return { risers: own(mergeGeometries(riserParts, false)!), treads: own(mergeGeometries(treadParts, false)!), frame: own(mergeGeometries(frameParts, false)!) };
  };
  const stands: { s: number; side: -1 | 1; len: number }[] = [
    { s: wrap(L - 160, L), side: -1, len: 120 },
    { s: 110, side: -1, len: 110 },
  ];
  for (const c of track.corners) {
    if (c.radius < 90) {
      const side = (c.side * -1) as -1 | 1;
      stands.push({ s: c.apex, side, len: c.radius < 45 ? 56 : 80 });
    }
  }
  const flagColours = [0xc9170f, 0xff7a14, 0x1a2a66, 0xf2f2ef, 0xe8c23a, 0x3b5fa8, 0x1f8f5f];
  stands.forEach((st, si) => {
    const tiers = 10;
    const { risers, treads, frame } = standGeo(st.len, tiers);
    const gtr = new THREE.Group();
    const crowd = new THREE.Mesh(risers, crowdMats[si % crowdMats.length]);
    const bench = new THREE.Mesh(treads, benchMat);
    const f = new THREE.Mesh(frame, roofMat);
    for (const m of [crowd, bench, f]) m.castShadow = m.receiveShadow = true;
    gtr.add(crowd, bench, f);
    // a hoarding along the front, with a rail above it
    const hoard = new THREE.Mesh(hoardGeo, faceMats[si % faceMats.length]);
    hoard.scale.set(st.len, 1.0, 1);
    hoard.position.set(0, 0.5, -0.4);
    const rail = new THREE.Mesh(hoardGeo, railMat);
    rail.scale.set(st.len, 0.05, 1);
    rail.position.set(0, 1.12, -0.4);
    gtr.add(hoard, rail);
    // flags and banners over the crowd: poles with a flag each, at random along the rows
    const nFlags = Math.floor(st.len * 0.5);
    const flags = own(new THREE.InstancedMesh(flagGeo, own(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 })), nFlags));
    const poles = own(new THREE.InstancedMesh(poleGeo, railMat, nFlags));
    const colour = new THREE.Color();
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < nFlags; i++) {
      const tier = 1 + Math.floor(rng() * (tiers - 1));
      const x = (rng() - 0.5) * (st.len - 2);
      const z = tier * 0.82 + 0.4;
      const y = tier * 0.48 + 0.5;
      const lean = (rng() - 0.5) * 0.25;
      m4.compose(new THREE.Vector3(x, y + 1.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean)), new THREE.Vector3(1, 1, 1));
      poles.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x + 0.48, y + 2.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rng() - 0.5) * 0.5, lean)), new THREE.Vector3(0.8 + rng() * 0.5, 0.8 + rng() * 0.4, 1));
      flags.setMatrixAt(i, m4);
      flags.setColorAt(i, colour.setHex(flagColours[Math.floor(rng() * flagColours.length)]));
    }
    flags.instanceMatrix.needsUpdate = true;
    poles.instanceMatrix.needsUpdate = true;
    flags.frustumCulled = poles.frustumCulled = false;
    gtr.add(flags, poles);
    track.into(st.s, tp);
    const away = st.side;
    const dd = away * 18.5;
    gtr.position.set(tp.x + tp.rx * dd, tp.y, tp.z + tp.rz * dd);
    // local +z points away from the road, and x runs along it
    gtr.rotation.y = Math.atan2(tp.rx * away, tp.rz * away);
    root.add(gtr);
  });

  // fans standing behind the catch fence, in sections along the lap, so the road has people along it and not just stands
  {
    const fanMat = own(new THREE.MeshBasicMaterial({ map: canvasTexture(tex.standingCrowdTexture()), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    const fanGeo = own(new THREE.PlaneGeometry(14, 2.6));
    const sections: { s: number; side: -1 | 1 }[] = [];
    for (let k = 0; k < segs; k += 4) {
      const sPos = k * 6 + 3;
      for (const side of [-1, 1] as const) {
        if (side === 1 && inPit(sPos)) continue;
        if (stands.some((st) => st.side === side && Math.abs(((sPos - st.s + L * 1.5) % L) - L / 2) < st.len / 2 + 6)) continue;
        if (rng() < 0.55) sections.push({ s: sPos, side });
      }
    }
    const fans = own(new THREE.InstancedMesh(fanGeo, fanMat, sections.length));
    sections.forEach((sec, i) => fans.setMatrixAt(i, place(sec.s, sec.side * 14.6, sec.side === -1 ? Math.PI * 1.5 : Math.PI * 0.5, 1.3, m)));
    fans.frustumCulled = false;
    fans.instanceMatrix.needsUpdate = true;
    root.add(fans);
  }
  await yieldFrame();

  // ---------------------------------------------------------------- trees
  const grid = new Map<string, number[]>();
  const CELL = 40;
  for (let i = 0; i < count; i += 2) {
    const p = track.table[i];
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(i);
  }
  /** Distance from a point to the nearest part of the road, and the sample it is nearest. */
  const nearest = (x: number, z: number): { d: number; i: number } => {
    let best = Infinity;
    let bi = 0;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let gx = cx - 2; gx <= cx + 2; gx++) {
      for (let gz = cz - 2; gz <= cz + 2; gz++) {
        const list = grid.get(`${gx},${gz}`);
        if (!list) continue;
        for (const i of list) {
          const p = track.table[i];
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < best) {
            best = d;
            bi = i;
          }
        }
      }
    }
    return { d: best, i: bi };
  };
  const standZones = stands.map((st) => ({ s: st.s, len: st.len / 2 + 8, side: st.side }));
  const nearStand = (s: number, side: number) => standZones.some((z) => z.side === side && Math.abs(((s - z.s + L * 1.5) % L) - L / 2) < z.len);
  // The trees are scans (Poly Haven, CC0) baked once into pictures with a transparent background and drawn as camera-facing billboards:
  // a few hundred of them are cheap, they keep every leaf and needle of the scan, and they fade into the haze like everything else.
  const SPRITE_ASPECT = [0.833, 0.833, 0.958, 1.137, 1.333, 1.333];
  type Billboard = { x: number; y: number; z: number; h: number };
  const billboards: Billboard[][] = SPRITE_NAMES.map(() => []);
  const target = low ? 360 : 900;
  let tries = 0;
  let placed = 0;
  while (placed < target && tries < target * 14) {
    tries++;
    const i = Math.floor(rng() * count);
    const p = track.table[i];
    const side = rng() < 0.5 ? -1 : 1;
    const d = side * (17 + rng() * rng() * 48);
    if (Math.abs(d) < 20 && nearStand(p.s, side)) continue;
    if (nearStand(p.s, side) && Math.abs(d) < 40) continue;
    if (side === 1 && inPit(p.s) && Math.abs(d) < 46) continue;
    const x = p.x + p.rx * d;
    const z = p.z + p.rz * d;
    const near = nearest(x, z);
    if (near.d < Math.abs(d) - 2.5 || near.d < 16) continue;
    const y = p.y + terrainDy(d, p.y) - 0.25;
    const conifer = rng() < 0.5;
    // a conifer is thin, so two or three stand together; a broadleaf is wide enough alone
    const kind = conifer ? (rng() < 0.5 ? 0 : 1) : rng() < 0.5 ? 2 : 3;
    const copies = conifer ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
    for (let k = 0; k < copies; k++) {
      const jitter = k === 0 ? 0 : 2.6 + rng() * 2.4;
      const ang = rng() * Math.PI * 2;
      billboards[conifer ? (rng() < 0.5 ? 0 : 1) : kind].push({
        x: x + Math.cos(ang) * jitter,
        y,
        z: z + Math.sin(ang) * jitter,
        h: conifer ? 12 + rng() * 8 : 9.5 + rng() * 5.5,
      });
    }
    placed++;
  }
  // low bushes along the foot of the fence break up the line of the barrier
  for (let n = 0; n < (low ? 180 : 520); n++) {
    const i = Math.floor(rng() * count);
    const p = track.table[i];
    const side = rng() < 0.5 ? -1 : 1;
    if (nearStand(p.s, side) || (side === 1 && inPit(p.s))) continue;
    const d = side * (13.4 + rng() * 5);
    const x = p.x + p.rx * d;
    const z = p.z + p.rz * d;
    if (nearest(x, z).d < Math.abs(d) - 2) continue;
    billboards[4 + (rng() < 0.5 ? 0 : 1)].push({ x, y: p.y - 0.05, z, h: 1.3 + rng() * 1.3 });
  }
  sprites.forEach((map, idx) => {
    const list = billboards[idx];
    if (!map || list.length === 0) return;
    const geo = own(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0));
    const mat = own(new THREE.MeshBasicMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, fog: true }));
    // the pictures are lit as in daylight; the picture passes brighten them again, so they start a little darker
    mat.color.setScalar(0.74);
    mat.onBeforeCompile = (shader) => {
      // turn each plane about the vertical axis to face the camera, about its own base
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `vec3 ic = vec3(instanceMatrix[3]);
        float sx = length(instanceMatrix[0].xyz);
        float sy = length(instanceMatrix[1].xyz);
        vec3 toCam = vec3(cameraPosition.x - ic.x, 0.0, cameraPosition.z - ic.z);
        toCam /= max(length(toCam), 0.001);
        vec3 rightV = vec3(toCam.z, 0.0, -toCam.x);
        vec3 wp = ic + rightV * transformed.x * sx + vec3(0.0, transformed.y * sy, 0.0);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;`,
      );
    };
    const mesh = own(new THREE.InstancedMesh(geo, mat, list.length));
    list.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion(), new THREE.Vector3(t.h * SPRITE_ASPECT[idx], t.h, 1));
      mesh.setMatrixAt(i, m);
    });
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  });

  root.add(sun, sun.target, hemi);

  // braking-distance boards before the heavy braking zones
  const boardMats = [300, 200, 100, 50].map((n) => own(new THREE.MeshStandardMaterial({ map: canvasTexture(tex.boardTexture(n), false), roughness: 0.6 })));
  const boardGeo = own(new THREE.BoxGeometry(1.6, 1.6, 0.08));
  const postGeo2 = own(new THREE.BoxGeometry(0.08, 1.6, 0.08));
  for (const c of track.corners) {
    if (c.radius > 70) continue;
    const side = (c.side * -1) as -1 | 1;
    boardMats.forEach((mat, bi) => {
      const s = c.from - [150, 100, 50, 12][bi];
      track.into(s, tp);
      const b = new THREE.Mesh(boardGeo, mat);
      const post = new THREE.Mesh(postGeo2, steel);
      const gtr = new THREE.Group();
      b.position.y = 2.4;
      post.position.y = 0.8;
      gtr.add(b, post);
      // faces the driver (+z in the road's frame), set beside the road outside the barrier
      gtr.position.set(tp.x + tp.rx * side * 13.4, tp.y, tp.z + tp.rz * side * 13.4);
      gtr.rotation.y = yaw(tp);
      root.add(gtr);
    });
  }

  return {
    root,
    sun,
    sunDir,
    hemi,
    followers: [skyDome, ...hillRings],
    skyScene,
    fogColour,
    setStartLights(count, green) {
      startLamps.forEach((mat, k) => {
        const on = green || k < count;
        mat.emissiveIntensity = on ? 7 : 0;
        mat.emissive.setHex(green ? 0x2bd576 : 0xff2015);
        mat.color.setHex(on ? (green ? 0x0a3a1c : 0x4a0a08) : 0x2a0707);
      });
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
