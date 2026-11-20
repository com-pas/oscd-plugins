/**
 * Dev-only host theme meta (labels + class names).
 * Variable values live in host-theme-presets.css. Brand and mode are
 * separate classes on <html> (for example html.openscd.light).
 * Production must never import this.
 */

export type ThemeMode = 'light' | 'dark';
export type ThemeBrand = 'openscd' | 'bearingpoint' | 'weidmueller';

export interface HostThemePreset {
  brand: ThemeBrand;
  label: string;
}
export const HOST_MODE_PRESETS: ThemeMode[] = ['light', 'dark'];
export const HOST_THEME_PRESETS: HostThemePreset[] = [
  { brand: 'openscd', label: 'OpenSCD' },
  { brand: 'bearingpoint', label: 'BearingPoint' },
  { brand: 'weidmueller', label: 'Weidmueller' },
];

/** Brand class names on <html> (mode is a separate class). */
export const HOST_THEME_CLASSES: string[] = HOST_THEME_PRESETS.map((p) => p.brand);

export const HOST_THEME_DEFAULT_BRAND: ThemeBrand = 'openscd';
export const HOST_THEME_DEFAULT_MODE: ThemeMode = 'light';

function isThemeBrand(value: string): value is ThemeBrand {
  return HOST_THEME_PRESETS.some((p) => p.brand === value);
}

/** Map stored/query brand ids to a current ThemeBrand. */
export function normalizeBrand(value: string | undefined): ThemeBrand | undefined {
  if (!value) return undefined;
  if (isThemeBrand(value)) return value;
  return undefined;
}
