import * as vscode from 'vscode';
import { PreviewDefaults } from '../configuration';
import { PreviewState } from '../state';
import { escapeAttribute, readTemplate, resolveAsWebviewUri } from './template';

export interface WebviewHtmlOptions {
  webview: vscode.Webview;
  extensionRoot: vscode.Uri;
  resource: vscode.Uri;
  defaults: PreviewDefaults;
  state?: PreviewState;
}

export function renderWebviewHtml(options: WebviewHtmlOptions): string {
  const { webview, extensionRoot, resource, defaults, state } = options;
  const resolveAsUri = (...segments: string[]): string =>
    resolveAsWebviewUri(webview, extensionRoot, ...segments);

  const config = {
    cMapUrl: resolveAsUri('lib', 'web', 'cmaps/'),
    standardFontDataUrl: resolveAsUri('lib', 'web', 'standard_fonts/'),
    path: webview.asWebviewUri(resource).toString(),
    fontFamily: defaults.fontFamily,
    defaults,
    state: state ?? null,
  };

  const values: Record<string, string> = {
    cspSource: webview.cspSource,
    config: escapeAttribute(JSON.stringify(config)),
    localeUri: resolveAsUri('lib', 'web', 'locale', 'locale.properties'),
    viewerCssUri: resolveAsUri('lib', 'web', 'viewer.css'),
    pdfCssUri: resolveAsUri('lib', 'pdf.css'),
    pdfJsUri: resolveAsUri('lib', 'build', 'pdf.js'),
    pdfWorkerJsUri: resolveAsUri('lib', 'build', 'pdf.worker.js'),
    viewerJsUri: resolveAsUri('lib', 'web', 'viewer.js'),
    mainJsUri: resolveAsUri('lib', 'main.js'),
  };

  return readTemplate(extensionRoot).replace(
    /\{\{(\w+)\}\}/g,
    (match: string, token: string): string => values[token] ?? match
  );
}
