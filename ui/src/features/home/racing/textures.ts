/**
 * Every picture the scene uses is drawn here, in code, onto canvases: tarmac with its lines, barrier panels, fence mesh, crowds,
 * the hills. The scanned tarmac and grass and the photographic sky are separate files; these functions return plain canvases for
 * everything else, and world.ts turns them into three.js textures and disposes them.
 */
import { mulberry32 } from "../../../lib/random.ts";

export type Quality = "high" | "medium" | "low";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

/** Tileable value noise in [0, 1]: a periodic lattice of random values, smoothly interpolated, summed over octaves. */
export function tileNoise(size: number, octaves: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o;
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
    const step = cells / size;
    for (let y = 0; y < size; y++) {
      const fy = y * step;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = x * step;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const a = lattice[(y0 % cells) * cells + (x0 % cells)];
        const b = lattice[(y0 % cells) * cells + ((x0 + 1) % cells)];
        const c = lattice[((y0 + 1) % cells) * cells + (x0 % cells)];
        const d = lattice[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
        out[y * size + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Where the across-the-road colours change, in metres from the centre line. Shared by the texture and the geometry. */
export const ROAD = { half: 7, line: 6.72, lineEnd: 6.97, runoff: 12.5, span: 36, tile: 18 } as const;

/**
 * The ground, seen from above: tarmac with its rubbered racing line, white edge lines, paved run-off, and grass. One strip covers
 * +-36 m across the road and repeats every 18 m along it; u is across, v is along.
 */
export function groundTexture(quality: Quality): HTMLCanvasElement {
  // the scans carry the fine grain now, so this only has to place the lines and the zones
  void quality;
  const w = 1024;
  const h = w / 4;
  const [c, ctx] = canvas(w, h);
  const img = ctx.createImageData(w, h);
  const fine = tileNoise(256, 4, 3);
  const broad = tileNoise(128, 3, 8);
  const rng = mulberry32(5);
  const pxPerM = w / (ROAD.span * 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = (x / w) * ROAD.span * 2 - ROAD.span;
      const a = Math.abs(d);
      const f = fine[(y % 256) * 256 + (x % 256)];
      const b = broad[((y >> 1) % 128) * 128 + ((x >> 1) % 128)];
      let r: number;
      let g: number;
      let bl: number;
      if (a < ROAD.half) {
        // tarmac: lighter at the edges where nothing rubs it, darker and shinier on the lines the cars use
        const edge = Math.min(1, Math.max(0, (a - 4.8) / 1.6));
        const lane = Math.exp(-Math.pow((a - 1.55) / 0.85, 2)) * 0.8 + Math.exp(-Math.pow(a / 0.9, 2)) * 0.18;
        const base = 56 + edge * 12 - lane * 15;
        const grain = (f - 0.5) * 20 + (b - 0.5) * 10;
        r = base + grain;
        g = base + 1 + grain;
        bl = base + 5 + grain;
        // transverse joint every tile
        if (y < 2) {
          r *= 0.72;
          g *= 0.72;
          bl *= 0.72;
        }
        // the white lines, a little worn
        if (a > ROAD.line && a < ROAD.lineEnd) {
          const wear = 0.82 + f * 0.18;
          r = 232 * wear;
          g = 233 * wear;
          bl = 228 * wear;
        }
      } else if (a < ROAD.runoff) {
        // paved run-off: lighter than the track, cool grey
        const grain = (f - 0.5) * 22 + (b - 0.5) * 12;
        r = 104 + grain;
        g = 107 + grain;
        bl = 111 + grain;
        if (a < ROAD.half + 0.25) {
          r *= 0.8;
          g *= 0.8;
          bl *= 0.8;
        }
      } else {
        // grass, with dry patches and a darker band where it is trodden at the foot of the barrier
        const patch = b;
        const grain = (f - 0.5) * 30;
        const foot = Math.max(0, 1 - (a - ROAD.runoff) / 1.8);
        r = 64 + patch * 40 + grain - foot * 22;
        g = 98 + patch * 30 + grain - foot * 18;
        bl = 48 + patch * 16 + grain * 0.7 - foot * 14;
        if (rng() < 0.012) {
          r += 22;
          g += 14;
        }
      }
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = bl;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // a few long skid marks and rubber streaks, so the tarmac is not perfectly even
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#101114";
  for (let i = 0; i < 26; i++) {
    const lane = (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 2.6);
    const x = ((lane + ROAD.span) * pxPerM) | 0;
    ctx.fillRect(x, 0, 2 + (rng() * 3) | 0, h);
  }
  ctx.globalAlpha = 1;
  return c;
}

/** Red and white kerb stripes, one stripe per 1.2 m along the kerb. */
export function kerbTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(64, 128);
  const stripes = ["#d11a17", "#f1f1ee", "#d11a17", "#f1f1ee"];
  stripes.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, (i * 128) / 4, 64, 128 / 4 + 1);
  });
  // a little grime
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#000";
  for (let i = 0; i < 160; i++) ctx.fillRect((Math.sin(i * 12.9898) * 43758.5453 % 1) * 64, ((i * 37) % 128), 2, 2);
  ctx.globalAlpha = 1;
  return c;
}

/** A start/finish line: two rows of black and white squares. */
export function lineTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 32);
  ctx.fillStyle = "#f2f2ef";
  ctx.fillRect(0, 0, 256, 32);
  ctx.fillStyle = "#15171a";
  for (let row = 0; row < 2; row++) for (let col = 0; col < 32; col++) if ((row + col) % 2 === 0) ctx.fillRect(col * 8, row * 16, 8, 16);
  return c;
}

export interface PanelStyle {
  text: string;
  bg: string;
  fg: string;
  accent: string;
}

/** The sponsor panels along the barriers. The names are the product's own, not anyone's brand. */
export const PANELS: PanelStyle[] = [
  { text: "PALADIN", bg: "#f2f2ef", fg: "#e10600", accent: "#15171a" },
  { text: "PODIUM CALL", bg: "#15181d", fg: "#f4f4f2", accent: "#e10600" },
  { text: "CUTOFF", bg: "#e10600", fg: "#ffffff", accent: "#15171a" },
  { text: "EVIDENCE", bg: "#1c2f5c", fg: "#f4f4f2", accent: "#e9c23a" },
];

/** A 6 m barrier panel: an advert with a seam at each end. One texture per advert. */
export function panelTexture(style: PanelStyle): HTMLCanvasElement {
  const [c, ctx] = canvas(768, 128);
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, 768, 128);
  ctx.fillStyle = style.accent;
  ctx.fillRect(0, 0, 768, 12);
  ctx.fillRect(0, 116, 768, 12);
  ctx.fillStyle = style.fg;
  ctx.font = "700 76px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.text, 384, 68);
  // seams and a worn lower edge
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, 3, 128);
  ctx.fillRect(765, 0, 3, 128);
  const g = ctx.createLinearGradient(0, 92, 0, 128);
  g.addColorStop(0, "rgba(40,36,30,0)");
  g.addColorStop(1, "rgba(40,36,30,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 92, 768, 36);
  return c;
}

/** Catch-fence: a diamond mesh on transparent, so the sky shows through. */
export function fenceTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(205,210,216,0.95)";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let i = -128; i <= 256; i += 32) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.moveTo(i + 128, 0);
    ctx.lineTo(i, 128);
  }
  ctx.stroke();
  return c;
}

export interface Crowd {
  /** Shirt and scarf colours the fans in this stand favour. */
  shirts: string[];
  seed: number;
}

/** Three stands with three allegiances: the colours are plain ones, not any team's strip. */
export const CROWDS: Crowd[] = [
  { shirts: ["#c9170f", "#d8281d", "#f2f2ef", "#1a1a1d", "#e8c23a", "#8a1410"], seed: 31 },
  { shirts: ["#ff7a14", "#ff9a3c", "#1a2a66", "#f2f2ef", "#2d2f35", "#ffd27a"], seed: 47 },
  { shirts: ["#1a2a66", "#3b5fa8", "#f2f2ef", "#c9170f", "#2d2f35", "#7fb2e8"], seed: 59 },
];

const SKIN = ["#e9c4a5", "#d9a982", "#c18a62", "#9a6a47", "#6f4a31", "#f1d3b8"];
const HAIR = ["#1c1511", "#3a2a1c", "#6b4a2b", "#a37a45", "#cfc6b8", "#0e0d0c"];

/** One seated fan, head and shoulders and a little of the arms, at (x, y) where y is the top of the head. */
function fan(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rng: () => number, shirts: string[]) {
  const shirt = shirts[(rng() * shirts.length) | 0];
  const skin = SKIN[(rng() * SKIN.length) | 0];
  const hair = HAIR[(rng() * HAIR.length) | 0];
  const w = 30 * s;
  // shoulders and torso, shaded darker towards the sides
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "rgba(0,0,0,0.38)");
  g.addColorStop(0.35, "rgba(0,0,0,0)");
  g.addColorStop(0.7, "rgba(0,0,0,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(x, y + 22 * s, w / 2, 14 * s, 0, Math.PI, 0);
  ctx.rect(x - w / 2, y + 22 * s, w, 40 * s);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y + 12 * s, w, 50 * s);
  // an arm up, waving, now and then
  if (rng() < 0.12) {
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 6 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.42, y + 24 * s);
    ctx.lineTo(x + w * 0.62, y + 4 * s);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x + w * 0.64, y + 1 * s, 3.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // neck, head, hair, and a cap or a scarf on some
  ctx.fillStyle = skin;
  ctx.fillRect(x - 3.5 * s, y + 13 * s, 7 * s, 6 * s);
  ctx.beginPath();
  ctx.ellipse(x, y + 8 * s, 6.4 * s, 7.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = rng();
  if (r < 0.34) {
    // a cap
    ctx.fillStyle = shirts[(rng() * shirts.length) | 0];
    ctx.beginPath();
    ctx.ellipse(x, y + 4 * s, 7 * s, 5.2 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 7.6 * s, y + 3.6 * s, 15.2 * s, 2 * s);
  } else {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(x, y + 5 * s, 6.8 * s, 5.4 * s, 0, Math.PI, 0);
    ctx.fill();
  }
  if (rng() < 0.22) {
    ctx.fillStyle = shirts[(rng() * shirts.length) | 0];
    ctx.fillRect(x - 6 * s, y + 17 * s, 12 * s, 3.6 * s);
  }
  // sunglasses
  if (rng() < 0.3) {
    ctx.fillStyle = "rgba(10,10,12,0.85)";
    ctx.fillRect(x - 5.2 * s, y + 7 * s, 10.4 * s, 2.4 * s);
  }
}

/** One row of a grandstand, seen from the track: 16 m long and one riser high. Tileable along its length. */
export function crowdTexture(crowd: Crowd): HTMLCanvasElement {
  const [c, ctx] = canvas(2048, 64);
  const rng = mulberry32(crowd.seed);
  ctx.fillStyle = "#23262c";
  ctx.fillRect(0, 0, 2048, 64);
  // the seat backs behind the people
  for (let x = 0; x < 2048; x += 64) {
    ctx.fillStyle = (x / 64) % 3 === 0 ? "#2f4a7a" : (x / 64) % 3 === 1 ? "#7a2a2a" : "#3a3f48";
    ctx.fillRect(x + 2, 24, 60, 40);
  }
  for (let x = -10; x < 2060; x += 25 + ((rng() * 9) | 0)) {
    if (rng() < 0.08) continue;
    fan(ctx, x, 4 + rng() * 6, 0.9 + rng() * 0.28, rng, crowd.shirts);
  }
  // the lip of the seat in front, in shadow
  const g = ctx.createLinearGradient(0, 52, 0, 64);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 52, 2048, 12);
  return c;
}

/** The concrete tread of a stand with a seat bench on it. Repeats every 4 m. */
export function benchTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 64);
  ctx.fillStyle = "#6c7076";
  ctx.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = (x / 32) % 4 === 1 ? "#a8221c" : (x / 32) % 4 === 2 ? "#2a4a8a" : "#4c5058";
    ctx.fillRect(x + 2, 16, 28, 34);
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, 256, 6);
  return c;
}

/** Fans standing behind the catch fence, in silhouette against the sky: heads, shoulders, raised arms and flags. */
export function standingCrowdTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 192);
  const rng = mulberry32(77);
  ctx.clearRect(0, 0, 1024, 192);
  const shirts = ["#c9170f", "#ff7a14", "#1a2a66", "#f2f2ef", "#2d2f35", "#e8c23a", "#3b5fa8", "#1f8f5f"];
  for (let layer = 0; layer < 2; layer++) {
    for (let x = layer * 16; x < 1030; x += 30 + ((rng() * 12) | 0)) {
      if (rng() < 0.06) continue;
      const top = 62 + layer * 10 + rng() * 14;
      // a flag, on some
      if (rng() < 0.1) {
        ctx.strokeStyle = "#2a2a2e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 16, top + 14);
        ctx.lineTo(x + 20, top - 46);
        ctx.stroke();
        ctx.fillStyle = shirts[(rng() * shirts.length) | 0];
        ctx.fillRect(x + 20, top - 46, 36, 22);
      }
      fan(ctx, x, top, 1.5 + rng() * 0.3, rng, shirts);
    }
  }
  // fill below the shoulders so they read as a body of people, darker towards the ground
  const g = ctx.createLinearGradient(0, 120, 0, 192);
  g.addColorStop(0, "rgba(30,32,38,0)");
  g.addColorStop(1, "rgba(20,22,26,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 120, 1024, 72);
  return c;
}

/** The pit building's glass and garage doors, one bay per 16 px. */
export function facadeTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#9fbbd6");
  g.addColorStop(0.55, "#5c7a98");
  g.addColorStop(1, "#2c3f55");
  ctx.fillStyle = "#c9cdd2";
  ctx.fillRect(0, 0, 512, 256);
  // upper floor: glass
  ctx.fillStyle = g;
  ctx.fillRect(0, 12, 512, 104);
  ctx.fillStyle = "#cfd3d8";
  for (let x = 0; x <= 512; x += 32) ctx.fillRect(x - 1, 12, 3, 104);
  ctx.fillRect(0, 62, 512, 3);
  // ground floor: garage doors, lit inside
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = "#e9ebee";
    ctx.fillRect(x + 4, 134, 56, 104);
    ctx.fillStyle = "#1a1d22";
    ctx.fillRect(x + 8, 140, 48, 98);
    ctx.fillStyle = "#e10600";
    ctx.fillRect(x + 8, 140, 48, 5);
    ctx.fillStyle = "rgba(255,244,214,0.55)";
    ctx.fillRect(x + 14, 160, 36, 52);
  }
  ctx.fillStyle = "#15171a";
  ctx.fillRect(0, 118, 512, 14);
  ctx.fillStyle = "#f4f4f2";
  ctx.font = "700 11px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PALADIN   PALADIN   PALADIN   PALADIN   PALADIN   PALADIN   PALADIN   PALADIN   PALADIN", 8, 129);
  return c;
}

/** The banner on the start/finish gantry. */
export function bannerTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 128);
  ctx.fillStyle = "#101216";
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = "#e10600";
  ctx.fillRect(0, 0, 1024, 14);
  ctx.fillRect(0, 114, 1024, 14);
  ctx.fillStyle = "#f4f4f2";
  ctx.font = "700 84px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PALADIN  ·  PODIUM CALL  ·  PALADIN", 512, 68);
  return c;
}

/** A braking-distance board: a number on white with red bars. */
export function boardTexture(n: number): HTMLCanvasElement {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#f4f4f2";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#d11a17";
  const bars = n >= 300 ? 3 : n >= 200 ? 2 : 1;
  for (let i = 0; i < bars; i++) ctx.fillRect(10 + i * 38, 0, 22, 128);
  ctx.fillStyle = "#15171a";
  ctx.font = "700 40px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(n), 64, 112);
  return c;
}

/** A plain gradient sky, used only if the sky photograph cannot be loaded. */
export function fallbackSky(): HTMLCanvasElement {
  const [c, ctx] = canvas(8, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#3a66a8");
  g.addColorStop(0.5, "#a6b6d0");
  g.addColorStop(0.505, "#a6aec0");
  g.addColorStop(1, "#7d8190");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  return c;
}

/** A ridge line of hills with alpha, tinted by distance. Wraps round in u. */
export function hillTexture(seed: number, tint: string, height: number): HTMLCanvasElement {
  const w = 2048;
  const h = 256;
  const [c, ctx] = canvas(w, h);
  const rng = mulberry32(seed);
  const waves = Array.from({ length: 5 }, (_, i) => ({ f: 2 + i * 2 + ((rng() * 2) | 0), p: rng() * Math.PI * 2, a: 1 / (i + 1) }));
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, h * (1 - height), 0, h);
  g.addColorStop(0, tint);
  g.addColorStop(1, "rgba(220,205,180,1)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    let y = 0;
    for (const wv of waves) y += wv.a * Math.sin((x / w) * Math.PI * 2 * wv.f + wv.p);
    ctx.lineTo(x, h * (1 - height * (0.55 + 0.22 * y)));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  return c;
}

/** A soft dark oval, for the shadow under each car where the real shadow is thin or off. */
export function blobTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,0.72)");
  g.addColorStop(0.6, "rgba(0,0,0,0.38)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}
