/**
 * Share cards and share text. `raceCardSpec` and `leagueCardSpec` hold every word a card says, as plain data, so they
 * are tested without a browser. `renderCard` only draws a spec onto a canvas.
 *
 * A card never carries something the viewer has not earned: the race card needs the result, and the caller only offers
 * it after the reveal for a blind pick.
 */

import type { League } from "./league.ts";

export interface CardItem {
  text: string;
  /** hit: on the podium. miss: not. none: a plain line. Drawn as a filled or hollow marker and also written in words. */
  mark: "hit" | "miss" | "none";
}

export interface CardColumn {
  heading: string;
  value: string;
  unit: string;
  items: CardItem[];
}

export interface CardSpec {
  kicker: string;
  title: string;
  subtitle: string;
  columns: CardColumn[];
  line: string;
  footer: string;
  fileName: string;
  alt: string;
}

export interface RaceCardInput {
  raceName: string;
  year: number;
  slug: string;
  picks: { code: string; onPodium: boolean }[];
  paladin: { code: string; onPodium: boolean }[];
  grid: { code: string; onPodium: boolean }[];
  actual: string[];
}

const mark = (onPodium: boolean): CardItem["mark"] => (onPodium ? "hit" : "miss");
const hits = (items: { onPodium: boolean }[]) => items.filter((item) => item.onPodium).length;

export const CARD_FOOTER = "Paladin is an independent project, not affiliated with Formula 1. This race was held out of the model's training.";

export function raceCardSpec(input: RaceCardInput): CardSpec {
  const mine = hits(input.picks);
  const model = hits(input.paladin);
  const grid = hits(input.grid);
  const verdict = mine > model ? "I beat Paladin on this one." : mine < model ? "Paladin beat me on this one." : "Paladin and I tied on this one.";
  return {
    kicker: "Paladin · held-out race",
    title: `${input.raceName} ${input.year}`,
    subtitle: "I called the podium before the result.",
    columns: [
      { heading: "My call", value: String(mine), unit: "of 3", items: input.picks.map((item) => ({ text: item.code, mark: mark(item.onPodium) })) },
      { heading: "Paladin", value: String(model), unit: "of 3", items: input.paladin.map((item) => ({ text: item.code, mark: mark(item.onPodium) })) },
      { heading: "Starting grid", value: String(grid), unit: "of 3", items: input.grid.map((item) => ({ text: item.code, mark: mark(item.onPodium) })) },
    ],
    line: `${verdict} The podium: ${input.actual.join(" · ")}.`,
    footer: CARD_FOOTER,
    fileName: `paladin-${input.year}-${input.slug}-my-call.png`,
    alt: `${input.raceName} ${input.year}: I named ${mine} of the 3 podium finishers, Paladin ${model}, the starting grid ${grid}. The podium was ${input.actual.join(", ")}.`,
  };
}

const races = (count: number) => `${count} ${count === 1 ? "race" : "races"}`;
const perRace = (total: number, races: number) => (races ? (total / races).toFixed(2) : "–");

export function leagueCardSpec(league: League, nickname: string, scope: string): CardSpec {
  const heading = nickname ? `${nickname}'s season` : "My season";
  const record = `Ahead of Paladin in ${races(league.vsPaladin.ahead)}, level in ${races(league.vsPaladin.level)}, behind in ${races(league.vsPaladin.behind)}.`;
  const verdictLine = league.verdict === "too few races to say" ? "Too few races yet to call it either way." : `On these races I am ${league.verdict}.`;
  return {
    kicker: `Paladin · season league · ${scope}`,
    title: heading,
    subtitle: `${league.played} ${league.played === 1 ? "race" : "races"} called before the result`,
    columns: [
      { heading: nickname || "Me", value: perRace(league.you, league.played), unit: "names per race", items: [{ text: `${league.you} podium names in ${league.played} races`, mark: "none" }] },
      { heading: "Paladin", value: perRace(league.paladin, league.played), unit: "names per race", items: [{ text: `${league.paladin} podium names, same races`, mark: "none" }] },
      { heading: "Starting grid", value: perRace(league.grid, league.played), unit: "names per race", items: [{ text: `${league.grid} podium names, same races`, mark: "none" }] },
    ],
    line: `${record} ${verdictLine}`,
    footer: CARD_FOOTER,
    fileName: `paladin-season-league.png`,
    alt: `Season league over ${league.played} races: me ${perRace(league.you, league.played)} podium names per race, Paladin ${perRace(league.paladin, league.played)}, the starting grid ${perRace(league.grid, league.played)}.`,
  };
}

/** Plain text for a message or a post. */
export function raceShareText(input: RaceCardInput, url: string): string {
  const mine = hits(input.picks);
  const model = hits(input.paladin);
  const grid = hits(input.grid);
  return `${input.raceName} ${input.year}: I called ${input.picks.map((item) => item.code).join(" · ")} before the result and named ${mine} of 3 podium finishers. Paladin named ${model}, the starting grid ${grid}. ${url}`;
}

export function leagueShareText(league: League, nickname: string, url: string): string {
  const who = nickname ? `${nickname}: ` : "";
  return `${who}${league.played} Grands Prix called before the result. Podium names per race: me ${perRace(league.you, league.played)}, Paladin ${perRace(league.paladin, league.played)}, the starting grid ${perRace(league.grid, league.played)}. ${url}`;
}

/* ------------------------------------------------------------------ drawing (browser only) */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const INK = "#f4f4f2";
const MUTE = "#98a0ab";
const STEEL = "#c5cad1";
const PAGE = "#0a0b0e";
const PANEL = "#101318";
const LINE = "#39414c";
const SIGNAL = "#e10600";
const HIT = "#3ddc84";

function fit(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, width: number): number {
  let current = size;
  ctx.font = font(current);
  while (ctx.measureText(text).width > width && current > 20) {
    current -= 2;
    ctx.font = font(current);
  }
  return current;
}

export function renderCard(canvas: HTMLCanvasElement, spec: CardSpec): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A canvas is needed to draw the card.");
  const display = (size: number) => `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const label = (size: number) => `600 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const body = (size: number) => `400 ${size}px "Barlow", system-ui, sans-serif`;

  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = SIGNAL;
  ctx.fillRect(0, 0, 10, CARD_HEIGHT);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTE;
  ctx.font = label(24);
  ctx.fillText(spec.kicker.toUpperCase(), 56, 62);

  ctx.fillStyle = INK;
  fit(ctx, spec.title, display, 76, CARD_WIDTH - 112);
  ctx.fillText(spec.title, 56, 134);
  ctx.fillStyle = STEEL;
  ctx.font = body(28);
  ctx.fillText(spec.subtitle, 56, 178);

  const colWidth = (CARD_WIDTH - 112 - 2 * 24) / 3;
  spec.columns.forEach((column, i) => {
    const x = 56 + i * (colWidth + 24);
    const y = 204;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, colWidth, 286);
    ctx.fillStyle = i === 0 ? SIGNAL : LINE;
    ctx.fillRect(x, y, colWidth, 4);
    ctx.fillStyle = MUTE;
    ctx.font = label(22);
    ctx.fillText(column.heading.toUpperCase(), x + 24, y + 42);
    ctx.fillStyle = INK;
    ctx.font = display(96);
    ctx.fillText(column.value, x + 24, y + 124);
    const valueWidth = ctx.measureText(column.value).width;
    ctx.fillStyle = MUTE;
    ctx.font = body(24);
    // A short unit sits beside the number; a long one ("names per race") drops below it rather than leaving the panel.
    if (valueWidth + 12 + ctx.measureText(column.unit).width <= colWidth - 48) ctx.fillText(column.unit, x + 24 + valueWidth + 12, y + 124);
    else {
      ctx.font = body(20);
      ctx.fillText(column.unit, x + 24, y + 150);
    }
    column.items.forEach((item, row) => {
      const iy = y + 172 + row * 36;
      if (item.mark === "none") {
        ctx.fillStyle = STEEL;
        ctx.font = body(22);
        ctx.fillText(item.text, x + 24, iy + 8);
        return;
      }
      ctx.beginPath();
      ctx.arc(x + 34, iy - 2, 9, 0, Math.PI * 2);
      if (item.mark === "hit") {
        ctx.fillStyle = HIT;
        ctx.fill();
      } else {
        ctx.strokeStyle = MUTE;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.fillStyle = item.mark === "hit" ? INK : MUTE;
      ctx.font = display(34);
      ctx.fillText(item.text, x + 56, iy + 9);
    });
  });

  ctx.fillStyle = INK;
  fit(ctx, spec.line, body, 28, CARD_WIDTH - 112);
  ctx.fillText(spec.line, 56, 532);
  if (spec.columns.some((column) => column.items.some((item) => item.mark !== "none"))) {
    ctx.fillStyle = MUTE;
    ctx.font = body(20);
    ctx.fillText("Filled marker: finished on the podium. Hollow marker: did not.", 56, 568);
  }
  ctx.fillStyle = MUTE;
  fit(ctx, spec.footer, body, 18, CARD_WIDTH - 112);
  ctx.fillText(spec.footer, 56, 608);
}

export async function cardBlob(spec: CardSpec): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('700 40px "Barlow Condensed"'), document.fonts.load('400 20px "Barlow"')]);
  } catch {
    /* the card still draws with the fallback faces */
  }
  const canvas = document.createElement("canvas");
  renderCard(canvas, spec);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The card could not be made."))), "image/png"));
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
