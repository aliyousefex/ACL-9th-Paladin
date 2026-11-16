import { useEffect, useRef } from "react";
import { Book } from "../../sections/Book";
import { Build } from "../../sections/Build";
import { Cases } from "../../sections/Cases";
import { Classification } from "../../sections/Classification";
import { Decision } from "../../sections/Decision";
import { Features } from "../../sections/Features";
import { Findings } from "../../sections/Findings";
import { Limits } from "../../sections/Limits";
import { Line } from "../../sections/Line";
import { Models } from "../../sections/Models";
import { SectionStrip } from "../../components/SectionStrip";
import { SECTIONS } from "../../lib/sections";
import { useScrollSpy, useTitle } from "../../lib/hooks";
import { haptic } from "../../lib/haptic";
import { href } from "../../lib/router";

const IDS = SECTIONS.map((s) => s.id) as string[];

/**
 * The Milestone 1 walkthrough: the argument from raw tables to the selected model, kept whole.
 * It is one long document; the navigator below follows the reader and links to each section.
 */
export function MethodPage({ section }: { section?: string }) {
  useTitle("Method walkthrough", "How the Formula 1 data was cleaned, split by season and checked for leakage, step by step.");
  const active = useScrollSpy(IDS, 150);

  // The page mounts lazily, so a link such as #/method/book can arrive before its section exists.
  const arrived = useRef(false);
  useEffect(() => {
    if (!section) return;
    const node = document.getElementById(section);
    // Arriving from a link jumps straight to the section; moving around inside the page scrolls smoothly.
    const smooth = arrived.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    arrived.current = true;
    if (node) node.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
  }, [section]);


  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <h1 className="display text-[3rem] sm:text-[4.8rem]">From raw tables to one model</h1>
          <p className="mt-4 max-w-[68ch] text-[1.1rem] leading-relaxed text-steel">
            The full argument behind the predictions: how the data was audited and cleaned, how a row is built so the race cannot leak into
            its own inputs, how the split was cut, and why logistic regression was selected. Every number comes from the same run as the written
            report.
          </p>
        </div>
      </header>

      <SectionStrip
        label="Walkthrough sections"
        active={active}
        items={SECTIONS.map((item) => ({ id: item.id, label: item.label, href: href(`/method/${item.id}`), onClick: () => haptic("select") }))}
      />

      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-10" data-section={section}>
        <Decision />
        <Line />
        <Book />
        <Findings />
        <Build />
        <Features />
        <Models />
        <Classification />
        <Cases />
        <Limits />
      </div>
    </div>
  );
}
