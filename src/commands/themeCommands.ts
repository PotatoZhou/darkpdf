import * as vscode from 'vscode';
import { readPreviewDefaults } from '../configuration';
import { PdfEditorProvider } from '../editor/pdfEditorProvider';

interface ThemeQuickPickItem {
  label: string;
  description?: string;
  theme?: string;
  action?: 'invert';
}

function themeItems(): ThemeQuickPickItem[] {
  const items: ThemeQuickPickItem[] = [
    { label: 'Dark', description: 'Invert and keep colors', theme: 'dark' },
    { label: 'Original', description: 'No darkening', theme: 'original' },
    { label: 'Sepia', description: 'Warm paper tint', theme: 'sepia' },
    { label: 'Contrast', description: 'Stronger contrast', theme: 'contrast' },
  ];
  for (const theme of readPreviewDefaults().themes) {
    items.push({
      label: theme.name,
      description: 'Custom theme',
      theme: theme.name,
    });
  }
  items.push({
    label: 'Custom',
    description: 'From settings',
    theme: 'custom',
  });
  items.push({
    label: 'Set inversion…',
    description: '0–100%',
    action: 'invert',
  });
  return items;
}

async function pickTheme(provider: PdfEditorProvider): Promise<void> {
  const picked = await vscode.window.showQuickPick(themeItems(), {
    placeHolder: 'Choose a color preset for the active PDF',
  });
  if (!picked) {
    return;
  }
  if (picked.theme) {
    provider.setTheme(picked.theme);
    return;
  }
  if (picked.action === 'invert') {
    const value = await vscode.window.showInputBox({
      prompt: 'Inversion from 0 (original colors) to 100 (fully inverted)',
      value: '70',
      validateInput: (input) => {
        const parsed = Number(input);
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
          ? undefined
          : 'Enter a number between 0 and 100.';
      },
    });
    if (value !== undefined && value !== '') {
      provider.setInvert(Number(value));
    }
  }
}

export function registerThemeCommands(
  provider: PdfEditorProvider
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('darkpdf.toggleTheme', () => {
      provider.toggleTheme();
    }),
    vscode.commands.registerCommand('darkpdf.pickTheme', () => {
      pickTheme(provider);
    }),
  ];
}
