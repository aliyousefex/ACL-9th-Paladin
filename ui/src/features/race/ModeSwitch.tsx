import { Tabs } from "../../components/Bits";
import { EXPERT_TOOLS, type ViewMode } from "../../lib/mode";

/** Simple follows one path through the race; Expert adds every tool. The choice is remembered in this browser. */
export function ModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (next: ViewMode) => void }) {
  return (
    <Tabs<ViewMode>
      value={mode}
      onChange={onChange}
      idPrefix="mode"
      label="Level of detail"
      size="sm"
      options={[
        { id: "simple", label: "Simple" },
        { id: "expert", label: "Expert" },
      ]}
    />
  );
}

/** Shown at the end of the Simple view, so nothing is hidden without saying where it went. */
export function MoreTools({ onExpert }: { onExpert: () => void }) {
  return (
    <section aria-labelledby="more-tools" className="panel px-4 py-6 sm:px-6">
      <h2 id="more-tools" className="panel-title text-ink">More tools are one switch away</h2>
      <p className="mt-2 max-w-[68ch] text-steel">
        This is the Simple view: it follows one path through the race. Expert view adds the {EXPERT_TOOLS.length} tools below. Some of them open only after the result is revealed, because they use what happened in the race.
      </p>
      <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXPERT_TOOLS.map((tool) => (
          <li key={tool.id} className="text-[0.95rem] leading-snug text-steel">
            <strong className="font-display text-[1.05rem] font-semibold text-ink uppercase">{tool.label}</strong>
            <span className="block text-mute">{tool.detail}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn mt-6" onClick={onExpert}>
        Switch to Expert view
      </button>
    </section>
  );
}
