import { ThemeName } from '../configuration';

/** Actions the webview understands in the `action` message. */
export type PreviewAction =
  | 'next-page'
  | 'previous-page'
  | 'first-page'
  | 'last-page'
  | 'goto-page';

/** Messages sent from the extension host into the webview. */
export type WebviewOutboundMessage =
  | { type: 'zoom'; value: 'in' | 'out' | 'reset' }
  | { type: 'toggle-theme' }
  | { type: 'set-theme'; value: ThemeName }
  | { type: 'set-invert'; value: number }
  | { type: 'action'; name: PreviewAction; value?: number }
  | { type: 'copy-page-text' }
  | { type: 'export-page' }
  | { type: 'print' }
  | { type: 'reload' };

/** Messages sent from the webview back to the extension host. */
export type WebviewInboundMessage =
  | { type: 'reopen-as-text' }
  | { type: 'state'; state: unknown }
  | { type: 'copy-text'; text: string }
  | { type: 'page-image'; dataUrl?: string }
  | { type: 'open-readme' };
