import { useEffect, useSyncExternalStore } from "react";
import { SECTIONS } from "./sections";

/**
 * A tiny hash router. Hash routes keep the site deployable as plain static files and keep
 * every old link such as `#book` working: bare section ids are redirected to the method page.
 */

export interface Location {
  /** Path segments without the leading slash: "race/2024/monaco" -> ["race", "2024", "monaco"]. */
  path: string[];
  query: URLSearchParams;
}

const LEGACY = new Set<string>(SECTIONS.map((section) => section.id));

function read(): string {
  return window.location.hash;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function parseHash(hash: string): Location {
  let body = hash.replace(/^#/, "");
  if (body && !body.startsWith("/")) {
    // Old walkthrough anchors such as #book
    if (LEGACY.has(body)) body = `/method/${body}`;
    else body = "/";
  }
  const [pathPart, queryPart = ""] = body.split("?");
  const path = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  return { path, query: new URLSearchParams(queryPart) };
}

export function useLocation(): Location & { key: string } {
  const hash = useSyncExternalStore(subscribe, read, () => "");
  const location = parseHash(hash);
  return { ...location, key: hash };
}

export function href(path: string, query?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ""}`;
}

export function navigate(path: string, query?: Record<string, string | number | undefined>): void {
  window.location.hash = href(path, query);
}

/** Replace the current hash without adding a history entry (used for filters). */
export function replaceQuery(query: Record<string, string | number | undefined>): void {
  const { path } = parseHash(window.location.hash);
  const target = href(`/${path.join("/")}`, query);
  window.history.replaceState(null, "", target);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** Move to the top on a page change; the walkthrough scrolls to its section instead. */
export function useScrollOnNavigate(location: Location): void {
  const key = location.path.slice(0, 3).join("/");
  const section = location.path[0] === "method" ? location.path[1] : undefined;
  useEffect(() => {
    if (section) {
      const node = document.getElementById(section);
      if (node) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [key, section]);
}
