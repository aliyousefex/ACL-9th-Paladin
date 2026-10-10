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
    <svg ref={svgRef} viewBox="0 0 400 220" className="h-auto w-full" role="img" aria-label={`Schematic centerline of ${label}`}>
      <path ref={pathRef} d={d} fill="none" stroke="#2c3138" strokeWidth="18" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#f4f4f2" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {Array.from({ length: TRAIL }, (_, index) => (
        <circle key={index} data-trail="" r="2.3" fill="#e10600" opacity="0" />
      ))}
      <g ref={carRef} aria-hidden>
        <polygon points="9,0 -6.5,4.4 -3.1,0 -6.5,-4.4" fill="#e10600" />
      </g>
    </svg>
  );
}
