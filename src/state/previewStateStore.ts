import * as vscode from 'vscode';
import { sanitizePreviewState, PreviewState } from './previewState';

const stateKeyPrefix = 'darkpdf.state:';

export class PreviewStateStore {
  constructor(private readonly memento: vscode.Memento) {}

  public get(uri: vscode.Uri): PreviewState | undefined {
    return sanitizePreviewState(
      this.memento.get(stateKeyPrefix + uri.toString())
    );
  }

  public set(uri: vscode.Uri, state: unknown): PreviewState | undefined {
    const preview = sanitizePreviewState(state);
    if (!preview) {
      return undefined;
    }
    this.memento.update(stateKeyPrefix + uri.toString(), preview);
    return preview;
  }
}
