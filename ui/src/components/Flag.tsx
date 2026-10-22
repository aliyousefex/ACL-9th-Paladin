/** Country flag from /flags/XX.svg (3:2). Decorative: the country is always named in text next to it. */
export function Flag({ code, className = "" }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  return (
    <img
      src={`${import.meta.env.BASE_URL}flags/${code}.svg`}
      alt=""
      width={18}
      height={12}
      loading="lazy"
      decoding="async"
      className={`inline-block h-3 w-[18px] shrink-0 border border-white/20 object-cover ${className}`}
    />
  );
}
