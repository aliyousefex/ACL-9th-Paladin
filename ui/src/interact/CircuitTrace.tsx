import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../lib/motion";

const TRAIL = 6;

export function CircuitTrace({ d, label }: { d: string; label: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const carRef = useRef<SVGGElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    const car = carRef.current;
    if (!svg || !path || !car) return;
    const length = path.getTotalLength();
    const dots = [...svg.querySelectorAll<SVGCircleElement>("[data-trail]")];
    const sectors = [...svg.querySelectorAll<SVGGElement>("[data-sector]")];
    const startLine = svg.querySelector<SVGGElement>("[data-start-line]");
    sectors.forEach((sector, index) => {
      const point = path.getPointAtLength((length * index) / 3);
      sector.setAttribute("transform", `translate(${point.x} ${point.y})`);
    });
    if (startLine) {
      const point = path.getPointAtLength(0);
      const ahead = path.getPointAtLength(10);
      const angle = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI;
      startLine.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angle})`);
    }
    const place = (distance: number, showTrail: boolean) => {
      const point = path.getPointAtLength(distance);
      const ahead = path.getPointAtLength((distance + 10) % length);
      const angle = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI;
      car.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angle})`);
      dots.forEach((dot, index) => {
        const back = (distance - (index + 1) * 16 + length) % length;
        const mark = path.getPointAtLength(back);
        dot.setAttribute("cx", String(mark.x));
        dot.setAttribute("cy", String(mark.y));
        dot.setAttribute("opacity", showTrail ? String(0.62 - index * 0.09) : "0");
      });
    };
    place(0, false);
    if (reduced) return;

    let frame = 0;
    let running = false;
    let started = 0;
    let elapsed = 0;

    const tick = (now: number) => {
      const progress = ((now - started) / 12000) % 1;
      place(progress * length, true);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      started = performance.now() - elapsed;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!running) return;
      elapsed = performance.now() - started;
      running = false;
      cancelAnimationFrame(frame);
    };
    let seen = false;
    const follow = () => {
      if (seen && document.visibilityState === "visible") start();
      else stop();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        seen = entries.some((entry) => entry.isIntersecting);
        follow();
      },
      { rootMargin: "120px" },
    );
    observer.observe(svg);
    document.addEventListener("visibilitychange", follow);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", follow);
    };
  }, [d, reduced]);

  return (
    <svg ref={svgRef} viewBox="0 0 400 220" className="h-auto w-full" role="img" aria-label={`Formula One-style schematic of ${label}, with three sector markers and an animated car`}>
      <defs>
        <pattern id="track-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#2c3138" strokeWidth="0.6" />
        </pattern>
        <pattern id="finish-checks" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#f4f4f2" />
          <rect x="2" y="2" width="2" height="2" fill="#f4f4f2" />
        </pattern>
      </defs>
      <rect width="400" height="220" fill="url(#track-grid)" opacity="0.45" />
      <path d={d} fill="none" stroke="#f4f4f2" strokeWidth="31" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#e10600" strokeWidth="31" strokeDasharray="7 7" strokeLinejoin="round" strokeLinecap="butt" />
      <path d={d} fill="none" stroke="#5b616b" strokeWidth="26" strokeLinejoin="round" strokeLinecap="round" />
      <path ref={pathRef} d={d} fill="none" stroke="#171a1f" strokeWidth="21" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#c5cad1" strokeWidth="0.8" strokeDasharray="3 8" opacity="0.65" />
      {["S1", "S2", "S3"].map((sector, index) => (
        <g key={sector} data-sector="">
          <circle r="7" fill="#07080a" stroke={index === 0 ? "#e10600" : "#c5cad1"} strokeWidth="1" />
          <text y="2.6" textAnchor="middle" fill="#f4f4f2" fontSize="6.5" fontFamily="Barlow Condensed, sans-serif" fontWeight="600">{sector}</text>
        </g>
      ))}
      <g data-start-line="">
        <rect x="-2" y="-13" width="4" height="26" fill="url(#finish-checks)" />
      </g>
      {Array.from({ length: TRAIL }, (_, index) => (
        <circle key={index} data-trail="" r="2.3" fill="#e10600" opacity="0" />
      ))}
      <g ref={carRef} aria-hidden>
        <path d="M10 0 3 3H-5L-8 1.5V-1.5L-5-3H3Z" fill="#e10600" stroke="#f4f4f2" strokeWidth="0.6" />
        <rect x="-4" y="-4.5" width="3" height="2" fill="#07080a" />
        <rect x="-4" y="2.5" width="3" height="2" fill="#07080a" />
      </g>
    </svg>
  );
}
