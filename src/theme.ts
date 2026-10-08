// Generates textures as inline SVG data-URIs and exposes them as CSS variables,
// so the single-file build needs no external image assets.

const cardBack = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" preserveAspectRatio="none">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="78%">
      <stop offset="0" stop-color="#34559f"/>
      <stop offset="0.55" stop-color="#1a2d70"/>
      <stop offset="1" stop-color="#0a1238"/>
    </radialGradient>
    <pattern id="p" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 4.5H9M4.5 0V9" stroke="#e8c66a" stroke-width="0.35" opacity="0.5"/>
      <circle cx="4.5" cy="4.5" r="0.8" fill="#f3d98a" opacity="0.75"/>
    </pattern>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbe9a0"/>
      <stop offset="1" stop-color="#b8861b"/>
    </linearGradient>
  </defs>
  <rect width="100" height="140" fill="#f6f1e6"/>
  <rect x="4" y="4" width="92" height="132" rx="5" fill="url(#bg)"/>
  <rect x="4" y="4" width="92" height="132" rx="5" fill="url(#p)"/>
  <rect x="9" y="9" width="82" height="122" rx="3" fill="none" stroke="url(#g)" stroke-width="1.2"/>
  <rect x="12" y="12" width="76" height="116" rx="2" fill="none" stroke="#e8c66a" stroke-width="0.4" opacity="0.7"/>
  <g transform="translate(50 70)">
    <circle r="22" fill="#0d1a4a" stroke="url(#g)" stroke-width="1.5"/>
    <circle r="18" fill="none" stroke="#e8c66a" stroke-width="0.5"/>
    <path d="M0 -14 L10 0 L0 14 L-10 0 Z" fill="url(#g)"/>
    <path d="M0 -8 L5 0 L0 8 L-5 0 Z" fill="#0d1a4a"/>
    <circle r="2" fill="url(#g)"/>
  </g>
  <g fill="url(#g)">
    <path d="M18 18 l3 3 l-3 3 l-3 -3 Z"/>
    <path d="M82 18 l3 3 l-3 3 l-3 -3 Z"/>
    <path d="M18 116 l3 3 l-3 3 l-3 -3 Z"/>
    <path d="M82 116 l3 3 l-3 3 l-3 -3 Z"/>
  </g>
</svg>`;

const noise = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
  <filter id="n" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)"/>
</svg>`;

const uri = (svg: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}")`;

export function installTheme(): void {
  const root = document.documentElement;
  root.style.setProperty("--card-back", uri(cardBack));
  root.style.setProperty("--noise", uri(noise));
}
