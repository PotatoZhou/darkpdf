import * as vscode from 'vscode';
import { PdfEditorProvider } from '../editor/pdfEditorProvider';
import { registerNavigationCommands } from './navigationCommands';
import { registerThemeCommands } from './themeCommands';
import { registerViewCommands } from './viewCommands';

export function registerCommands(
  provider: PdfEditorProvider
): vscode.Disposable[] {
  return [
    ...registerThemeCommands(provider),
    ...registerViewCommands(provider),
    ...registerNavigationCommands(provider),
  ];
}
