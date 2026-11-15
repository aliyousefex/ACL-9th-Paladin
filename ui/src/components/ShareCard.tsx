import { useEffect, useRef, useState } from "react";
import { cardBlob, renderCard, saveBlob, type CardSpec } from "../lib/card";
import { Icon } from "./Icon";

/** Copy text, reporting honestly whether it worked. */
export function useCopy(): [string, (text: string, done?: string) => Promise<void>] {
  const [status, setStatus] = useState("");
  const timer = useRef<number>(0);
  const copy = async (text: string, done = "Copied.") => {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus(done);
    } catch {
      setStatus("Your browser blocked copying. Select the text and copy it yourself.");
    }
    timer.current = window.setTimeout(() => setStatus(""), 4000);
  };
  return [status, copy];
}

/** The card, drawn live so what you see is what you download. Redraws once the site fonts have loaded. */
export function CardPreview({ spec }: { spec: CardSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const draw = () => {
      if (live && ref.current) renderCard(ref.current, spec);
    };
    draw();
    document.fonts?.ready.then(draw);
    return () => {
      live = false;
    };
  }, [spec]);
  return <canvas ref={ref} role="img" aria-label={spec.alt} className="block h-auto w-full border border-line" style={{ aspectRatio: "1200 / 630" }} />;
}

/** A card with its three ways out: save the image, copy the words, or use the phone's share sheet. */
export function ShareCard({ spec, text }: { spec: CardSpec; text: string }) {
  const [copied, copy] = useCopy();
  const [note, setNote] = useState("");
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const download = async () => {
    try {
      saveBlob(await cardBlob(spec), spec.fileName);
      setNote("Card saved.");
    } catch {
      setNote("The card could not be made in this browser.");
    }
  };
  const share = async () => {
    try {
      const blob = await cardBlob(spec);
      const file = new File([blob], spec.fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else await navigator.share({ text });
    } catch {
      /* cancelled, or not allowed: nothing to report */
    }
  };

  return (
    <div>
      <CardPreview spec={spec} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn !min-h-11" onClick={download}>
          <Icon name="arrowRight" size={16} className="rotate-90" /> Download card
        </button>
        <button type="button" className="btn btn-ghost !min-h-11" onClick={() => copy(text, "Text copied.")}>
          Copy text
        </button>
        {canShare && (
          <button type="button" className="btn btn-ghost !min-h-11" onClick={share}>
            Share…
          </button>
        )}
        <p className="text-[0.9rem] text-mute" role="status" aria-live="polite">{copied || note}</p>
      </div>
    </div>
  );
}
