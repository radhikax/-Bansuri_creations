export const PALETTE = {
  'maroon-950': '#2B0505', 'maroon-900': '#3D0707', 'maroon-800': '#5A0A0A', 'maroon-700': '#741A1A',
  'maroon-600': '#8C3A35', 'maroon-200': '#E6CFC8', 'maroon-100': '#F3E4DF',
  'beige-50': '#FBF8F3', 'beige-100': '#F4EEE4', 'beige-200': '#EADFCF', 'beige-300': '#DCCDB8',
} as const;

export type Token = keyof typeof PALETTE;

/** [foreground, background, minimum ratio] — every pairing the UI actually uses. */
export const CONTRAST_PAIRS: Array<[Token, Token, number]> = [
  ['maroon-900', 'beige-50', 4.5], ['maroon-900', 'beige-100', 4.5], ['maroon-900', 'beige-200', 4.5],
  ['maroon-950', 'beige-50', 4.5], ['maroon-600', 'beige-50', 4.5], ['maroon-600', 'beige-100', 4.5],
  ['beige-50', 'maroon-800', 4.5], ['beige-50', 'maroon-700', 4.5], ['maroon-800', 'beige-50', 4.5],
  ['maroon-900', 'maroon-200', 4.5], ['maroon-900', 'maroon-100', 4.5],
  ['beige-300', 'beige-50', 1.0], // decorative divider only; documented exception, see note
  ['maroon-800', 'beige-200', 3.0], // focus ring / input border on inputs
];
