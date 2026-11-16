/** Country flag from /flags/XX.svg (3:2). Decorative: the country is always named in text next to it. */
/** A country flag. Decorative: the country is always written beside it. `large` is for a flag that heads a card. */
export function Flag({ code, className = "", large = false }: { code: string | null | undefined; className?: string; large?: boolean }) {
  if (!code) return null;
  return (
    <img
      src={`${import.meta.env.BASE_URL}flags/${code}.svg`}
      alt=""
      width={large ? 30 : 18}
      height={large ? 20 : 12}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 border border-line2 object-cover ${large ? "h-5 w-[30px]" : "h-3 w-[18px]"} ${className}`}
    />
  );
}
