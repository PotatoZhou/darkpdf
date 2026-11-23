import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { configurationSection } from './configuration';
import { PdfEditorProvider } from './editor/pdfEditorProvider';
import { PreviewStateStore } from './state';
import { PreviewStatusBar } from './statusbar/previewStatusBar';

export function activate(context: vscode.ExtensionContext): void {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  const stateStore = new PreviewStateStore(context.workspaceState);
  const provider = new PdfEditorProvider(extensionRoot, stateStore);
  const statusBar = new PreviewStatusBar();

  context.subscriptions.push(
    statusBar,
    provider,
    provider.onDidChangeState((state) => {
      statusBar.update(state);
    }),
    vscode.window.registerCustomEditorProvider(
      PdfEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          enableFindWidget: false,
          retainContextWhenHidden: true,
        },
      }
    ),
    ...registerCommands(provider),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(configurationSection) ||
        event.affectsConfiguration('editor.fontFamily')
      ) {
        provider.refreshAllPreviews();
      }
    })
  );
}

export function deactivate(): void {}
