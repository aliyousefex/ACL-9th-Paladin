import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { BackToTop } from "./BackToTop";
import { CommandPalette } from "./CommandPalette";
import { LogoMark, Wordmark } from "./Logo";
import { haptic } from "../lib/haptic";
import { RACES } from "../lib/data";
import { useSlidingPill } from "../lib/hooks";
import { href } from "../lib/router";
import { useSectionNav } from "../lib/sectionNav";

interface NavItem {
  key: string;
  label: string;
  short: string;
  to: string;
  icon: IconName;
  /** Other sections that live under this destination, so the viewer is always shown where they are. */
  children?: string[];
}

/** True when `section` is this destination or one of the pages that belongs to it. */
export function isCurrent(item: Pick<NavItem, "key" | "children">, section: string): boolean {
  return item.key === section || (item.children ?? []).includes(section);
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
    { key: "", label: "Season", short: "Season", to: "/", icon: "calendar", children: ["drivers", "teams", "circuits", "history", "league"] },
    { key: "race", label: "Race", short: "Race", to: lastRacePath(), icon: "flagGrid" },
    { key: "analysis", label: "Analysis", short: "Errors", to: "/analysis", icon: "target" },
    { key: "race-lab", label: "Lab", short: "Lab", to: "/race-lab", icon: "flask" },
    { key: "model", label: "Research", short: "Research", to: "/model", icon: "bookOpen", children: ["method", "guide"] },
  ];
}

/** How far a reader scrolls in one go before the capsule answers: a little to put it away, a deliberate pull to bring it back. */
export const HIDE_AFTER = 24;
export const SHOW_AFTER = 56;

/**
 * On a phone, slide the brand bar away while reading and bring it back on a pull upward. The rule: past 80px of scroll,
 * scrolling down by 24px in one go hides it and scrolling up by 56px in one go shows it. The distance is counted from the last
 * change of direction, so the small slips of a thumb never add up to a toggle (at 10px each way it flickered in and out, and
 * took the page's section strip with it every time). Focusing anything in the header shows it, so a keyboard or screen-reader
 * user can never land on something that is off screen. Wider screens never hide it.
 */
function useCompactChrome(): void {
  useEffect(() => {
    const root = document.documentElement;
    const phone = window.matchMedia("(max-width: 767px)");
    let last = window.scrollY;
    let travel = 0; // signed distance scrolled since the direction last changed
    const set = (compact: boolean) => {
      if (compact) root.dataset.chrome = "compact";
      else delete root.dataset.chrome;
    };
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      if (!phone.matches || y < 80) {
        set(false);
        travel = 0;
        return;
      }
      if (delta === 0) return;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > HIDE_AFTER) set(true);
      else if (travel < -SHOW_AFTER) set(false);
    };
    const onFocus = (event: FocusEvent) => {
      if ((event.target as HTMLElement | null)?.closest("header.chrome-bar")) set(false);
    };
    const onWidth = () => !phone.matches && set(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocus);
    phone.addEventListener("change", onWidth);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
      phone.removeEventListener("change", onWidth);
      set(false);
    };
  }, []);
}

export function Shell({ section, children }: { section: string; children: ReactNode }) {
  useCompactChrome();
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
      <Dock nav={nav} section={section} />
      <BackToTop />
    </>
  );
}

/** Pages that belong to a destination without a place in the bar. They live under "More", and the destination that owns them stays marked. */
export const MORE: { key: string; label: string; detail: string; to: string }[] = [
  { key: "method", label: "Method and data", detail: "The pipeline, step by step", to: "/method" },
  { key: "guide", label: "How to read this site", detail: "What every marker and value means", to: "/guide" },
  { key: "history", label: "History graph", detail: "Drivers, teams and races as a graph", to: "/history" },
  { key: "league", label: "Season league", detail: "Pick podiums blind and keep score", to: "/league" },
  { key: "drivers", label: "Driver archive", detail: "Every driver in the data", to: "/drivers" },
  { key: "teams", label: "Team archive", detail: "Every team and who ran it", to: "/teams" },
  { key: "circuits", label: "Circuit archive", detail: "Every circuit and its maps", to: "/circuits" },
];

const ownedByMore = (section: string): boolean => MORE.some((entry) => entry.key === section);

/**
 * What the top bar's two dropdowns share (More, and the current section). Each is a disclosure, not an ARIA menu: a button that
 * shows a short list of links, which stay in the page and in the tab order while it is open. Escape closes it and returns focus to
 * the button, and so does moving focus away from it, pressing outside, or changing page.
 *
 * With a mouse, in the top bar, it also opens by itself when the pointer rests on it, after a moment's intent so a pointer
 * passing over it does not trigger it, and closes shortly after the pointer leaves it and its list. Clicking it while it is open
 * that way keeps it open (the reader has said they want it); a second click closes it. A touch has no hover, so there it is a
 * plain toggle, and the keyboard is unchanged.
 */
function useDisclosure(hoverable: boolean) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pinned = useRef(false); // opened by a click or a key: it stays until it is dismissed
  const timer = useRef<number | undefined>(undefined);
  const close = (restoreFocus = false) => {
    window.clearTimeout(timer.current);
    pinned.current = false;
    setOpen(false);
    if (restoreFocus) button.current?.focus();
  };
  const hover = (event: React.PointerEvent, entering: boolean) => {
    if (!hoverable || event.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    if (entering) timer.current = window.setTimeout(() => setOpen(true), 70);
    else if (!pinned.current) timer.current = window.setTimeout(() => setOpen(false), 260);
  };
  const toggle = () => {
    window.clearTimeout(timer.current);
    if (open && !pinned.current) pinned.current = true; // opened by hovering: the click keeps it open
    else if (open) close();
    else {
      pinned.current = true;
      setOpen(true);
    }
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onFocus = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onHash = () => close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
    };
  }, [open]);

  return {
    open,
    root,
    button,
    close,
    toggle,
    hoverProps: {
      onPointerEnter: (event: React.PointerEvent) => hover(event, true),
      onPointerLeave: (event: React.PointerEvent) => hover(event, false),
    },
  };
}

/** The "More" disclosure: the pages that belong to a destination without a place in the bar. The list is always in the markup (hidden when closed). */
function MoreMenu({ section, placement }: { section: string; placement: "down" | "up" }) {
  const menu = useDisclosure(placement === "down");
  const panelId = useId();
  const owns = ownedByMore(section);
  return (
    <div ref={menu.root} className="more" {...menu.hoverProps}>
      <button
        ref={menu.button}
        type="button"
        className={placement === "down" ? "site-nav__link" : "dock__item"}
        aria-expanded={menu.open}
        aria-controls={panelId}
        data-owns={owns ? "true" : undefined}
        onClick={() => {
          haptic("select");
          menu.toggle();
        }}
      >
        {placement === "down" ? (
          <>
            More
            <Icon name="chevronDown" size={14} className={`more__chevron ${menu.open ? "rotate-180" : ""}`} />
          </>
        ) : (
          <>
            <Icon name="more" size={20} strokeWidth={2.6} />
            More
          </>
        )}
      </button>
      <div id={panelId} hidden={!menu.open} className={`more-panel more-panel--${placement === "down" ? "down" : "up"}`}>
        {MORE.map((entry) => (
          <a
            key={entry.key}
            href={href(entry.to)}
            data-active={entry.key === section ? "true" : undefined}
            className="more-item"
            onClick={() => {
              haptic("select");
              menu.close();
            }}
          >
            <span className="min-w-0">
              <span className="more-item__label">{entry.label}</span>
              <span className="more-item__detail">{entry.detail}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * The current section, as a dropdown in the top bar. A page with sections (a race, the method, the model) has its own strip of
 * them in the page; when that strip reaches the bar it melts into this: the strip fades up into the bar and this chip grows
 * in beside the logo, naming the section the reader is in, and opens a list of all of them. So the bar and the strip are never
 * two bars. It is only in the markup of pages that have sections, and only reachable (focusable, openable) while the strip is
 * stuck. The page's own strip is the way around while the chip is not showing.
 */
function SectionMenu() {
  const nav = useSectionNav();
  const menu = useDisclosure(true);
  const panelId = useId();
  const showing = !!nav?.stuck;
  useEffect(() => {
    if (!showing) menu.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing]);
  if (!nav) return null;
  const current = nav.items.find((item) => item.id === nav.active) ?? nav.items[0];
  return (
    <div ref={menu.root} className="section-menu" data-stuck={showing ? "true" : undefined} {...menu.hoverProps}>
      <button
        ref={menu.button}
        type="button"
        className="section-chip"
        aria-expanded={menu.open}
        aria-controls={panelId}
        aria-label={`${nav.label}: ${current.label}. Choose a section`}
        tabIndex={showing ? 0 : -1}
        onClick={() => {
          haptic("select");
          menu.toggle();
        }}
      >
        <Icon name="menu" size={16} strokeWidth={2} />
        <span className="section-chip__label">{current.label}</span>
        <Icon name="chevronDown" size={14} className={`section-chip__chevron ${menu.open ? "rotate-180" : ""}`} />
      </button>
      <nav id={panelId} aria-label={nav.label} hidden={!menu.open || !showing} className="section-panel">
        <ul>
          {nav.items.map((item) => (
            <Fragment key={item.id}>
              {item.divider && (
                <li aria-hidden className="section-panel__divider">
                  <span className="subnav__flag" /> Lights out
                </li>
              )}
              <li>
                <a
                  href={item.href}
                  aria-current={nav.active === item.id ? "true" : undefined}
                  className="section-panel__link"
                  onClick={(event) => {
                    haptic("select");
                    item.onClick?.(event);
                    menu.close();
                  }}
                >
                  {item.label}
                </a>
              </li>
            </Fragment>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * The bar: a floating capsule with the brand, the destinations (a solid pill slides to the current one), and search. On a phone it carries only the brand and the tools, since the destinations move to the dock.
 */
function TopBar({ nav, section }: { nav: NavItem[]; section: string }) {
  const current = nav.find((item) => isCurrent(item, section));
  const { ref, ready } = useSlidingPill<HTMLElement>(current ? current.key : null);
  return (
    <header className="chrome-bar site-bar fixed inset-x-0 top-0 z-50">
      <div className="site-bar__inner">
        <div className="site-bar__lead">
          <a href={href("/")} onClick={() => haptic("select")} className="nav-brand flex shrink-0 items-center no-underline" aria-label="Paladin F1, season overview">
            <LogoMark height={34} />
          </a>
          <SectionMenu />
        </div>
        <nav ref={ref} className="site-nav" data-ready={ready ? "true" : "false"} aria-label="Primary">
          <span aria-hidden className="site-nav__pill" />
          {nav.map((item) => (
            <a
              key={item.key}
              href={href(item.to)}
              data-nav-key={item.key}
              aria-current={current === item ? "page" : undefined}
              onClick={() => haptic("select")}
              className="site-nav__link"
            >
              {item.label}
            </a>
          ))}
          <MoreMenu section={section} placement="down" />
        </nav>
        <div className="site-bar__tools">
          <CommandPalette />
        </div>
      </div>
    </header>
  );
}

/** The phone's destinations: a capsule at the thumb, one slot per destination plus More, with the same sliding pill. */
function Dock({ nav, section }: { nav: NavItem[]; section: string }) {
  const index = nav.findIndex((item) => isCurrent(item, section));
  const style: CSSProperties = { ["--i" as string]: Math.max(index, 0), ["--n" as string]: nav.length + 1, ["--on" as string]: index >= 0 ? 1 : 0 };
  return (
    <nav className="dock" aria-label="Primary" style={style}>
      <span aria-hidden className="dock__pill" />
      {nav.map((item, position) => (
        <a
          key={item.key}
          href={href(item.to)}
          aria-current={position === index ? "page" : undefined}
          onClick={() => haptic("select")}
          className="dock__item"
        >
          <Icon name={item.icon} size={22} strokeWidth={1.7} />
          {item.short}
        </a>
      ))}
      <MoreMenu section={section} placement="up" />
    </nav>
  );
}

const FOOTER_LINKS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Season calendar", to: "/" },
      { label: "Error Atlas", to: "/analysis" },
      { label: "Race Lab", to: "/race-lab" },
      { label: "Season league", to: "/league" },
    ],
  },
  {
    title: "Archives",
    links: [
      { label: "Drivers", to: "/drivers" },
      { label: "Teams", to: "/teams" },
      { label: "Circuits", to: "/circuits" },
      { label: "History graph", to: "/history" },
    ],
  },
  {
    title: "Understand",
    links: [
      { label: "The model and its limits", to: "/model" },
      { label: "Method walkthrough", to: "/method" },
      { label: "How to read this site", to: "/guide" },
    ],
  },
];

/** The brand with one paragraph about the project, and the way around the site. */
function Footer() {
  return (
    <footer className="site-footer mt-24 border-t border-line bg-tower">
      <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-20">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark height={32} />
              <Wordmark className="h-[15px] text-ink" />
            </div>
            <p className="mt-5 max-w-[42ch] text-[0.95rem] leading-relaxed text-mute">
              An ACL-903 Milestone 1 project. A logistic regression, a random forest and a shallow network are trained on 1950–2019,
              selected on 2020–2021, and scored on the unseen 2022–2024 seasons using only what is known after qualifying.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            {FOOTER_LINKS.map((group, index) => (
              <div key={group.title} className={index === FOOTER_LINKS.length - 1 ? "col-span-2 sm:col-span-1" : undefined}>
                <p className="label">{group.title}</p>
                <ul className={`mt-2 ${index === FOOTER_LINKS.length - 1 ? "grid grid-cols-2 gap-x-6 sm:block" : ""}`}>
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <a className="flex min-h-11 items-center text-[0.95rem] text-steel no-underline transition-colors hover:text-ink" href={href(link.to)}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
