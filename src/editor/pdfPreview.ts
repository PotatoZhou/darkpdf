import * as vscode from 'vscode';
import {
  PreviewDefaults,
  readPreviewDefaults,
  ThemeName,
} from '../configuration';
import { Disposable } from '../shared/disposable';
import { PreviewState, PreviewStateStore, defaultPreviewState } from '../state';
import { renderWebviewHtml } from '../webview';
import {
  PreviewAction,
  WebviewInboundMessage,
  WebviewOutboundMessage,
} from './previewMessages';

export interface PdfPreviewOptions {
  extensionRoot: vscode.Uri;
  resource: vscode.Uri;
  panel: vscode.WebviewPanel;
  stateStore: PreviewStateStore;
  onStateChanged?: (preview: PdfPreview, state: PreviewState) => void;
}

type PreviewStateName = 'Disposed' | 'Visible' | 'Active';

const imageTimeoutMs = 5000;

export class PdfPreview extends Disposable {
  private _previewState: PreviewStateName = 'Visible';
  private _pendingImage: ((dataUrl: string | undefined) => void) | undefined;
  private _currentState: PreviewState;

  private readonly extensionRoot: vscode.Uri;
  private readonly resource: vscode.Uri;
  private readonly panel: vscode.WebviewPanel;
  private readonly stateStore: PreviewStateStore;
  private readonly defaults: PreviewDefaults;
  private readonly onStateChanged:
    | ((preview: PdfPreview, state: PreviewState) => void)
    | undefined;

  constructor(options: PdfPreviewOptions) {
    super();
    this.extensionRoot = options.extensionRoot;
    this.resource = options.resource;
    this.panel = options.panel;
    this.stateStore = options.stateStore;
    this.onStateChanged = options.onStateChanged;

    this.defaults = readPreviewDefaults();
    const stored = this.defaults.restoreState
      ? this.stateStore.get(this.resource)
      : undefined;
    this._currentState = stored ?? defaultPreviewState(this.defaults);

    const resourceRoot = this.resource.with({
      path: this.resource.path.replace(/\/[^/]+?\.\w+$/, '/'),
    });

    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, this.extensionRoot],
    };

    this._register(
      this.panel.webview.onDidReceiveMessage((message) => {
        this.handleMessage(message as WebviewInboundMessage);
      })
    );

    this._register(
      this.panel.onDidChangeViewState(() => {
        this.update();
      })
    );

    this._register(
      this.panel.onDidDispose(() => {
        this._previewState = 'Disposed';
        this.resolvePendingImage(undefined);
      })
    );

    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(this.resource.fsPath)
    );
    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.reload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.panel.dispose();
        }
      })
    );

    this.panel.webview.html = this.getWebviewContents();
    this.update();
  }

  public get uri(): vscode.Uri {
    return this.resource;
  }

  /** Latest known state, valid before the first webview message. */
  public get currentState(): PreviewState {
    return this._currentState;
  }

  public refresh(): void {
    if (this._previewState !== 'Disposed') {
      this.panel.webview.html = this.getWebviewContents();
    }
  }

  public postMessage(message: WebviewOutboundMessage): void {
    if (this._previewState !== 'Disposed') {
      this.panel.webview.postMessage(message);
    }
  }

  public zoom(value: 'in' | 'out' | 'reset'): void {
    this.postMessage({ type: 'zoom', value });
  }

  public toggleTheme(): void {
    this.postMessage({ type: 'toggle-theme' });
  }

  public setTheme(theme: ThemeName): void {
    this.postMessage({ type: 'set-theme', value: theme });
  }

  public setInvert(value: number): void {
    this.postMessage({ type: 'set-invert', value });
  }

  public action(name: PreviewAction): void {
    this.postMessage({ type: 'action', name });
  }

  public gotoPage(page: number): void {
    this.postMessage({ type: 'action', name: 'goto-page', value: page });
  }

  public copyPageText(): void {
    this.postMessage({ type: 'copy-page-text' });
  }

  public print(): void {
    this.postMessage({ type: 'print' });
  }

  public requestPageImage(): Promise<string | undefined> {
    if (this._previewState === 'Disposed') {
      return Promise.resolve(undefined);
    }
    return new Promise<string | undefined>((resolve) => {
      this.resolvePendingImage(undefined);
      this._pendingImage = resolve;
      this.postMessage({ type: 'export-page' });
      setTimeout(() => {
        if (this._pendingImage === resolve) {
          this._pendingImage = undefined;
          resolve(undefined);
        }
      }, imageTimeoutMs);
    });
  }

  private resolvePendingImage(dataUrl: string | undefined): void {
    const pending = this._pendingImage;
    this._pendingImage = undefined;
    pending?.(dataUrl);
  }

  private handleMessage(message: WebviewInboundMessage): void {
    switch (message.type) {
      case 'reopen-as-text': {
        vscode.commands.executeCommand(
          'vscode.openWith',
          this.resource,
          'default',
          this.panel.viewColumn
        );
        break;
      }
      case 'state': {
        const stored = this.stateStore.set(this.resource, message.state);
        if (stored) {
          this._currentState = stored;
          this.onStateChanged?.(this, stored);
        }
        break;
      }
      case 'copy-text': {
        const text = typeof message.text === 'string' ? message.text : '';
        if (text) {
          vscode.env.clipboard.writeText(text);
          vscode.window.setStatusBarMessage(
            'Dark PDF: page text copied.',
            3000
          );
        }
        break;
      }
      case 'page-image': {
        const dataUrl =
          typeof message.dataUrl === 'string' ? message.dataUrl : undefined;
        this.resolvePendingImage(dataUrl);
        break;
      }
      case 'open-readme': {
        vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/PotatoZhou/darkpdf')
        );
        break;
      }
    }
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.panel.webview.postMessage({
        type: 'reload',
      } as WebviewOutboundMessage);
    }
  }

  private update(): void {
    if (this._previewState === 'Disposed') {
      return;
    }
    this._previewState = this.panel.active ? 'Active' : 'Visible';
  }

  private getWebviewContents(): string {
    return renderWebviewHtml({
      webview: this.panel.webview,
      extensionRoot: this.extensionRoot,
      resource: this.resource,
      defaults: this.defaults,
      state: this.defaults.restoreState
        ? this.stateStore.get(this.resource)
        : undefined,
    });
  }
}
