/**
 * A league result as a short text code, so two people can compare without an account or a server.
 *
 *   PAL1-<base64url of: version, name length, name, race count, races..., checksum>
 *
 * Each race is its id and the three driver ids that were locked, 16 bits each. A 32-bit FNV-1a checksum closes the
 * payload, so a typo, a truncated paste or a casual edit is caught. It is NOT a signature: anyone can build a valid
 * code by hand, so a code proves nothing about whether its picks were really made blind. On decoding, every race
 * must exist and every pick must be a driver who was in that race's field, which rejects nonsense, not lies.
 */

import type { Play } from "./league.ts";

export const CODE_PREFIX = "PAL1-";
const VERSION = 1;
export const MAX_NAME = 16;
export const MAX_PLAYS = 200;

export interface Shared {
  nickname: string;
  plays: Play[];
}

export type Decoded = { ok: true; value: Shared } | { ok: false; reason: string };

/** ASCII letters, digits, space, dot, underscore and dash; at most 16 characters; no leading or trailing space. */
export function sanitiseNickname(text: string): string {
  return text.replace(/[^A-Za-z0-9 ._-]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
}

function fnv1a(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeCode(nickname: string, plays: readonly Play[]): string {
  const name = sanitiseNickname(nickname);
  // One play per race, the first one given (the same rule the league uses), at most MAX_PLAYS.
  const seen = new Set<number>();
  const unique = plays.filter((play) => !seen.has(play.raceId) && seen.add(play.raceId)).slice(0, MAX_PLAYS);
  const bytes = new Uint8Array(1 + 1 + name.length + 2 + unique.length * 8 + 4);
  const view = new DataView(bytes.buffer);
  let at = 0;
  view.setUint8(at++, VERSION);
  view.setUint8(at++, name.length);
  for (const char of name) view.setUint8(at++, char.charCodeAt(0));
  view.setUint16(at, unique.length);
  at += 2;
  for (const play of unique) {
    view.setUint16(at, play.raceId);
    at += 2;
    for (const id of play.picks.slice(0, 3)) {
      view.setUint16(at, id);
      at += 2;
    }
  }
  view.setUint32(at, fnv1a(bytes.subarray(0, at)));
  return CODE_PREFIX + toBase64Url(bytes);
}

/** `fieldOf(raceId)` is the driver ids that started that race, or undefined if the site has no such race. */
export function decodeCode(code: string, fieldOf: (raceId: number) => readonly number[] | undefined): Decoded {
  const text = code.replace(/\s+/g, "");
  if (!text.startsWith(CODE_PREFIX)) return { ok: false, reason: "That does not look like a Paladin code. It should start with PAL1-." };
  const bytes = fromBase64Url(text.slice(CODE_PREFIX.length));
  if (!bytes || bytes.length < 8) return { ok: false, reason: "The code is cut short or contains characters it should not." };
  const body = bytes.subarray(0, bytes.length - 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(bytes.length - 4) !== fnv1a(body)) return { ok: false, reason: "The code is damaged or has been edited: its checksum does not match." };
  if (view.getUint8(0) !== VERSION) return { ok: false, reason: "The code comes from a different version of the league." };
  const nameLength = view.getUint8(1);
  if (nameLength > MAX_NAME || 2 + nameLength + 2 > body.length) return { ok: false, reason: "The code is damaged: its name is the wrong length." };
  let at = 2;
  let nickname = "";
  for (let i = 0; i < nameLength; i += 1) nickname += String.fromCharCode(view.getUint8(at++));
  if (sanitiseNickname(nickname) !== nickname) return { ok: false, reason: "The code is damaged: its name has characters it should not." };
  const count = view.getUint16(at);
  at += 2;
  if (count > MAX_PLAYS || at + count * 8 !== body.length) return { ok: false, reason: "The code is damaged: the number of races does not match its length." };
  const plays: Play[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const raceId = view.getUint16(at);
    const picks = [view.getUint16(at + 2), view.getUint16(at + 4), view.getUint16(at + 6)];
    at += 8;
    const field = fieldOf(raceId);
    if (!field) return { ok: false, reason: `The code names a race (${raceId}) that this site does not have.` };
    if (seen.has(raceId)) return { ok: false, reason: "The code lists the same race twice." };
    seen.add(raceId);
    if (new Set(picks).size !== 3 || !picks.every((id) => field.includes(id))) return { ok: false, reason: "The code includes a pick that is not a driver who raced that Grand Prix." };
    plays.push({ raceId, picks });
  }
  return { ok: true, value: { nickname, plays } };
}
