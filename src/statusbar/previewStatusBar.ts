import * as vscode from 'vscode';
import { ActivePreviewState } from '../editor/pdfEditorProvider';

export class PreviewStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  constructor() {
    this.item.command = 'darkpdf.pickTheme';
    this.item.text = '$(eye) PDF';
    this.item.tooltip = 'Dark PDF: choose theme or inversion';
    this.item.hide();
  }

  public update(state: ActivePreviewState | undefined): void {
    if (!state) {
      this.item.text = '$(eye) PDF';
      this.item.tooltip = 'Dark PDF: choose theme or inversion';
      this.item.hide();
      return;
    }
    const preview = state.state;
    this.item.text = '$(eye) ' + Math.round(preview.invert) + '%';
    this.item.tooltip =
      'Dark PDF — theme: ' +
      preview.theme +
      ', page ' +
      preview.page +
      '. Click to change.';
    this.item.show();
  }

  public dispose(): void {
    this.item.dispose();
  }
}
