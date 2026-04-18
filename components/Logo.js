'use client';

// Logo Agropulse
// Concepto: hoja botánica (agricultura) con una red triangulada de nodos
// interconectados (tecnología / monitoreo). Líneas finas, estilo "simplista detallado".
// El color se controla vía `currentColor` para poder heredar el tono del contenedor.

export default function Logo({
  size = 40,
  stroke = '#10B981',
  nodeFill = '#10B981',
  className = '',
  title = 'Agropulse',
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <g fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
        {/* Hoja: almendra simétrica formada por dos Bézier cúbicas */}
        <path
          d="M32 5 C 50 16 52 38 32 59 C 12 38 14 16 32 5 Z"
          strokeWidth="1.4"
        />
        {/* Nervadura central */}
        <path
          d="M32 9 L 32 56"
          strokeWidth="0.8"
          strokeOpacity="0.45"
        />
        {/* Nervaduras laterales sutiles */}
        <path d="M32 20 L 22 26" strokeWidth="0.6" strokeOpacity="0.35" />
        <path d="M32 20 L 42 26" strokeWidth="0.6" strokeOpacity="0.35" />
        <path d="M32 38 L 22 44" strokeWidth="0.6" strokeOpacity="0.35" />
        <path d="M32 38 L 42 44" strokeWidth="0.6" strokeOpacity="0.35" />

        {/* Red: aristas entre nodos */}
        <g strokeWidth="1" strokeOpacity="0.95">
          <line x1="32" y1="17" x2="22" y2="28" />
          <line x1="32" y1="17" x2="42" y2="28" />
          <line x1="22" y1="28" x2="42" y2="28" />
          <line x1="22" y1="28" x2="32" y2="42" />
          <line x1="42" y1="28" x2="32" y2="42" />
          <line x1="32" y1="42" x2="32" y2="52" />
        </g>

        {/* Nodos */}
        <g fill={nodeFill} stroke="none">
          <circle cx="32" cy="17" r="2.1" />
          <circle cx="22" cy="28" r="2.1" />
          <circle cx="42" cy="28" r="2.1" />
          <circle cx="32" cy="42" r="2.1" />
          <circle cx="32" cy="52" r="1.6" />
        </g>
      </g>
    </svg>
  );
}

/** Wordmark + logo (versión horizontal para headers). */
export function LogoMark({ size = 32, className = '', subtitle = 'Satellite Intelligence' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={size} />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-ink-100">
          Agro<span className="text-accent-400">pulse</span>
        </div>
        {subtitle && (
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
