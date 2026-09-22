function CloseIcon({ size = 18, strokeWidth = 1.9, className = "" }) {
  return (
    <svg
      className={className || undefined}
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size ?? undefined}
      height={size ?? undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export default CloseIcon;
