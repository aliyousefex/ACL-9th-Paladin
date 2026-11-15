import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { SITE_TOKEN, injectSite, robotsTxt, siteUrl, sitemapXml } from "../vite-seo.ts";
import { pageTitle } from "../src/lib/hooks.ts";

const here = (path: string) => new URL(`../${path}`, import.meta.url);
const html = readFileSync(here("index.html"), "utf8");
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

/** Width and height from a PNG's IHDR chunk, so the test needs no image library. */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(here(path));
  assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG", `${path} is a PNG`);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/* ------------------------------------------------------------------ the page's head */

test("the page has one title, a description of a search-snippet length, and says what language it is", () => {
  assert.equal(count(html, /<title>/g), 1);
  assert.match(html, /<html lang="en">/);
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/)![1];
  assert.ok(description.length >= 70 && description.length <= 160, `description is ${description.length} characters`);
  assert.equal(count(html, /name="description"/g), 1);
});

test("sharing tags are complete, with alt text and the size of the card that is shipped", () => {
  for (const tag of ["og:type", "og:site_name", "og:title", "og:description", "og:image", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) {
    assert.match(html, new RegExp(`(?:property|name)="${tag}"`), tag);
  }
  assert.deepEqual(pngSize("public/og-card.png"), [1200, 630]);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
});

test("the structured data is valid JSON that describes the site and the app, and claims nothing it cannot back", () => {
  const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1];
  // Both with the address filled in and with its lines dropped, the data still parses.
  for (const url of ["https://paladin.example", null]) {
    const parsed = JSON.parse(injectSite(raw, url));
    const types = parsed["@graph"].map((node: { "@type": string }) => node["@type"]);
    assert.deepEqual(types, ["WebSite", "WebApplication"]);
  }
  assert.doesNotMatch(raw, /aggregateRating|review|offers|price/i);
});

test("there is something to read without scripts", () => {
  assert.match(html, /<noscript>[\s\S]*<h1>[\s\S]*<\/noscript>/);
});

/* ------------------------------------------------------------------ address-dependent tags */

test("the public address is read from the environment, and anything that is not an http(s) address is ignored", () => {
  assert.equal(siteUrl({ VITE_SITE_URL: "https://paladin.example/" }), "https://paladin.example");
  assert.equal(siteUrl({ SITE_URL: "http://localhost:4173" }), "http://localhost:4173");
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "paladin.vercel.app" }), "https://paladin.vercel.app");
  assert.equal(siteUrl({ VITE_SITE_URL: "https://a.example", VERCEL_PROJECT_PRODUCTION_URL: "b.app" }), "https://a.example", "an explicit address wins");
  for (const bad of ["", "paladin.example", "javascript:alert(1)", "ftp://x.example", "https://"]) assert.equal(siteUrl({ VITE_SITE_URL: bad }), null, JSON.stringify(bad));
  assert.equal(siteUrl({}), null);
});

test("with an address, the canonical link, og:url and absolute share images are filled in", () => {
  const out = injectSite(html, "https://paladin.example");
  assert.doesNotMatch(out, new RegExp(SITE_TOKEN));
  assert.match(out, /<link rel="canonical" href="https:\/\/paladin\.example\/" \/>/);
  assert.match(out, /property="og:url" content="https:\/\/paladin\.example\/"/);
  assert.match(out, /property="og:image" content="https:\/\/paladin\.example\/og-card\.png"/);
  assert.match(out, /name="twitter:image" content="https:\/\/paladin\.example\/og-card\.png"/);
});

test("without an address nothing points at a wrong one: the canonical and url tags are left out and the image stays site-relative", () => {
  const out = injectSite(html, null);
  assert.doesNotMatch(out, new RegExp(SITE_TOKEN));
  assert.doesNotMatch(out, /rel="canonical"/);
  assert.doesNotMatch(out, /property="og:url"/);
  assert.match(out, /property="og:image" content="\/og-card\.png"/);
});

test("robots.txt always allows crawling, and names the sitemap only when the address is known", () => {
  assert.equal(robotsTxt(null), "User-agent: *\nAllow: /\n");
  assert.equal(robotsTxt("https://paladin.example"), "User-agent: *\nAllow: /\n\nSitemap: https://paladin.example/sitemap.xml\n");
  assert.ok(!existsSync(here("public/robots.txt")), "robots.txt comes from the build, so there is one source of truth");
});

test("the sitemap lists the one address crawlers can use, since they ignore the part after the #", () => {
  const xml = sitemapXml("https://paladin.example");
  assert.equal(count(xml, /<loc>/g), 1);
  assert.match(xml, /<loc>https:\/\/paladin\.example\/<\/loc>/);
});

/* ------------------------------------------------------------------ page titles */

test("a page's title is its name then the site's, and the home page is the site's alone", () => {
  assert.equal(pageTitle("Error Atlas"), "Error Atlas · Paladin · F1 Podium Predictor");
  assert.equal(pageTitle(null), "Paladin · F1 Podium Predictor");
});

/* ------------------------------------------------------------------ icons */

test("the favicon is the logo mark as one vector path, white on the logo's blue square: no embedded bitmap, no second shape", () => {
  const svg = readFileSync(here("public/favicon.svg"), "utf8");
  assert.ok(svg.length < 4000, `${svg.length} bytes`);
  assert.doesNotMatch(svg, /<image|data:image|base64/i);
  assert.equal(count(svg, /<path /g), 1, "the mark is a single path");
  assert.match(svg, /<rect [^>]*fill="#1800ad"/);
  // The artwork's hairlines are thickened so it holds at 16px; the mark is white on the blue.
  assert.match(svg, /<path [^>]*fill="#fff"[^>]*stroke="#fff"[^>]*stroke-width="\d+"/);
  // It is the supplied artwork, not a redrawing of it: the favicon carries the logo's own path.
  const source = readFileSync(here("../scripts/logo-mark.svg"), "utf8").match(/<path fill="[^"]+" d="([^"]+)"/)![1].trim();
  assert.ok(svg.includes(` d="${source}"`), "the favicon draws the logo's own path");
});

test("every icon the page and the manifest name exists, at the size it says", () => {
  assert.deepEqual(pngSize("public/apple-touch-icon.png"), [180, 180]);
  const manifest = JSON.parse(readFileSync(here("public/site.webmanifest"), "utf8").replace(/^﻿/, ""));
  for (const icon of manifest.icons as { src: string; sizes: string; type: string; purpose: string }[]) {
    assert.ok(existsSync(here(`public${icon.src}`)), `${icon.src} exists`);
    if (icon.type === "image/png") assert.deepEqual(pngSize(`public${icon.src}`), icon.sizes.split("x").map(Number), icon.src);
    // "any maskable" on one image is discouraged: a maskable icon needs its own safe-zone padding.
    assert.ok(!/any maskable/.test(icon.purpose), `${icon.src} has a single purpose`);
  }
  assert.ok(manifest.icons.some((icon: { purpose: string }) => icon.purpose === "maskable"));
  for (const href of html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)) assert.ok(existsSync(here(`public${href[1]}`)), `${href[1]} exists`);
  assert.doesNotMatch(html, /\.webp" type="image\/webp"/, "a photo is not the favicon");
});

test("favicon.ico carries 16, 32 and 48 pixel images", () => {
  const ico = readFileSync(here("public/favicon.ico"));
  assert.equal(ico.readUInt16LE(2), 1, "an icon file");
  const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
  assert.deepEqual(sizes, [16, 32, 48]);
});

test("the manifest identifies the app and its shortcuts open real routes", () => {
  const manifest = JSON.parse(readFileSync(here("public/site.webmanifest"), "utf8").replace(/^﻿/, ""));
  for (const key of ["id", "name", "short_name", "description", "lang", "start_url", "scope", "display", "background_color", "theme_color"]) assert.ok(manifest[key], key);
  for (const shortcut of manifest.shortcuts as { name: string; url: string }[]) assert.match(shortcut.url, /^\/#\/(league|analysis|race-lab)$/, shortcut.name);
});
