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
      className={`cursor-pointer border px-2.5 py-1 font-mono text-[12px] ${
        pressed
          ? "border-ink bg-ink text-paper"
          : "border-line bg-paper text-ink hover:border-steel"
      }`}
    >
      {children}
    </button>
  );
}
