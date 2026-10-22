import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { LogoLockup, LogoMark, Wordmark } from "./Logo";
import { haptic } from "../lib/haptic";
import { RACES } from "../lib/data";
import { href } from "../lib/router";

interface NavItem {
  key: string;
  label: string;
  short: string;
  to: string;
  icon: IconName;
}

const LAST_RACE_KEY = "paladin:last-race";
const latest = RACES[RACES.length - 1];

export function rememberRace(path: string): void {
  try {
    sessionStorage.setItem(LAST_RACE_KEY, path);
  } catch {
    /* storage can be blocked; the default race is used instead */
  }
}

function lastRacePath(): string {
  try {
    return sessionStorage.getItem(LAST_RACE_KEY) ?? `/race/${latest.year}/${latest.slug}`;
  } catch {
    return `/race/${latest.year}/${latest.slug}`;
  }
}

function items(): NavItem[] {
  return [
    { key: "", label: "Season", short: "Season", to: "/", icon: "home" },
    { key: "race", label: "Predict", short: "Race", to: lastRacePath(), icon: "flag" },
    { key: "drivers", label: "Drivers", short: "Drivers", to: "/drivers", icon: "user" },
    { key: "circuits", label: "Circuits", short: "Tracks", to: "/circuits", icon: "track" },
    { key: "model", label: "Model", short: "Model", to: "/model", icon: "chart" },
    { key: "method", label: "Method", short: "Method", to: "/method", icon: "book" },
  ];
}

export function Shell({ section, children }: { section: string; children: ReactNode }) {
  const nav = items();
  return (
    <>
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <TopBar nav={nav} section={section} />
      <main id="main" tabIndex={-1} className="min-h-[100svh] outline-none">
        {children}
      </main>
      <Footer />
      <BottomNav nav={nav} section={section} />
    </>
  );
}

function TopBar({ nav, section }: { nav: NavItem[]; section: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${
        scrolled ? "border-line bg-tower/95 backdrop-blur-sm" : "border-transparent bg-tower/70"
      }`}
      style={{ height: "var(--nav-h)" }}
    >
      <div className="mx-auto flex h-full max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-10">
        <a href={href("/")} onClick={() => haptic("select")} className="flex shrink-0 items-center gap-2.5 no-underline" aria-label="Paladin F1, season overview">
          <LogoMark height={40} />
          <Wordmark className="h-[13px] text-ink min-[380px]:h-[15px] md:h-[16px]" />
        </a>
        <span className="hidden h-6 w-px bg-line2 lg:block" aria-hidden />
        <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex" aria-label="Primary">
          {nav.map((item) => {
            const on = item.key === section;
            return (
              <a
                key={item.key}
                href={href(item.to)}
                aria-current={on ? "page" : undefined}
                onClick={() => haptic("select")}
                className={`relative whitespace-nowrap px-2 py-2 font-display text-[1.05rem] leading-none font-semibold tracking-[0.1em] uppercase no-underline transition-colors lg:px-3 ${
                  on ? "text-ink" : "text-mute hover:text-ink"
                }`}
              >
                {item.label}
                <span
                  aria-hidden
                  className={`absolute inset-x-3 -bottom-[13px] h-[3px] origin-left bg-signal transition-transform duration-300 ${
                    on ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </a>
            );
          })}
        </nav>
        <p className="ml-auto hidden items-center gap-2 text-[0.8rem] text-mute lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-hit" aria-hidden />
          Held-out seasons 2022–2024
        </p>
        <p className="ml-auto hidden font-display text-[0.95rem] font-semibold tracking-[0.1em] text-mute uppercase min-[420px]:block md:hidden">
          {nav.find((item) => item.key === section)?.label ?? ""}
        </p>
      </div>
    </header>
  );
}

function BottomNav({ nav, section }: { nav: NavItem[]; section: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-tower/95 backdrop-blur-sm md:hidden"
      style={{ height: "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="grid h-full grid-cols-6">
        {nav.map((item) => {
          const on = item.key === section;
          return (
            <li key={item.key}>
              <a
                href={href(item.to)}
                aria-current={on ? "page" : undefined}
                onClick={() => haptic("select")}
                className={`relative flex h-full flex-col items-center justify-center gap-1 font-display text-[0.7rem] font-semibold tracking-[0.1em] uppercase no-underline ${
                  on ? "text-ink" : "text-mute"
                }`}
              >
                <span aria-hidden className={`absolute inset-x-3 top-0 h-[3px] bg-signal transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
                <Icon name={item.icon} size={20} />
                {item.short}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-tower">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-10">
        <div>
          <LogoLockup height={150} />
          <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed text-mute">
            An ACL-903 Milestone 1 project. A logistic regression, a random forest and a shallow network are trained on
            1950–2019, selected on 2020–2021, and scored on the unseen 2022–2024 seasons using only what is known after
            qualifying.
          </p>
        </div>
        <div>
          <p className="label">Explore</p>
          <ul className="mt-2 space-y-0.5 text-[1rem]">
            <li><a className="inline-block py-1 text-steel no-underline hover:text-ink" href={href("/")}>Season calendar</a></li>
            <li><a className="inline-block py-1 text-steel no-underline hover:text-ink" href={href("/drivers")}>Drivers</a></li>
            <li><a className="inline-block py-1 text-steel no-underline hover:text-ink" href={href("/circuits")}>Circuits</a></li>
            <li><a className="inline-block py-1 text-steel no-underline hover:text-ink" href={href("/model")}>The model and its limits</a></li>
            <li><a className="inline-block py-1 text-steel no-underline hover:text-ink" href={href("/method")}>Method walkthrough</a></li>
          </ul>
        </div>
        <div>
          <p className="label">Sources</p>
          <ul className="mt-3 space-y-2 text-[0.95rem] leading-snug text-mute">
            <li>Race results, laps, pit stops and standings: Kaggle / Ergast Formula 1 World Championship, 1950–2024.</li>
            <li>Circuit maps and corner numbers: F1 timing track maps via MultiViewer. Sectors and DRS usage: OpenF1 telemetry.</li>
            <li>
              Portraits: Wikimedia Commons, credited on the <a className="inline-block py-1 text-steel underline decoration-line2 underline-offset-2 hover:text-ink" href={href("/model")}>model page</a>.
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1320px] px-4 py-4 text-[0.82rem] text-mute sm:px-6 lg:px-10">Paladin F1</p>
      </div>
    </footer>
  );
}
