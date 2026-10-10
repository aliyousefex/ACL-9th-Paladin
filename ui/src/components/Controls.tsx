import { haptic } from "../lib/haptic";

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
      onClick={() => {
        haptic("select");
        onClick();
      }}
      className="switch"
    >
      {children}
    </button>
  );
}
