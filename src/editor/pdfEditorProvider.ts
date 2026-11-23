import * as vscode from 'vscode';
import { ThemeName } from '../configuration';
import { PreviewState, PreviewStateStore } from '../state';
import { PdfPreview } from './pdfPreview';
import { PreviewAction } from './previewMessages';

export interface ActivePreviewState {
  uri: vscode.Uri;
  state: PreviewState;
}

export class PdfEditorProvider
  implements vscode.CustomReadonlyEditorProvider, vscode.Disposable {
  public static readonly viewType = 'pdf.preview';

  private readonly _previews = new Set<PdfPreview>();
  private _activePreview: PdfPreview | undefined;
  private readonly _onDidChangeState = new vscode.EventEmitter<
    ActivePreviewState | undefined
  >();
  public readonly onDidChangeState = this._onDidChangeState.event;

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly stateStore: PreviewStateStore
  ) {}

  public dispose(): void {
    this._onDidChangeState.dispose();
  }

  public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: (): void => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel
  ): Promise<void> {
    const preview = new PdfPreview({
      extensionRoot: this.extensionRoot,
      resource: document.uri,
      panel: webviewEditor,
      stateStore: this.stateStore,
      onStateChanged: (changed, state): void => {
        if (changed === this._activePreview) {
          this._onDidChangeState.fire({ uri: changed.uri, state });
        }
      },
    });
    this._previews.add(preview);
    this.setActivePreview(preview);

    webviewEditor.onDidDispose(() => {
      preview.dispose();
      this._previews.delete(preview);
      if (this._activePreview === preview) {
        this.setActivePreview(undefined);
      }
    });

    webviewEditor.onDidChangeViewState(() => {
      if (webviewEditor.active) {
        this.setActivePreview(preview);
      } else if (this._activePreview === preview && !webviewEditor.active) {
        this.setActivePreview(undefined);
      }
    });
  }

  public get activePreview(): PdfPreview | undefined {
    return this._activePreview;
  }

  public refreshAllPreviews(): void {
    for (const preview of this._previews) {
      preview.refresh();
    }
  }

  public zoom(value: 'in' | 'out' | 'reset'): void {
    this._activePreview?.zoom(value);
  }

  public toggleTheme(): void {
    this._activePreview?.toggleTheme();
  }

  public setTheme(theme: ThemeName): void {
    this._activePreview?.setTheme(theme);
  }

  public setInvert(value: number): void {
    this._activePreview?.setInvert(value);
  }

  public action(name: PreviewAction): void {
    this._activePreview?.action(name);
  }

  public gotoPage(page: number): void {
    this._activePreview?.gotoPage(page);
  }

  public copyPageText(): void {
    this._activePreview?.copyPageText();
  }

  public print(): void {
    this._activePreview?.print();
  }

  /**
   * Always fires a valid state while a preview is active. The preview
   * holds a default built from the settings before the webview reports
   * anything, so the status bar never waits for the first message.
   */
  private setActivePreview(value: PdfPreview | undefined): void {
    this._activePreview = value;
    this._onDidChangeState.fire(
      value ? { uri: value.uri, state: value.currentState } : undefined
    );
  }
}
