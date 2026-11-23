export type ThemeName = string;

export const builtInThemeNames = [
  'dark',
  'original',
  'sepia',
  'contrast',
  'custom',
];

export function isTheme(value: unknown): value is ThemeName {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}
