import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const templateCache = new Map<string, string>();

function templatePath(extensionRoot: vscode.Uri): string {
  return path.join(extensionRoot.fsPath, 'lib', 'web', 'darkpdf.html');
}

export function readTemplate(extensionRoot: vscode.Uri): string {
  const file = templatePath(extensionRoot);
  const cached = templateCache.get(file);
  if (cached !== undefined) {
    return cached;
  }
  const template = fs.readFileSync(file, 'utf8');
  templateCache.set(file, template);
  return template;
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

export function resolveAsWebviewUri(
  webview: vscode.Webview,
  extensionRoot: vscode.Uri,
  ...segments: string[]
): string {
  return webview
    .asWebviewUri(vscode.Uri.file(path.join(extensionRoot.fsPath, ...segments)))
    .toString();
}
