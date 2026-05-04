type Props = { className?: string };

/**
 * Hand-drawn-feeling SVG of a flag-and-pin sitting in a cup.
 * Single-color, inherits via currentColor.
 */
export function FlagPin({ className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Pole */}
      <path d="M14.5 4.2 C14.5 4.2 14.7 12 14.6 22" />
      {/* Flag */}
      <path d="M14.5 4.6 C18 5 21.5 6.5 24 5.2 C22.6 7.2 22.4 9.4 24 11.4 C21 10.2 17.6 11 14.6 11.6" />
      {/* Cup rim (slight ellipse) */}
      <ellipse cx="14.7" cy="22.6" rx="6" ry="1.4" />
      {/* Cup walls */}
      <path d="M8.8 22.6 C9.2 24.6 10.2 26 14.7 26.2 C19.2 26 20.2 24.6 20.6 22.6" />
    </svg>
  );
}
