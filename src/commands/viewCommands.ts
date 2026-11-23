import * as vscode from 'vscode';
import { PdfEditorProvider } from '../editor/pdfEditorProvider';

async function exportPageImage(provider: PdfEditorProvider): Promise<void> {
  const preview = provider.activePreview;
  if (!preview) {
    vscode.window.showInformationMessage('Dark PDF: open a PDF first.');
    return;
  }
  const dataUrl = await preview.requestPageImage();
  const prefix = 'data:image/png;base64,';
  if (!dataUrl || !dataUrl.startsWith(prefix)) {
    vscode.window.showWarningMessage(
      'Dark PDF: could not read the current page.'
    );
    return;
  }
  const target = await vscode.window.showSaveDialog({
    filters: { PNG: ['png'] },
    defaultUri: preview.uri.with({
      path: preview.uri.path.replace(/\.pdf$/i, '.png'),
    }),
  });
  if (!target) {
    return;
  }
  const buffer = Buffer.from(dataUrl.slice(prefix.length), 'base64');
  await vscode.workspace.fs.writeFile(target, buffer);
  vscode.window.showInformationMessage(
    'Dark PDF: page exported to ' + target.fsPath
  );
}

export function registerViewCommands(
  provider: PdfEditorProvider
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('darkpdf.zoomIn', () => {
      provider.zoom('in');
    }),
    vscode.commands.registerCommand('darkpdf.zoomOut', () => {
      provider.zoom('out');
    }),
    vscode.commands.registerCommand('darkpdf.resetZoom', () => {
      provider.zoom('reset');
    }),
    vscode.commands.registerCommand('darkpdf.copyPageText', () => {
      provider.copyPageText();
    }),
    vscode.commands.registerCommand('darkpdf.print', () => {
      provider.print();
    }),
    vscode.commands.registerCommand('darkpdf.exportPageImage', () => {
      exportPageImage(provider);
    }),
  ];
}
