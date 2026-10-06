export function Choice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`cursor-pointer border px-3 py-1.5 text-[0.95rem] ${
        pressed
          ? "border-signal bg-signal text-ink"
          : "border-line bg-transparent text-steel hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
