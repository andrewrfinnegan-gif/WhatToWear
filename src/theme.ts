/**
 * Design tokens. A clean, calm palette — the UI is the product here, so spacing
 * and type scale are deliberately generous. Dark-first to make garment photos pop.
 */

export const colors = {
  bg: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#1F242D',
  border: '#2A313C',
  text: '#F5F7FA',
  textMuted: '#9AA4B2',
  textFaint: '#6B7280',
  accent: '#7C9CFF',
  accentSoft: '#2A3354',
  success: '#5BD6A0',
  warning: '#F2C14E',
  danger: '#F2685C',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  h1: { fontSize: 30, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  bodyMuted: { fontSize: 15, fontWeight: '400' as const, color: colors.textMuted },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.text },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;
