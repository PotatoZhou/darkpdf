import * as vscode from 'vscode';
import { PdfEditorProvider } from '../editor/pdfEditorProvider';
import { PreviewAction } from '../editor/previewMessages';

const navigationActions: Array<{
  command: string;
  action: PreviewAction;
}> = [
  { command: 'darkpdf.nextPage', action: 'next-page' },
  { command: 'darkpdf.previousPage', action: 'previous-page' },
  { command: 'darkpdf.firstPage', action: 'first-page' },
  { command: 'darkpdf.lastPage', action: 'last-page' },
];

async function gotoPage(provider: PdfEditorProvider): Promise<void> {
  const value = await vscode.window.showInputBox({
    prompt: 'Page number',
    validateInput: (input) =>
      Number.isInteger(Number(input)) && Number(input) >= 1
        ? undefined
        : 'Enter a page number of 1 or more.',
  });
  if (value !== undefined && value !== '') {
    provider.gotoPage(Number(value));
  }
}

export function registerNavigationCommands(
  provider: PdfEditorProvider
): vscode.Disposable[] {
  return navigationActions
    .map(({ command, action }) =>
      vscode.commands.registerCommand(command, () => {
        provider.action(action);
      })
    )
    .concat([
      vscode.commands.registerCommand('darkpdf.gotoPage', () => {
        gotoPage(provider);
      }),
    ]);
}
