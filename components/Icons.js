// Iconos vectoriales minimalistas (stroke 1.5). Sin dependencias externas.
const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconLeaf = (p) => (
  <svg {...base} {...p}><path d="M4 20s0-9 8-13 12-3 12-3-1 8-5 12-11 7-15 4Z" /><path d="M4 20c4-4 8-7 14-10" /></svg>
);
export const IconDroplet = (p) => (
  <svg {...base} {...p}><path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z" /></svg>
);
export const IconTrend = (p) => (
  <svg {...base} {...p}><path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" /></svg>
);
export const IconLayers = (p) => (
  <svg {...base} {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 18 9 5 9-5" /></svg>
);
export const IconMapPin = (p) => (
  <svg {...base} {...p}><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" /><circle cx="12" cy="9" r="2.5" /></svg>
);
export const IconPolygon = (p) => (
  <svg {...base} {...p}><path d="M12 3 21 9v6l-9 6-9-6V9l9-6Z" /></svg>
);
export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 3v13" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></svg>
);
export const IconFile = (p) => (
  <svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></svg>
);
export const IconSprout = (p) => (
  <svg {...base} {...p}><path d="M12 20v-6" /><path d="M12 14c-4 0-6-3-6-6 4 0 6 3 6 6Z" /><path d="M12 14c4 0 6-2 6-5-4 0-6 2-6 5Z" /></svg>
);
export const IconAlert = (p) => (
  <svg {...base} {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5" /><circle cx="12" cy="18" r=".8" fill="currentColor" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="m5 12 5 5L20 7" /></svg>
);
export const IconInfo = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".8" fill="currentColor" /></svg>
);
export const IconX = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconSatellite = (p) => (
  <svg {...base} {...p}><path d="M5 13 11 7l4 4-6 6-4-4Z" /><path d="m13 5 6 6" /><path d="M17 3v4h4" /><path d="M3 17v4h4" /><path d="M7 21a4 4 0 0 0 4-4" /></svg>
);
