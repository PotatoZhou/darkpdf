import * as vscode from 'vscode';
import { ThemeName } from './themes';

export const configurationSection = 'darkpdf';

export interface ThemeDefinition {
  name: string;
  hue?: number;
  saturation?: number;
  brightness?: number;
  contrast?: number;
  sepia?: number;
  invert?: number;
  paperColor: string;
}

export interface PreviewDefaults {
  cursor: string;
  scale: string;
  sidebar: boolean;
  scrollMode: string;
  spreadMode: string;
  colorMode: boolean;
  invert: number;
  autoHideToolbar: boolean;
  theme: ThemeName;
  paperColor: string;
  customFilter: string;
  keepImageColor: boolean;
  restoreState: boolean;
  fontFamily: string;
  themes: ThemeDefinition[];
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readThemeDefinitions(
  config: vscode.WorkspaceConfiguration
): ThemeDefinition[] {
  const raw = config.get<unknown[]>('themes', []);
  const themes: ThemeDefinition[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const name = entry.name;
    if (typeof name !== 'string' || name.length === 0) {
      continue;
    }
    themes.push({
      name: name,
      hue: readNumber(entry.hue),
      saturation: readNumber(entry.saturation),
      brightness: readNumber(entry.brightness),
      contrast: readNumber(entry.contrast),
      sepia: readNumber(entry.sepia),
      invert: readNumber(entry.invert),
      paperColor: typeof entry.paperColor === 'string' ? entry.paperColor : '',
    });
  }
  return themes;
}

export function readPreviewDefaults(): PreviewDefaults {
  const config = vscode.workspace.getConfiguration(configurationSection);
  return {
    cursor: config.get('default.cursor', 'select'),
    scale: config.get('default.scale', 'auto'),
    sidebar: config.get('default.sidebar', false),
    scrollMode: config.get('default.scrollMode', 'vertical'),
    spreadMode: config.get('default.spreadMode', 'none'),
    colorMode: config.get('default.colorMode', true),
    invert: config.get('default.invert', 100),
    autoHideToolbar: config.get('default.autoHideToolbar', true),
    theme: config.get('default.theme', 'dark'),
    paperColor: config.get('default.paperColor', ''),
    customFilter: config.get('default.customFilter', ''),
    keepImageColor: config.get('default.keepImageColor', false),
    restoreState: config.get('default.restoreState', true),
    fontFamily: vscode.workspace
      .getConfiguration('editor')
      .get<string>('fontFamily', ''),
    themes: readThemeDefinitions(config),
  };
}
