export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} aria-hidden="true">
      <rect x="56" y="22" width="16" height="84" rx="8" />
      <rect x="56" y="22" width="16" height="84" rx="8" transform="rotate(60 64 64)" />
      <rect x="56" y="22" width="16" height="84" rx="8" transform="rotate(120 64 64)" />
    </svg>
  );
}
