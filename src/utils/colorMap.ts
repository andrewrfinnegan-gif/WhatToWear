/**
 * Map human color names to hex for rendering swatches and photoless placeholders.
 * Falls back to a neutral grey for unknown names.
 */
const MAP: Record<string, string> = {
  black: '#1A1A1A',
  white: '#F2F2F2',
  grey: '#9AA0A6',
  gray: '#9AA0A6',
  charcoal: '#36393F',
  navy: '#1F2A44',
  blue: '#3B6EA5',
  denim: '#2E4A6B',
  red: '#C0392B',
  green: '#3E7C5A',
  olive: '#6B7333',
  khaki: '#B7A57A',
  tan: '#C9A87C',
  camel: '#C19A6B',
  beige: '#D8C8A8',
  cream: '#EDE6D6',
  brown: '#6B4A2B',
  pink: '#D98AA8',
  purple: '#7D5BA6',
  yellow: '#E3C04B',
  orange: '#D98032',
};

export function colorToHex(name?: string): string {
  if (!name) return '#9AA0A6';
  return MAP[name.toLowerCase()] ?? '#9AA0A6';
}

/** Pick readable text color (black/white) for a given background hex. */
export function contrastText(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#000';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000' : '#FFF';
}
