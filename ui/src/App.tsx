import { useEffect, useState } from "react";
import { MobileNav, Tower } from "./components/Tower";
import { SECTIONS } from "./lib/sections";
import { Book } from "./sections/Book";
import { Build } from "./sections/Build";
import { Cases } from "./sections/Cases";
import { Classification } from "./sections/Classification";
import { Decision } from "./sections/Decision";
import { Features } from "./sections/Features";
import { Findings } from "./sections/Findings";
import { Limits } from "./sections/Limits";
import { Models } from "./sections/Models";

export default function App() {
  const active = useActiveSection();

  return (
    <>
      <a
        href="#decision"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to the decision
      </a>
      <Tower active={active} />
      <MobileNav active={active} />
      <main className="px-5 py-8 md:ml-56 md:px-12 md:py-12">
        <div className="mx-auto max-w-3xl">
          <Decision />
          <Book />
          <Findings />
          <Build />
          <Features />
          <Models />
          <Classification />
          <Cases />
          <Limits />
        </div>
      </main>
    </>
  );
}

function useActiveSection(): string {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.28;
      let current: string = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const node = document.getElementById(section.id);
        if (node && node.getBoundingClientRect().top <= line) current = section.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return active;
}
