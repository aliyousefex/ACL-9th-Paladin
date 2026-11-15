import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { navigate } from "../lib/router";
import { prepare, search, type SearchItem, type SearchKind } from "../lib/search";
import { buildIndex, suggestions } from "../lib/searchIndex";

const KIND_LABEL: Record<SearchKind, string> = { page: "Page", race: "Race", driver: "Driver", circuit: "Circuit" };

function editable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node?.tagName) return false;
  return node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

/**
 * Search for any race, driver, circuit or page. Opens from the header button, from Ctrl/Cmd+K, or from "/" when no field
 * is focused. A combobox over a listbox: arrow keys move, Enter opens, Escape closes and returns focus to the button.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const prepared = useMemo(() => prepare(buildIndex()), []);
  const results = useMemo(() => search(prepared, text, 10, suggestions()), [prepared, text]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !editable(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setText("");
    setActive(0);
    trigger.current?.focus();
  };
  const choose = (item: SearchItem | undefined) => {
    if (!item) return;
    navigate(item.to);
    close();
  };

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (results.length ? (value + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (results.length ? (value - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      event.preventDefault(); // one tab stop inside the dialog; the list is driven from the field
    }
  };

  useEffect(() => {
    document.getElementById(`palette-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search races, drivers and pages"
        aria-keyshortcuts="Control+K Meta+K /"
        title="Search (Ctrl K)"
        className="site-tool shrink-0"
      >
        <Icon name="search" size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/65 px-3 pt-[10vh] sm:px-4" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label="Search races, drivers and pages" className="w-full max-w-[40rem] border border-line2 bg-tower shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Icon name="search" size={18} className="shrink-0 text-mute" />
              <input
                ref={input}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-autocomplete="list"
                aria-activedescendant={results.length ? `palette-option-${active}` : undefined}
                aria-label="Search"
                value={text}
                placeholder="Search a Grand Prix, driver, circuit or page"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setText(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                className="min-h-14 w-full bg-transparent text-[1.05rem] text-ink placeholder:text-mute focus:outline-none"
              />
              <button type="button" onClick={close} className="shrink-0 px-2 py-2 text-[0.85rem] text-mute hover:text-ink" aria-label="Close search">
                Esc
              </button>
            </div>
            {results.length === 0 ? (
              <p className="px-4 py-6 text-steel">Nothing matches “{text}”. Try a Grand Prix, a driver's surname or a country.</p>
            ) : (
              <ul id="palette-list" role="listbox" aria-label={text ? "Results" : "Suggestions"} className="max-h-[min(24rem,55vh)] overflow-y-auto py-1">
                {results.map((item, i) => (
                  <li
                    key={item.id}
                    id={`palette-option-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => active !== i && setActive(i)}
                    onClick={() => choose(item)}
                    className={`flex cursor-pointer items-baseline gap-3 px-4 py-2.5 ${i === active ? "bg-panel2" : ""}`}
                  >
                    <span className="w-16 shrink-0 font-display text-[0.8rem] font-semibold tracking-wide text-mute uppercase">{KIND_LABEL[item.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[1.1rem] leading-tight font-semibold uppercase text-ink">{item.title}</span>
                      <span className="block truncate text-[0.85rem] text-mute">{item.subtitle}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="sr-only" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"}</p>
            <p className="border-t border-line px-4 py-2 text-[0.8rem] text-mute">Up and down to move · Enter to open · Esc to close</p>
          </div>
        </div>
      )}
    </>
  );
}
