import { PreviewDefaults, isTheme } from '../configuration';

export interface PreviewState {
  invert: number;
  theme: PreviewDefaults['theme'];
  scale: string;
  page: number;
}

export function sanitizePreviewState(state: unknown): PreviewState | undefined {
  if (!state || typeof state !== 'object') {
    return undefined;
  }
  const raw = state as Record<string, unknown>;
  const invert = Number(raw.invert);
  const page = Number(raw.page);
  return {
    invert: Number.isFinite(invert) ? Math.max(0, Math.min(100, invert)) : 0,
    theme: isTheme(raw.theme) ? raw.theme : 'dark',
    scale: typeof raw.scale === 'string' ? raw.scale : '',
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/**
 * State reported before the webview has sent anything, built from the
 * configured defaults, so the status bar has something to show right away.
 */
export function defaultPreviewState(defaults: PreviewDefaults): PreviewState {
  return {
    invert: defaults.colorMode ? defaults.invert : 0,
    theme: defaults.theme,
    scale: defaults.scale,
    page: 1,
  };
}
