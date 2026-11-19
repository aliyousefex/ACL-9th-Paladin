/**
 * Formula 1 cars, built from code: a lofted nose, monocoque, sidepods, airbox and engine cover; multi-element front and rear wings
 * with end plates; a halo; wishbones and push-rods; slick tyres with covered wheels; a helmet; mirrors; a rain light.
 *
 * The proportions follow a current car (5.6 m long, 2 m wide, 3.6 m wheelbase, 18-inch wheels). The origin is the middle of the
 * wheelbase on the ground, the car points down -z and its right is +x, the same as a three.js camera, so the player's camera sits
 * in the cockpit at EYE and sees what a driver sees: the nose, the front wing, the front tyres and the halo.
 *
 * The liveries are invented colour schemes; they are not any team's, and carry no logos.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface Livery {
  name: string;
  primary: string;
  secondary: string;
  helmet: string;
  ring: string;
}

export const LIVERIES: Livery[] = [
  { name: "scarlet", primary: "#c9170f", secondary: "#f2f2ef", helmet: "#f2f2ef", ring: "#d11a17" },
  { name: "navy", primary: "#1a2a66", secondary: "#e8c23a", helmet: "#e8c23a", ring: "#f0b323" },
  { name: "papaya", primary: "#ff7a14", secondary: "#15171b", helmet: "#15171b", ring: "#f4f4f2" },
  { name: "silver", primary: "#b9c0c9", secondary: "#0fb0a0", helmet: "#0fb0a0", ring: "#f0b323" },
  { name: "green", primary: "#0b5a45", secondary: "#c6e64a", helmet: "#c6e64a", ring: "#d11a17" },
  // the player's own car: carbon black and the product's signal red
  { name: "paladin", primary: "#16171b", secondary: "#e10600", helmet: "#e10600", ring: "#f4f4f2" },
];
export const PLAYER_LIVERY = 5;

/** Where the driver's eyes are, in car space. */
export const EYE = new THREE.Vector3(0, 0.955, -0.02);

const FRONT_AXLE = -1.78;
const REAR_AXLE = 1.82;
const FRONT = { r: 0.335, w: 0.305, x: 0.805 };
const REAR = { r: 0.355, w: 0.405, x: 0.775 };

type RGB = [number, number, number];

const col = (hex: string): RGB => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const smooth = (lo: number, hi: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

interface Section {
  z: number;
  hw: number;
  yb: number;
  yt: number;
  cx?: number;
  nt?: number;
  nb?: number;
}

/** Make sure a geometry has exactly position, normal, colour and uv, so any set of parts can be merged. Parts with no uv sample the atlas's white corner. */
function normalise(g: THREE.BufferGeometry, rgb?: RGB, colour?: (x: number, y: number, z: number) => RGB, keepUv = false): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  if (!keepUv || !geo.attributes.uv) {
    geo.deleteAttribute("uv");
    const flat = new Float32Array(geo.attributes.position.count * 2).fill(0.002);
    geo.setAttribute("uv", new THREE.BufferAttribute(flat, 2));
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.position.count;
  const color = new Float32Array(n * 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < n; i++) {
    const c = colour ? colour(pos.getX(i), pos.getY(i), pos.getZ(i)) : (rgb ?? [1, 1, 1]);
    color[i * 3] = c[0];
    color[i * 3 + 1] = c[1];
    color[i * 3 + 2] = c[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(color, 3));
  return geo;
}

/** The parts of the livery atlas (u, v from the bottom left), each a rectangle [u0, u1, v0, v1]. */
const UV_FUSELAGE: [number, number, number, number] = [0, 1, 0.5, 1];
const UV_DECK: [number, number, number, number] = [0.551, 0.893, 0.5, 1];
/** A small patch of plain carbon in the atlas, which the end caps of every solid are mapped to. */
const CAP_UV: [number, number] = [0.025, 0.025];
const UV_POD: [number, number, number, number] = [0.04, 0.54, 0, 0.5];
const UV_AIRBOX: [number, number, number, number] = [0.54, 0.8, 0, 0.5];

/**
 * A smooth solid through cross-sections along z, each a superellipse. Winding is checked, so it is always outward facing. The seam runs
 * along the underside, where nobody looks, and the surface is mapped for the livery: u along the length, v round the section starting
 * at the bottom, then the right side, the top, the left side.
 */
function loft(sections: Section[], ring: number, colour?: (x: number, y: number, z: number) => RGB, rect: [number, number, number, number] = UV_FUSELAGE): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const [u0, u1, v0, v1] = rect;
  const z0 = sections[0].z;
  const z1 = sections[sections.length - 1].z;
  const stride = ring + 1;
  const pt = (s: Section, k: number): [number, number, number] => {
    const a = ((k / ring) * 2 - 0.5) * Math.PI;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const n = sn >= 0 ? (s.nt ?? 2.5) : (s.nb ?? 4);
    const ym = (s.yb + s.yt) / 2;
    const hh = (s.yt - s.yb) / 2;
    return [(s.cx ?? 0) + s.hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), ym + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n), s.z];
  };
  for (const s of sections) {
    const u = u0 + (u1 - u0) * ((s.z - z0) / (z1 - z0));
    for (let k = 0; k <= ring; k++) {
      pos.push(...pt(s, k % ring));
      uv.push(u, v0 + (v1 - v0) * (k / ring));
    }
  }
  for (let j = 0; j < sections.length - 1; j++) {
    for (let k = 0; k < ring; k++) {
      const a = j * stride + k;
      const b = a + 1;
      const c = (j + 1) * stride + k;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps: their own vertices, all mapped to a small patch of plain carbon in the atlas, so nothing is smeared across it
  for (const [si, flip] of [[0, true], [sections.length - 1, false]] as const) {
    const s = sections[si];
    const centre = pos.length / 3;
    pos.push(s.cx ?? 0, (s.yb + s.yt) / 2, s.z);
    uv.push(CAP_UV[0], CAP_UV[1]);
    const first = pos.length / 3;
    for (let k = 0; k < ring; k++) {
      pos.push(...pt(s, k));
      uv.push(CAP_UV[0], CAP_UV[1]);
    }
    for (let k = 0; k < ring; k++) {
      const a = first + k;
      const b = first + ((k + 1) % ring);
      if (flip) idx.push(centre, a, b);
      else idx.push(centre, b, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  // signed volume: negative means inside out
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    vol +=
      pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) -
      pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) +
      pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (vol < 0) {
    const flipped = idx.slice();
    for (let i = 0; i < flipped.length; i += 3) {
      const t = flipped[i + 1];
      flipped[i + 1] = flipped[i + 2];
      flipped[i + 2] = t;
    }
    geo.setIndex(flipped);
  }
  geo.computeVertexNormals();
  return normalise(geo, undefined, colour, true);
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number, rotX = 0, rotY = 0): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
};

/** A strut between two points with a flat section (chord across, thickness through), the way suspension arms are faired on a current car. */
function strut(a: THREE.Vector3, b: THREE.Vector3, chord: number, thick: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(0.5, 0.5, len, 10, 1);
  // an ellipse: wide in x (the chord), thin in z
  g.scale(chord, 1, thick);
  const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/** A side plate: a polygon in (z, y), extruded across x. */
function plate(points: [number, number][], x: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // the shape lies in (x=z, y), extruded along its own z: turn it so the extrusion runs along x
  g.rotateY(-Math.PI / 2);
  g.translate(x - thickness / 2, 0, 0);
  return g;
}

/** A tyre: a lathe of a rounded cross-section, axis along x. */
function tyre(r: number, w: number): THREE.BufferGeometry {
  const hw = w / 2;
  const prof: THREE.Vector2[] = [
    new THREE.Vector2(r * 0.62, -hw),
    new THREE.Vector2(r * 0.9, -hw),
    new THREE.Vector2(r * 0.985, -hw + 0.03),
    new THREE.Vector2(r, -hw + 0.07),
    new THREE.Vector2(r, hw - 0.07),
    new THREE.Vector2(r * 0.985, hw - 0.03),
    new THREE.Vector2(r * 0.9, hw),
    new THREE.Vector2(r * 0.62, hw),
  ];
  const g = new THREE.LatheGeometry(prof, 32);
  g.rotateZ(Math.PI / 2);
  return g;
}

function wheelParts(r: number, w: number, side: 1 | -1, ringColour: RGB) {
  const outer = side * (w / 2);
  const rubber = normalise(tyre(r, w));
  // the wheel cover: a closed disc just inside the tyre's shoulder, a recessed ring on it, and a hub nut
  const cover = new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.03, 40);
  cover.rotateZ(Math.PI / 2);
  cover.translate(outer - side * 0.03, 0, 0);
  const ringTorus = new THREE.TorusGeometry(r * 0.5, 0.0075, 8, 44);
  ringTorus.rotateY(Math.PI / 2);
  ringTorus.translate(outer - side * 0.012, 0, 0);
  const nut = new THREE.CylinderGeometry(r * 0.11, r * 0.11, 0.07, 6);
  nut.rotateZ(Math.PI / 2);
  nut.translate(outer + side * 0.006, 0, 0);
  const inner = new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.03, 40);
  inner.rotateZ(Math.PI / 2);
  inner.translate(-side * (w / 2) + side * 0.06, 0, 0);
  const metal = mergeGeometries([normalise(cover), normalise(ringTorus), normalise(nut), normalise(inner)], false)!;
  // the compound marking: a ring on the outer sidewall
  const ring = new THREE.RingGeometry(r * 0.73, r * 0.82, 40);
  ring.rotateY(side * Math.PI / 2);
  ring.translate(outer + side * 0.004, 0, 0);
  const marker = normalise(ring, ringColour);
  // the housing: a flared drum behind the inner face with a scoop on top, and cooling vents round the cover
  const innerX = -side * (w / 2);
  const drum = new THREE.CylinderGeometry(r * 0.56, r * 0.5, 0.1, 28);
  drum.rotateZ(Math.PI / 2);
  drum.translate(innerX - side * 0.07, 0, 0);
  const scoop = new THREE.BoxGeometry(0.1, 0.1, 0.17);
  scoop.translate(innerX - side * 0.08, r * 0.56, -r * 0.46);
  const dark: RGB = col("#0d0e11");
  const parts: THREE.BufferGeometry[] = [normalise(drum, dark), normalise(scoop, dark)];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const vent = new THREE.BoxGeometry(0.012, r * 0.1, r * 0.045);
    vent.rotateX(a);
    vent.translate(outer - side * 0.0135, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
    parts.push(normalise(vent, dark));
  }
  const duct = mergeGeometries(parts, false)!;
  return { rubber, metal, marker, duct };
}

export interface CarGeometry {
  body: THREE.BufferGeometry;
  /** Livery-independent parts. */
  carbon: THREE.BufferGeometry;
  rubber: THREE.BufferGeometry;
  metal: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  /** The driver's helmet, white with a dark visor: it takes its colour from its material, so each driver can have their own. */
  helmet?: THREE.BufferGeometry;
}

export interface WheelSet {
  rubber: THREE.BufferGeometry;
  metal: THREE.BufferGeometry;
  marker: THREE.BufferGeometry;
  /** The carbon brake-duct housing on the inside of the wheel. */
  duct: THREE.BufferGeometry;
}

const T = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.clone().translate(x, y, z);

/** The sponsors on the cars are the product's own words, as on the barriers; there are no real brands anywhere. */
const SPONSORS = ["PALADIN", "PODIUM CALL", "CUTOFF", "EVIDENCE", "LIGHTS OUT"];

const luma = (hex: string) => {
  const [r, g, b] = col(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * One team's paint, as a single picture laid over the whole car: the monocoque in the top half (length across, round the section up),
 * the sidepods and the airbox in the bottom half. A white corner is left for the parts that have no map of their own.
 * Text on the right side is set back to front, and on the left upside down, so that it reads correctly on the car.
 */
export function liveryAtlas(l: Livery, index: number, size = 2048): HTMLCanvasElement {
  const W = size;
  const H = size / 2;
  const RH = H / 2;
  const k = W / 2048;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const dark = "#0d0e11";
  const textOn = (bg: string) => (luma(bg) > 0.28 ? "#101216" : "#f4f4f2");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  const font = (px: number) => `700 ${Math.round(px)}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
  const sideText = (text: string, cx: number, cy: number, h: number, color: string, side: "left" | "right") => {
    g.save();
    g.translate(cx, cy);
    g.scale(side === "right" ? -1 : 1, side === "left" ? -1 : 1);
    g.fillStyle = color;
    g.font = font(h);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, 0);
    g.restore();
  };

  // a patch of carbon for the end caps, inside the white corner (which stays white where the parts without a map sample it)
  g.fillStyle = dark;
  g.fillRect(0.02 * W, H - 0.04 * H, 0.012 * W, 0.03 * H);

  // ---- the monocoque: y runs 0..RH, with the section's v measured up from the underside (right side 0.25, top 0.5, left 0.75)
  g.save();
  g.beginPath();
  g.rect(0, 0, W, RH);
  g.clip();
  const fy = (v: number) => RH * (1 - v);
  g.fillStyle = l.primary;
  g.fillRect(0, 0, W, RH);
  // the underside is carbon, with a soft edge
  for (const [a, b] of [[0, 0.16], [1, 0.84]] as const) {
    const grad = g.createLinearGradient(0, fy(a), 0, fy(b));
    grad.addColorStop(0, dark);
    grad.addColorStop(0.7, dark);
    grad.addColorStop(1, "rgba(13,14,17,0)");
    g.fillStyle = grad;
    g.fillRect(0, Math.min(fy(a), fy(b)), W, Math.abs(fy(a) - fy(b)));
  }
  // a stripe down the nose and over the cover, with a thin dark keyline
  g.fillStyle = dark;
  g.fillRect(0.05 * W, fy(0.545), 0.62 * W, fy(0.455) - fy(0.545));
  g.fillStyle = l.secondary;
  g.fillRect(0.05 * W, fy(0.535), 0.62 * W, fy(0.465) - fy(0.535));
  // the tip of the nose
  g.fillStyle = l.secondary;
  g.fillRect(0, 0, 0.045 * W, RH);
  // a swept accent along each side, narrowing towards the nose
  for (const v of [0.25, 0.75]) {
    g.fillStyle = l.secondary;
    g.beginPath();
    g.moveTo(0.06 * W, fy(v) - 4 * k);
    g.lineTo(0.37 * W, fy(v) - 0.05 * RH);
    g.lineTo(0.37 * W, fy(v) + 0.05 * RH);
    g.lineTo(0.06 * W, fy(v) + 4 * k);
    g.closePath();
    g.fill();
  }
  // a sponsor panel on each side of the cockpit, set in the team's second colour
  for (const [v, side] of [[0.25, "right"], [0.75, "left"]] as const) {
    g.fillStyle = l.secondary;
    g.fillRect(0.4 * W, fy(v) - 0.1 * RH, 0.2 * W, 0.2 * RH);
    sideText(SPONSORS[index % SPONSORS.length], 0.5 * W, fy(v), 0.115 * RH, textOn(l.secondary), side);
  }
  // the tail fades to carbon
  const tail = g.createLinearGradient(0.82 * W, 0, W, 0);
  tail.addColorStop(0, "rgba(13,14,17,0)");
  tail.addColorStop(1, dark);
  g.fillStyle = tail;
  g.fillRect(0.82 * W, 0, 0.18 * W, RH);
  g.restore();

  // ---- the sidepods: u 0.04 to 0.54, y RH..H, v measured the same way
  g.save();
  g.beginPath();
  g.rect(0.04 * W, RH, 0.5 * W, RH);
  g.clip();
  const podX = (u: number) => (0.04 + 0.5 * u) * W;
  const py = (v: number) => H - v * RH;
  g.fillStyle = l.primary;
  g.fillRect(0.04 * W, RH, 0.5 * W, RH);
  for (const [a, b] of [[0, 0.17], [1, 0.83]] as const) {
    const grad = g.createLinearGradient(0, py(a), 0, py(b));
    grad.addColorStop(0, dark);
    grad.addColorStop(0.75, dark);
    grad.addColorStop(1, "rgba(13,14,17,0)");
    g.fillStyle = grad;
    g.fillRect(0.04 * W, Math.min(py(a), py(b)), 0.5 * W, Math.abs(py(a) - py(b)));
  }
  // the cooling inlet at the front: a dark mouth with a lip in the second colour
  g.fillStyle = dark;
  g.fillRect(podX(0), RH, 0.07 * 0.5 * W, RH);
  g.fillStyle = l.secondary;
  for (const v of [0.25, 0.75]) g.fillRect(podX(0.07), py(v) - 0.22 * RH, 0.012 * W, 0.44 * RH);
  // sponsors on the outside of each pod, and a stripe along its shoulder
  for (const [v, side] of [[0.25, "right"], [0.75, "left"]] as const) {
    g.fillStyle = l.secondary;
    g.fillRect(podX(0.3), py(v + 0.17), 0.34 * 0.5 * W, 0.04 * RH);
    g.fillStyle = "rgba(244,244,242,0.94)";
    g.fillRect(podX(0.34), py(v) - 0.12 * RH, 0.4 * 0.5 * W, 0.24 * RH);
    sideText(SPONSORS[(index + 1) % SPONSORS.length], podX(0.54), py(v), 0.14 * RH, "#14161a", side);
    g.fillStyle = l.secondary;
    g.fillRect(podX(0.34), py(v) + 0.12 * RH, 0.4 * 0.5 * W, 0.02 * RH);
  }
  const podTail = g.createLinearGradient(podX(0.78), 0, podX(1), 0);
  podTail.addColorStop(0, "rgba(13,14,17,0)");
  podTail.addColorStop(1, dark);
  g.fillStyle = podTail;
  g.fillRect(podX(0.78), RH, podX(1) - podX(0.78), RH);
  g.restore();

  // ---- the airbox: u 0.54 to 0.8
  g.save();
  g.beginPath();
  g.rect(0.54 * W, RH, 0.26 * W, RH);
  g.clip();
  g.fillStyle = l.primary;
  g.fillRect(0.54 * W, RH, 0.26 * W, RH);
  g.fillStyle = l.secondary;
  g.fillRect(0.54 * W, py(0.535), 0.26 * W, py(0.465) - py(0.535));
  g.fillStyle = dark;
  g.fillRect(0.54 * W, RH, 0.05 * W, RH);
  g.restore();

  return c;
}

/** The race numbers as a grid of cells, 8 across: white with a dark outline, for the plates on the fin and the nose. */
export function numberAtlas(numbers: readonly number[]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 1024, 512);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "700 104px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  numbers.forEach((n, i) => {
    const x = (i % 8) * 128 + 64;
    const y = Math.floor(i / 8) * 128 + 68;
    g.lineWidth = 12;
    g.strokeStyle = "rgba(10,10,12,0.95)";
    g.strokeText(String(n), x, y);
    g.fillStyle = "#f6f6f3";
    g.fillText(String(n), x, y);
  });
  return c;
}

/** The uv rectangle of a number's cell in the atlas, as [u0, u1, v0, v1]. */
export function numberCell(numbers: readonly number[], n: number): [number, number, number, number] {
  const i = Math.max(0, numbers.indexOf(n));
  const col0 = i % 8;
  const row = Math.floor(i / 8);
  return [col0 / 8, (col0 + 1) / 8, 1 - (row + 1) / 4, 1 - row / 4];
}

/** Where the race number goes: a plate each side of the fin, and one on the nose. Plain data, so the scene can lay a plane on each. */
export const NUMBER_PLATES: { x: number; y: number; z: number; rx: number; ry: number; w: number; h: number }[] = [
  { x: 0.0085, y: 0.8, z: 1.62, rx: 0, ry: Math.PI / 2, w: 0.3, h: 0.19 },
  { x: -0.0085, y: 0.8, z: 1.62, rx: 0, ry: -Math.PI / 2, w: 0.3, h: 0.19 },
  { x: 0, y: 0.417, z: -1.62, rx: -Math.PI / 2 + 0.17, ry: 0, w: 0.2, h: 0.13 },
];

/** The helmet: white with a dark visor, so that its material's colour is the driver's. */
function helmetGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.145, 22, 16).scale(0.95, 1, 1.12).translate(0, 0.83, 0.2);
  const visor = col("#10151c");
  return normalise(g, undefined, (x, y, z) => (z < 0.13 && Math.abs(x) < 0.096 && y > 0.815 && y < 0.925 ? visor : ([1, 1, 1] as RGB)));
}

/** Build the geometry of one car in a livery. `frontWheels: false` leaves the front wheels out (the player's are separate, to steer). */
export function buildCarGeometry(livery: Livery, frontWheels: boolean, withHelmet: boolean): { geo: CarGeometry; frontWheelSets: [WheelSet, WheelSet] } {
  const primary = col(livery.primary);
  const secondary = col(livery.secondary);
  const carbon = col("#0d0e11");
  const dark = col("#050506");
  const bodyParts: THREE.BufferGeometry[] = [];
  const carbonParts: THREE.BufferGeometry[] = [];
  const rubberParts: THREE.BufferGeometry[] = [];
  const metalParts: THREE.BufferGeometry[] = [];
  // shading in the vertex colours only: darker underneath and where surfaces meet (the paint itself is the atlas)
  const ao = (y: number, z: number): RGB => {
    const v = 1 - 0.5 * smooth(0.34, 0.12, y) - 0.1 * smooth(1.9, 2.5, z);
    return [v, v, v];
  };

  // ---- monocoque, nose
  const fuselage: Section[] = [
    { z: -2.62, hw: 0.055, yb: 0.205, yt: 0.29 },
    { z: -2.3, hw: 0.085, yb: 0.185, yt: 0.335 },
    { z: -1.9, hw: 0.125, yb: 0.165, yt: 0.4 },
    { z: -1.4, hw: 0.185, yb: 0.13, yt: 0.47 },
    { z: -0.95, hw: 0.255, yb: 0.105, yt: 0.545 },
    { z: -0.55, hw: 0.3, yb: 0.1, yt: 0.6 },
    { z: -0.15, hw: 0.33, yb: 0.095, yt: 0.63 },
    { z: 0.35, hw: 0.345, yb: 0.095, yt: 0.67 },
    { z: 0.85, hw: 0.32, yb: 0.1, yt: 0.745 },
    { z: 1.4, hw: 0.25, yb: 0.12, yt: 0.74 },
    { z: 1.95, hw: 0.16, yb: 0.15, yt: 0.58 },
    { z: 2.38, hw: 0.09, yb: 0.19, yt: 0.43 },
    { z: 2.5, hw: 0.055, yb: 0.23, yt: 0.38 },
  ];
  bodyParts.push(loft(fuselage, 26, (_x, y, z) => ao(y, z), UV_FUSELAGE));
  // the deck between the pods and behind the cockpit: the shoulders of the engine cover, which join the pods to the spine
  bodyParts.push(
    loft(
      [
        { z: 0.2, hw: 0.37, yb: 0.45, yt: 0.64, nt: 2.2 },
        { z: 0.7, hw: 0.5, yb: 0.4, yt: 0.665, nt: 2.2 },
        { z: 1.2, hw: 0.47, yb: 0.36, yt: 0.62, nt: 2.2 },
        { z: 1.6, hw: 0.36, yb: 0.3, yt: 0.5, nt: 2.2 },
        { z: 1.95, hw: 0.2, yb: 0.2, yt: 0.42, nt: 2.2 },
      ],
      22,
      (_x, y, z) => ao(y, z),
      UV_DECK,
    ),
  );
  // sidepods: an inlet at the front, an undercut along the bottom, and a coke-bottle taper to the rear
  for (const side of [-1, 1]) {
    const pod: Section[] = [
      { z: -0.62, hw: 0.155, yb: 0.15, yt: 0.5, cx: side * 0.5, nb: 3 },
      { z: -0.3, hw: 0.19, yb: 0.13, yt: 0.55, cx: side * 0.5, nb: 3 },
      { z: 0.3, hw: 0.21, yb: 0.165, yt: 0.53, cx: side * 0.5, nb: 3 },
      { z: 0.95, hw: 0.19, yb: 0.17, yt: 0.44, cx: side * 0.495, nb: 3 },
      { z: 1.55, hw: 0.135, yb: 0.15, yt: 0.33, cx: side * 0.46, nb: 3 },
      { z: 2.05, hw: 0.065, yb: 0.15, yt: 0.24, cx: side * 0.42, nb: 3 },
    ];
    bodyParts.push(loft(pod, 20, (_x, y, z) => ao(y, z), UV_POD));
  }
  // airbox above the driver's head, with its intake
  bodyParts.push(
    loft(
      [
        { z: 0.3, hw: 0.1, yb: 0.6, yt: 0.82 },
        { z: 0.55, hw: 0.15, yb: 0.62, yt: 1.0 },
        { z: 0.9, hw: 0.14, yb: 0.66, yt: 0.92 },
        { z: 1.4, hw: 0.09, yb: 0.7, yt: 0.78 },
      ],
      16,
      (_x, y, z) => ao(y, z),
      UV_AIRBOX,
    ),
  );
  // the shark fin along the spine, and a T-wing on it
  for (const part of [
    normalise(plate([[1.3, 0.8], [1.38, 0.97], [2.2, 0.8], [2.42, 0.5], [1.5, 0.56]], 0, 0.014), primary),
    normalise(box(0.34, 0.01, 0.11, 0, 0.9, 2.12, 0.04), secondary),
  ]) bodyParts.push(part);
  // the cockpit opening, dark
  carbonParts.push(normalise(new THREE.SphereGeometry(1, 16, 8).scale(0.17, 0.02, 0.36).translate(0, 0.658, 0.12), dark));

  // ---- halo: a central pillar and two arms sweeping back to the sides of the cockpit
  const tube = (pts: [number, number, number][], r: number) =>
    normalise(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 20, r, 8, false));
  const arm = (s: number) => tube([[0, 1.08, -0.7], [s * 0.1, 1.09, -0.63], [s * 0.22, 1.07, -0.44], [s * 0.31, 0.98, -0.14], [s * 0.345, 0.8, 0.2], [s * 0.34, 0.68, 0.38]], 0.011);
  metalParts.push(tube([[0, 0.55, -0.95], [0, 0.82, -0.83], [0, 1.08, -0.7]], 0.012), arm(-1), arm(1));
  {
    // the pillar's carbon fairing: long fore and aft, narrow across, leaning back like the pillar itself
    const base = new THREE.Vector3(0, 0.57, -0.94);
    const top = new THREE.Vector3(0, 1.06, -0.71);
    const len = base.distanceTo(top);
    const fairing = new THREE.CapsuleGeometry(0.019, len - 0.038, 4, 10);
    fairing.scale(0.78, 1, 1.9);
    fairing.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize()));
    const mid = base.clone().add(top).multiplyScalar(0.5);
    fairing.translate(mid.x, mid.y, mid.z);
    carbonParts.push(normalise(fairing, carbon));
    // the rear mounts where each arm meets the monocoque
    for (const sd of [-1, 1]) carbonParts.push(normalise(box(0.05, 0.06, 0.1, sd * 0.34, 0.66, 0.4), carbon));
  }

  // ---- mirrors on faired stalks, with glass
  for (const s of [-1, 1]) {
    bodyParts.push(normalise(box(0.15, 0.075, 0.085, s * 0.7, 0.6, -0.42), primary));
    carbonParts.push(normalise(box(0.013, 0.065, 0.075, s * 0.7, 0.6, -0.375), dark));
    carbonParts.push(normalise(strut(new THREE.Vector3(s * 0.5, 0.53, -0.4), new THREE.Vector3(s * 0.64, 0.58, -0.42), 0.03, 0.01), carbon));
  }

  // ---- bargeboards and turning vanes ahead of the sidepods, and the floor with its edge fences
  for (const s of [-1, 1]) {
    [0.36, 0.45, 0.54, 0.63].forEach((x, i) => {
      carbonParts.push(normalise(plate([[-0.95 + i * 0.05, 0.12], [-0.5 + i * 0.03, 0.1], [-0.46 + i * 0.03, 0.36 - i * 0.02], [-0.8 + i * 0.05, 0.31 - i * 0.02]], s * x, 0.008), carbon));
    });
    carbonParts.push(normalise(plate([[-0.9, 0.07], [1.95, 0.07], [1.95, 0.16], [1.0, 0.13], [-0.9, 0.1]], s * 0.69, 0.009), carbon));
  }
  carbonParts.push(normalise(box(1.38, 0.014, 3.3, 0, 0.066, 0.55), carbon));

  // ---- front wing: a main plane and three flaps, cascades, end plates with a footplate, and the pylons that hold it to the nose
  const fw: THREE.BufferGeometry[] = [
    box(1.96, 0.02, 0.4, 0, 0.085, -2.86),
    box(1.9, 0.018, 0.27, 0, 0.15, -2.72, 0.2),
    box(1.8, 0.016, 0.21, 0, 0.215, -2.6, 0.34),
    box(1.52, 0.014, 0.17, 0, 0.275, -2.5, 0.5),
  ];
  carbonParts.push(...fw.map((g) => normalise(g, carbon)));
  for (const s of [-1, 1]) {
    bodyParts.push(normalise(plate([[-3.1, 0.03], [-2.3, 0.03], [-2.3, 0.07], [-3.1, 0.07]], s * 0.985, 0.014), secondary));
    bodyParts.push(normalise(plate([[-3.08, 0.07], [-2.34, 0.07], [-2.34, 0.17], [-2.55, 0.31], [-3.08, 0.26]], s * 0.985, 0.014), primary));
    // the cascade winglets inboard of the end plate
    for (const x of [0.76, 0.86]) carbonParts.push(normalise(plate([[-2.97, 0.1], [-2.55, 0.1], [-2.55, 0.23], [-2.8, 0.22], [-2.97, 0.17]], s * x, 0.009), carbon));
    carbonParts.push(normalise(strut(new THREE.Vector3(s * 0.07, 0.22, -2.3), new THREE.Vector3(s * 0.07, 0.11, -2.72), 0.03, 0.012), carbon));
  }

  // ---- rear wing: a main plane, a DRS flap held a little open, louvred end plates, twin pylons, beam wing, diffuser with strakes
  carbonParts.push(
    normalise(box(0.98, 0.02, 0.34, 0, 0.9, 2.33, -0.08), carbon),
    normalise(box(0.98, 0.016, 0.23, 0, 0.985, 2.44, -0.38), carbon),
    normalise(box(0.98, 0.008, 0.04, 0, 0.918, 2.5), carbon),
    normalise(box(0.86, 0.014, 0.2, 0, 0.52, 2.42, -0.05), carbon),
    normalise(box(0.86, 0.014, 0.16, 0, 0.585, 2.47, -0.15), carbon),
    normalise(box(0.96, 0.016, 0.74, 0, 0.17, 2.2, -0.28), carbon),
    normalise(box(0.3, 0.15, 0.4, 0, 0.42, 2.34), carbon),
  );
  for (const x of [-0.04, 0.04]) carbonParts.push(normalise(box(0.022, 0.4, 0.15, x, 0.7, 2.2), carbon));
  for (const x of [-0.31, -0.14, 0.14, 0.31]) carbonParts.push(normalise(box(0.01, 0.11, 0.7, x, 0.19, 2.2, -0.28), carbon));
  for (const s of [-1, 1]) {
    bodyParts.push(normalise(plate([[1.96, 0.56], [2.68, 0.56], [2.68, 1.05], [2.3, 1.1], [2.0, 0.97]], s * 0.49, 0.014), primary));
    bodyParts.push(normalise(plate([[2.0, 0.97], [2.3, 1.1], [2.68, 1.05], [2.68, 0.97], [2.3, 1.02], [2.04, 0.9]], s * 0.4955, 0.006), secondary));
    // louvres cut into the end plate, drawn as three dark slots
    for (let i = 0; i < 3; i++) carbonParts.push(normalise(box(0.004, 0.028, 0.26, s * 0.499, 0.68 + i * 0.07, 2.4), dark));
  }
  carbonParts.push(normalise(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 10).rotateX(Math.PI / 2).translate(0, 0.5, 2.46), dark));

  // ---- wishbones, push-rods and the rear suspension, faired
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const s of [-1, 1]) {
    const hub = FRONT.x * s;
    const arms: [THREE.Vector3, THREE.Vector3][] = [
      [v(s * 0.17, 0.3, FRONT_AXLE + 0.17), v(hub * 0.84, 0.39, FRONT_AXLE)],
      [v(s * 0.17, 0.3, FRONT_AXLE - 0.2), v(hub * 0.84, 0.39, FRONT_AXLE)],
      [v(s * 0.17, 0.17, FRONT_AXLE + 0.2), v(hub * 0.84, 0.27, FRONT_AXLE)],
      [v(s * 0.17, 0.17, FRONT_AXLE - 0.22), v(hub * 0.84, 0.27, FRONT_AXLE)],
      [v(hub * 0.84, 0.4, FRONT_AXLE), v(s * 0.1, 0.5, FRONT_AXLE + 0.28)],
      [v(s * 0.2, 0.22, FRONT_AXLE + 0.12), v(hub * 0.84, 0.29, FRONT_AXLE + 0.1)],
      [v(s * 0.16, 0.27, REAR_AXLE - 0.28), v(REAR.x * s * 0.8, 0.37, REAR_AXLE)],
      [v(s * 0.16, 0.27, REAR_AXLE + 0.26), v(REAR.x * s * 0.8, 0.37, REAR_AXLE)],
      [v(s * 0.16, 0.16, REAR_AXLE - 0.25), v(REAR.x * s * 0.8, 0.3, REAR_AXLE)],
      [v(REAR.x * s * 0.8, 0.4, REAR_AXLE), v(s * 0.1, 0.5, REAR_AXLE - 0.3)],
    ];
    for (const [a, b] of arms) carbonParts.push(normalise(strut(a, b, 0.042, 0.012), carbon));
  }

  // ---- wheels
  const ringColour = col(livery.ring);
  const frontSets = [wheelParts(FRONT.r, FRONT.w, -1, ringColour), wheelParts(FRONT.r, FRONT.w, 1, ringColour)] as [WheelSet, WheelSet];
  const rearSets = [wheelParts(REAR.r, REAR.w, -1, ringColour), wheelParts(REAR.r, REAR.w, 1, ringColour)];
  rearSets.forEach((w, i) => {
    const x = i === 0 ? -REAR.x : REAR.x;
    carbonParts.push(T(w.duct, x, REAR.r, REAR_AXLE));
    rubberParts.push(T(w.rubber, x, REAR.r, REAR_AXLE));
    metalParts.push(T(w.metal, x, REAR.r, REAR_AXLE));
    bodyParts.push(T(w.marker, x, REAR.r, REAR_AXLE));
  });
  if (frontWheels) {
    frontSets.forEach((w, i) => {
      const x = i === 0 ? -FRONT.x : FRONT.x;
      carbonParts.push(T(w.duct, x, FRONT.r, FRONT_AXLE));
      rubberParts.push(T(w.rubber, x, FRONT.r, FRONT_AXLE));
      metalParts.push(T(w.metal, x, FRONT.r, FRONT_AXLE));
      bodyParts.push(T(w.marker, x, FRONT.r, FRONT_AXLE));
    });
  }

  const glow = normalise(box(0.1, 0.07, 0.012, 0, 0.56, 2.575), col("#ff2a1c"));
  return {
    geo: {
      body: mergeGeometries(bodyParts, false)!,
      carbon: mergeGeometries(carbonParts, false)!,
      rubber: mergeGeometries(rubberParts, false)!,
      metal: mergeGeometries(metalParts, false)!,
      glow,
      helmet: withHelmet ? helmetGeometry() : undefined,
    },
    frontWheelSets: frontSets,
  };
}

/** Where the front wheels' centres are, for the player's steering. */
export const FRONT_WHEEL = { x: FRONT.x, y: FRONT.r, z: FRONT_AXLE };

/** A twill carbon weave, one tile, drawn in code. */
function weaveTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const img = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      // a 2x2 twill: each tow is 4 px, and over-and-under steps along the diagonal
      const warp = (Math.floor(x / 4) + Math.floor(y / 4)) % 4 < 2;
      const across = warp ? Math.sin((((x % 4) + 0.5) / 4) * Math.PI) : Math.sin((((y % 4) + 0.5) / 4) * Math.PI);
      const v = Math.round(255 * (0.3 + 0.7 * across * (warp ? 1 : 0.78)));
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

let weave: THREE.CanvasTexture | null = null;

/**
 * Lay the weave over the dark parts of a material, mapped in the car's own space (so it needs no UV coordinates) and blended by the
 * surface's direction. Only paint that is nearly black takes it: the liveries' colours are left alone.
 */
function withCarbon<T extends THREE.MeshStandardMaterial>(material: T, strength: number): T {
  weave ??= weaveTexture();
  const map = weave;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWeave = { value: map };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNor;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjPos = position;\nvObjNor = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNor;\nuniform sampler2D uWeave;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 an = pow(abs(normalize(vObjNor)), vec3(4.0));
          an /= (an.x + an.y + an.z);
          float w = texture2D(uWeave, vObjPos.zy * 30.0).r * an.x + texture2D(uWeave, vObjPos.xz * 30.0).r * an.y + texture2D(uWeave, vObjPos.xy * 30.0).r * an.z;
          float dark = 1.0 - smoothstep(0.015, 0.1, dot(diffuseColor.rgb, vec3(0.3333)));
          diffuseColor.rgb *= mix(1.0, (0.35 + 1.5 * w), dark * ${strength.toFixed(2)});
        }`,
      );
  };
  return material;
}

export interface CarMaterials {
  body: THREE.MeshStandardMaterial;
  carbon: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
}

/** A livery's paint as a texture: one picture over the whole car. */
export function liveryTexture(index: number, size: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(liveryAtlas(LIVERIES[index], index, size));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A car's bodywork: the livery over lit paint (shaded in its vertex colours), with the carbon weave on whatever is nearly black. */
export function bodyMaterial(map: THREE.Texture, gloss: boolean): THREE.MeshStandardMaterial {
  const m = gloss
    ? new THREE.MeshPhysicalMaterial({ map, vertexColors: true, metalness: 0.18, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.07 })
    : new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.42, metalness: 0.3, envMapIntensity: 0.7 });
  return withCarbon(m, 0.9);
}

/** The player's car is matte carbon: seen up close from inside, a glossy coat only shows the sun's glare. */
export function playerMaterials(base: CarMaterials, map: THREE.Texture): CarMaterials {
  return { ...base, body: bodyMaterial(map, false) };
}

export function carMaterials(): CarMaterials {
  return {
    body: withCarbon(new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.12, roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.12 }), 0.8),
    carbon: withCarbon(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.4 }), 1),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 0.4, metalness: 0.85 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
}

export interface BuiltCar {
  group: THREE.Group;
  body: THREE.Mesh;
  /** The wheels that turn with the steering, when the car was built with separate front wheels. */
  frontWheels: THREE.Group[];
}

/** One car as a group of five meshes. The geometry may be shared between cars of the same livery. */
export function assembleCar(geo: CarGeometry, mats: CarMaterials, shadow: boolean): BuiltCar {
  const group = new THREE.Group();
  const meshes: [THREE.BufferGeometry, THREE.Material, boolean][] = [
    [geo.body, mats.body, true],
    [geo.carbon, mats.carbon, true],
    [geo.rubber, mats.rubber, true],
    [geo.metal, mats.metal, true],
    [geo.glow, mats.glow, false],
  ];
  let body!: THREE.Mesh;
  for (const [g, m, casts] of meshes) {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = shadow && casts;
    mesh.receiveShadow = shadow && m === mats.body;
    group.add(mesh);
    if (m === mats.body) body = mesh;
  }
  return { group, body, frontWheels: [] };
}

/** Sidewall markings: the compound and size, in the way they are printed on a tyre. The words are generic, not a maker's. */
function sidewallTexture(compound: { band: string; name: string }): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = compound.band;
  g.fillRect(0, 44, 512, 40);
  g.fillStyle = "rgba(244,244,242,0.92)";
  g.font = "700 40px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  g.textBaseline = "middle";
  g.fillText(compound.name.toUpperCase(), 22, 66);
  g.font = "600 30px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  g.textAlign = "right";
  g.fillText("C3  18", 492, 66);
  g.textAlign = "left";
  g.fillStyle = "rgba(244,244,242,0.55)";
  g.font = "600 22px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  g.fillText("TUBELESS  ·  SLICK  ·  MADE FOR RACING", 22, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The player's front wheels: each a group that can be turned about its own vertical axis. */
export function frontWheelGroups(sets: [WheelSet, WheelSet], mats: CarMaterials): THREE.Group[] {
  const decal = sidewallTexture({ band: "#d11a17", name: "Soft" });
  const decalMat = new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const decalGeo = new THREE.PlaneGeometry(0.3, 0.075);
  return sets.map((set, i) => {
    const g = new THREE.Group();
    const x = i === 0 ? -FRONT.x : FRONT.x;
    g.position.set(x, FRONT.r, FRONT_AXLE);
    const parts: [THREE.BufferGeometry, THREE.Material][] = [
      [set.rubber, mats.rubber],
      [set.metal, mats.metal],
      [set.marker, mats.body],
      [set.duct, mats.carbon],
    ];
    for (const [geo, m] of parts) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = m !== mats.body;
      g.add(mesh);
    }
    // the writing on the inside sidewall, which is the face the driver sees
    const side = i === 0 ? 1 : -1;
    const label = new THREE.Mesh(decalGeo, decalMat);
    label.position.set(side * (FRONT.w / 2 + 0.0025), FRONT.r * 0.78, -0.02);
    label.rotation.set(0, side * Math.PI / 2, -side * 0.2);
    g.add(label);
    return g;
  });
}


/** Racing-glove leather: a perforated palm-side pattern with stitched seams. Used as colour and as bump. */
function gloveTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1c1d22";
  g.fillRect(0, 0, 256, 256);
  // fine leather grain
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${40 + (i % 5) * 8},${40 + (i % 5) * 8},${46 + (i % 5) * 8},0.22)`;
    g.fillRect((i * 97) % 256, (i * 53) % 256, 2, 2);
  }
  // perforations: rows of small dark holes with a lighter rim, offset on alternate rows
  for (let y = 10; y < 256; y += 12) {
    for (let x = ((y / 12) % 2) * 6 + 4; x < 256; x += 12) {
      g.fillStyle = "rgba(0,0,0,0.85)";
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(90,92,100,0.5)";
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(x, y, 3.4, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // stitched seams, running across and along
  g.strokeStyle = "rgba(226,226,222,0.85)";
  g.lineWidth = 1.6;
  g.setLineDash([5, 4]);
  for (const y of [64, 192]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, 256);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A fireproof sleeve: fine ribbing along the arm, a seam, and a red band at the cuff end. */
function suitTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1d1e23";
  g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = y % 6 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.22)";
    g.fillRect(0, y, 128, 1.5);
  }
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect((i * 71) % 128, (i * 37) % 256, 1, 1);
  }
  g.fillStyle = "#c8140c";
  g.fillRect(0, 12, 128, 14);
  g.fillStyle = "#f2f2ef";
  g.fillRect(0, 30, 128, 3);
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(8, 0);
  g.lineTo(8, 256);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface SteeringWheel {
  group: THREE.Group;
  /** The part that turns with the steering. */
  rim: THREE.Group;
  /** Turn the wheel (radians): the hands go with it and the forearms follow them. */
  steer(angle: number): void;
  /** Redraw the display and the shift lights. */
  draw(gear: number, kmh: number, rev: number, position: number, lap: number): void;
  dispose(): void;
}

/** Where the centre of the steering wheel is, in car space. */
export const WHEEL_AT = new THREE.Vector3(0, 0.685, -0.4);

/** A modern steering wheel: a rounded carbon body with grips, a row of shift lights over a small display. */
export function buildSteeringWheel(): SteeringWheel {
  const group = new THREE.Group();
  group.position.copy(WHEEL_AT);
  group.rotation.x = -0.5;
  const rim = new THREE.Group();
  group.add(rim);

  const W = 0.27;
  const H = 0.14;
  const R = 0.034;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2 + R, -H / 2);
  shape.lineTo(W / 2 - R, -H / 2);
  shape.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
  shape.lineTo(W / 2, H / 2 - R);
  shape.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2);
  shape.lineTo(-W / 2 + R, H / 2);
  shape.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R);
  shape.lineTo(-W / 2, -H / 2 + R);
  shape.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
  bodyGeo.translate(0, 0, -0.015);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.55, metalness: 0.5 });
  rim.add(new THREE.Mesh(bodyGeo, bodyMat));

  // grips
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.95 });
  const gripGeo = new THREE.CylinderGeometry(0.028, 0.026, 0.13, 14);
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(s * (W / 2 + 0.03), -0.01, 0.0);
    rim.add(grip);
  }

  // the driver's hands: perforated leather gloves with stitched seams, closed round the grips; fireproof sleeves from fixed elbows
  const gloveTex = gloveTexture();
  const suitTex = suitTexture();
  const gloveMat = new THREE.MeshStandardMaterial({ map: gloveTex, bumpMap: gloveTex, bumpScale: 0.9, roughness: 0.56, metalness: 0.04 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0xb8120b, roughness: 0.5, metalness: 0.05 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0xc8140c, roughness: 0.7 });
  const sleeveMat = new THREE.MeshStandardMaterial({ map: suitTex, bumpMap: suitTex, bumpScale: 0.5, roughness: 0.82 });
  const handGeos: THREE.BufferGeometry[] = [];
  const forearms: { mesh: THREE.Mesh; elbow: THREE.Vector3; home: THREE.Vector3 }[] = [];
  const forearmGeo = new THREE.CylinderGeometry(0.036, 0.047, 1, 20, 1);
  const cuffGeo = new THREE.TorusGeometry(0.04, 0.0075, 8, 22);
  const keep = <T extends THREE.BufferGeometry>(g: T): T => {
    handGeos.push(g);
    return g;
  };
  /** A finger: a tube that follows the grip round from the knuckle (angle 0 is towards the driver), ending in a rounded tip. */
  const finger = (hand: THREE.Group, sd: number, y: number, from: number, to: number, r0: number, r1: number, thick: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const ang = ((from + (to - from) * t) * Math.PI) / 180;
      const r = r0 + (r1 - r0) * t;
      pts.push(new THREE.Vector3(-sd * Math.sin(ang) * r, y - t * 0.002, Math.cos(ang) * r));
    }
    const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, thick, 12, false)), gloveMat);
    const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(thick, 14, 10)), gloveMat);
    tip.position.copy(pts[pts.length - 1]);
    const knuckle = new THREE.Mesh(keep(new THREE.SphereGeometry(thick * 1.18, 14, 10)), gloveMat);
    knuckle.position.copy(pts[0]);
    hand.add(tube, tip, knuckle);
  };
  for (const sd of [-1, 1]) {
    const hand = new THREE.Group();
    const gx = sd * (W / 2 + 0.03);
    // the closed fist under the fingers, so there is skin between them and no gap down to the grip
    const fist = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.04, 0.062, 6, 16)), gloveMat);
    fist.position.set(0, 0, 0.014);
    hand.add(fist);
    // four fingers stacked along the grip, longest in the middle, each curling round its front
    for (const [y, to, thick] of [[0.034, 80, 0.0114], [0.0125, 88, 0.0117], [-0.0085, 84, 0.011], [-0.0285, 70, 0.0099]] as const) {
      finger(hand, sd, y, -32, to, 0.041, 0.035, thick);
    }
    // the back of the hand: a flat, rounded plate from the knuckles towards the wrist
    const knuckles = new THREE.Vector3(sd * 0.0215, 0, 0.0345);
    const wristRel = new THREE.Vector3(sd * 0.058, -0.05, 0.11);
    const along = wristRel.clone().sub(knuckles).normalize();
    const width = new THREE.Vector3(0, 1, 0).addScaledVector(along, -along.y).normalize();
    const thickAxis = new THREE.Vector3().crossVectors(along, width).normalize();
    const plate = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 24, 16).scale(0.043, 0.0155, 0.05)), gloveMat);
    plate.applyMatrix4(new THREE.Matrix4().makeBasis(width, thickAxis, along).setPosition(knuckles.clone().addScaledVector(along, 0.04)));
    hand.add(plate);
    // the thumb: along the front of the grip and over its top, two joints in one curve
    const thumbPts = [new THREE.Vector3(sd * 0.047, 0.026, 0.068), new THREE.Vector3(sd * 0.03, 0.05, 0.056), new THREE.Vector3(sd * 0.006, 0.062, 0.043), new THREE.Vector3(-sd * 0.014, 0.06, 0.034)];
    const thumb = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(thumbPts), 18, 0.0118, 12, false)), gloveMat);
    const thumbTip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.0118, 14, 10)), gloveMat);
    thumbTip.position.copy(thumbPts[3]);
    hand.add(thumb, thumbTip);
    // the knuckle guard: a red padded bar across the knuckles, as on a racing glove
    const guard = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.0068, 0.082, 4, 10)), guardMat);
    guard.position.set(sd * 0.0275, 0.003, 0.0445);
    hand.add(guard);
    hand.position.set(gx, -0.01, 0);
    rim.add(hand);
    // the sleeve, from a fixed elbow low and back by the driver's hips to the wrist
    const arm = new THREE.Mesh(forearmGeo, sleeveMat);
    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    group.add(arm, cuff);
    arm.userData.cuff = cuff;
    forearms.push({ mesh: arm, elbow: new THREE.Vector3(sd * 0.3, -0.2, 0.62), home: new THREE.Vector3(gx + wristRel.x, -0.01 + wristRel.y, wristRel.z) });
  }
  const wrist = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const cuffTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const steer = (angle: number) => {
    rim.rotation.z = angle;
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    for (const f of forearms) {
      // the glove's place in the wheel group's space, after the rim has turned
      wrist.set(f.home.x * c - f.home.y * sn, f.home.x * sn + f.home.y * c, f.home.z);
      dir.copy(f.elbow).sub(wrist);
      const len = dir.length();
      dir.divideScalar(len);
      f.mesh.quaternion.setFromUnitVectors(up, dir);
      f.mesh.scale.set(1, len - 0.05, 1);
      f.mesh.position.copy(wrist).addScaledVector(dir, 0.05 + (len - 0.05) / 2);
      const cuff = f.mesh.userData.cuff as THREE.Mesh;
      cuff.quaternion.copy(f.mesh.quaternion);
      cuff.quaternion.multiply(cuffTurn);
      cuff.position.copy(wrist).addScaledVector(dir, 0.055);
    }
  };
  steer(0);

  // the face: shift lights, a display and the buttons, drawn on a canvas
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 512;
  faceCanvas.height = 266;
  const g = faceCanvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(faceCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const faceMat = new THREE.MeshBasicMaterial({ map: tex });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.01, H - 0.008), faceMat);
  face.position.z = 0.0215;
  rim.add(face);

  const leds = ["#34d27a", "#34d27a", "#34d27a", "#34d27a", "#34d27a", "#ff3b2f", "#ff3b2f", "#ff3b2f", "#ff3b2f", "#ff3b2f", "#4da3ff", "#4da3ff", "#4da3ff", "#4da3ff", "#4da3ff"];
  let lastKey = "";
  const draw = (gear: number, kmh: number, rev: number, position: number, lap: number) => {
    const lit = Math.floor(rev * 15.99);
    const flash = rev > 0.985 && Math.floor(performance.now() / 90) % 2 === 0;
    const key = `${gear}|${Math.round(kmh)}|${lit}|${flash}|${position}|${lap}`;
    if (key === lastKey) return;
    lastKey = key;
    g.fillStyle = "#0e0f12";
    g.fillRect(0, 0, 512, 266);
    // shift lights
    for (let i = 0; i < 15; i++) {
      const x = 46 + i * 28.6;
      const on = flash || i < lit;
      g.fillStyle = on ? leds[i] : "#23262c";
      g.beginPath();
      g.arc(x, 30, 9.5, 0, Math.PI * 2);
      g.fill();
    }
    // display
    g.fillStyle = "#050607";
    g.fillRect(118, 64, 276, 150);
    g.strokeStyle = "#2b2f36";
    g.lineWidth = 3;
    g.strokeRect(118, 64, 276, 150);
    g.fillStyle = "#f4f4f2";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.font = "700 118px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    g.fillText(String(gear), 256, 176);
    g.font = "600 30px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    g.fillStyle = "#c5cad1";
    g.fillText(`${Math.round(kmh)}`, 256, 208);
    g.textAlign = "left";
    g.fillStyle = "#98a0ab";
    g.font = "600 24px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    g.fillText(`P${position}`, 128, 94);
    g.textAlign = "right";
    g.fillText(`L${lap}`, 384, 94);
    // buttons and rotaries
    const dots: [number, number, string][] = [[56, 112, "#e10600"], [56, 164, "#f0b323"], [56, 216, "#4da3ff"], [456, 112, "#34d27a"], [456, 164, "#f4f4f2"], [456, 216, "#e10600"], [88, 238, "#6b727d"], [424, 238, "#6b727d"]];
    for (const [x, y, c] of dots) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, 17, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
    }
    tex.needsUpdate = true;
  };
  draw(7, 280, 0.4, 8, 14);

  return {
    group,
    rim,
    steer,
    draw,
    dispose() {
      for (const g of handGeos) g.dispose();
      forearmGeo.dispose();
      cuffGeo.dispose();
      for (const m of [gloveMat, guardMat, cuffMat, sleeveMat]) m.dispose();
      gloveTex.dispose();
      suitTex.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      gripGeo.dispose();
      gripMat.dispose();
      face.geometry.dispose();
      faceMat.dispose();
      tex.dispose();
    },
  };
}
