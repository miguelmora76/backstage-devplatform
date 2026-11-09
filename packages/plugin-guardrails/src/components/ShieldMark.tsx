/** The placeholder shield mark; replaceable in this one place (design-system-mapping). */
export function ShieldMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#1F3A93"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2L4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z" />
    </svg>
  );
}
