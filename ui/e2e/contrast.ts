import type { Page } from "@playwright/test";

export interface LowContrast {
  ratio: number;
  text: string;
  fg: string;
  bg: string;
  element: string;
}

/**
 * The real rendered contrast of every run of text on the page, not just the palette on paper: each text element's colour
 * is composited over the stack of translucent backgrounds behind it and compared with WCAG AA (4.5:1, or 3:1 for large
 * text). Text over a gradient, an image, a chart or a canvas has no single background and is skipped.
 */
export async function lowContrast(page: Page): Promise<LowContrast[]> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba | null => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
      }
      const k = value.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);
      return k ? [+k[1] * 255, +k[2] * 255, +k[3] * 255, k[4] === undefined ? 1 : +k[4]] : null;
    };
    const luminance = ([r, g, b]: Rgba) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => [top[0] * top[3] + bottom[0] * (1 - top[3]), top[1] * top[3] + bottom[1] * (1 - top[3]), top[2] * top[3] + bottom[2] * (1 - top[3]), 1];
    const backgroundOf = (el: Element): Rgba | null => {
      const stack: Rgba[] = [];
      // What is painted behind the text is whatever is under its centre, in paint order: the ancestors, and also a sibling that
      // draws a surface behind it (the sliding pill under the current link is a sibling, not a parent). A sibling that paints
      // an image is ignored, as it always was; an ancestor that paints one makes the text unmeasurable.
      const box = el.getBoundingClientRect();
      const hit = document.elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const at = hit.indexOf(el);
      const chain: Element[] = [];
      if (at >= 0) {
        for (const node of hit.slice(at)) chain.push(node);
      } else {
        for (let node: Element | null = el; node; node = node.parentElement) chain.push(node);
      }
      for (const node of chain) {
        const style = getComputedStyle(node);
        const ancestor = node === el || node.contains(el);
        if (style.backgroundImage !== "none") {
          if (ancestor) return null;
          continue;
        }
        const colour = parse(style.backgroundColor);
        if (colour && colour[3] > 0) {
          stack.push(colour);
          if (colour[3] >= 1) break;
        }
      }
      const page = parse(getComputedStyle(document.body).backgroundColor);
      let base: Rgba = page && page[3] > 0 ? page : [255, 255, 255, 1];
      for (let i = stack.length - 1; i >= 0; i -= 1) base = over(stack[i], base);
      return base;
    };

    const failures: { ratio: number; text: string; fg: string; bg: string; element: string }[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("svg, canvas, [aria-hidden=true], .sr-only, script, style")) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1).map((n) => (n.textContent ?? "").trim()).join(" ");
      if (!own) continue;
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (box.width < 2 || box.height < 2 || style.visibility === "hidden" || style.display === "none") continue;
      let opacity = 1;
      for (let node: Element | null = el; node; node = node.parentElement) opacity *= +getComputedStyle(node).opacity;
      if (opacity < 0.5) continue;
      const bg = backgroundOf(el);
      const raw = parse(style.color);
      if (!bg || !raw) continue;
      const fg = over([raw[0], raw[1], raw[2], raw[3] * opacity], bg);
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const px = parseFloat(style.fontSize);
      const large = px >= 24 || (px >= 18.66 && +style.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5)) failures.push({ ratio: +ratio.toFixed(2), text: own.slice(0, 40), fg: style.color, bg: `rgb(${bg.slice(0, 3).map(Math.round).join(",")})`, element: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}` });
    }
    return failures;
  });
}

/** Interactive elements smaller than `min` px in either direction. Links inside a sentence and stretched card links are exempt. */
export async function smallTargets(page: Page, min: number): Promise<string[]> {
  return page.evaluate((limit) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=radio], [role=tab]")) {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
      if (box.width >= limit && box.height >= limit) continue;
      const cls = String(el.className);
      // aria-hidden: a purely visual shortcut whose function is available through an equivalent full-size control (WCAG 2.5.8)
      if (cls.includes("sr-only") || cls.includes("after:inset-0") || el.closest("[aria-hidden=true]")) continue;
      const prose = el.parentElement && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 6);
      if (el.tagName === "A" && (style.display === "inline" || style.display === "inline-block") && prose) continue;
      if (el.tagName === "BUTTON" && style.display === "inline" && prose) continue;
      out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    return out;
  }, min);
}
