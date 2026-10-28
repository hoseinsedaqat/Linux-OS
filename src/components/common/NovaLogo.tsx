interface NovaLogoProps {
  size?: number;
  className?: string;
  monochrome?: boolean;
}

/** NOVA mark: an orbit ring around a triangular "mountain" glyph. */
export function NovaLogo({ size = 40, className, monochrome = false }: NovaLogoProps) {
  const gradientId = monochrome ? undefined : 'nova-logo-gradient';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {!monochrome && (
        <defs>
          <linearGradient id="nova-logo-gradient" x1="4" y1="44" x2="44" y2="4" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--accent, #3ddc97)" />
            <stop offset="1" stopColor="var(--accent-2, #6ee7ff)" />
          </linearGradient>
        </defs>
      )}
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke={monochrome ? 'currentColor' : `url(#${gradientId})`}
        strokeWidth="2.4"
        opacity="0.9"
      />
      <path
        d="M24 12.5 34.5 31.5H13.5L24 12.5Z"
        fill={monochrome ? 'currentColor' : `url(#${gradientId})`}
        opacity="0.92"
      />
      <circle cx="38.5" cy="13" r="2.4" fill={monochrome ? 'currentColor' : 'var(--accent-2, #6ee7ff)'} />
    </svg>
  );
}

export function NovaWordmark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <NovaLogo size={22} />
        <strong style={{ letterSpacing: '0.12em', fontSize: 12 }}>NOVA</strong>
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <NovaLogo size={26} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <strong style={{ letterSpacing: '0.14em', fontSize: 12 }}>NOVA LINUX</strong>
        <span style={{ fontSize: 9.5, letterSpacing: '0.18em', opacity: 0.55 }}>WEB DESKTOP</span>
      </span>
    </span>
  );
}
