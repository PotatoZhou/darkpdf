# Change log

## 0.0.5

- Pre-release: use VS Code's `editor.fontFamily` for PDFs without embedded fonts.

## 0.0.4


- Show the status bar indicator with the configured defaults as soon as a PDF becomes active, instead of waiting for the first webview state message.
- Add page navigation commands and shortcuts, copy-current-page-text, print and PNG export.
- Add optional image-preserving inversion on a separate canvas layer.
- Batch the image-preserving page painting with a per-frame time budget so the inversion slider stays responsive.
- Add a lock button on the toolbar that keeps it visible while auto-hide is on.
- Handle `Ctrl+Shift+Z` inside the viewer so the shortcut works while the PDF has focus.
- `darkpdf.toggleTheme` cycles through the theme presets (`darkpdf.default.theme` is the starting preset, default `dark`).
- Load standard font data from `lib/web/standard_fonts`.

## 0.0.3

- Add a `darkpdf.default.invert` setting for the starting darkness, requested in #2 by @kayhanaykin.
- Preserve colors with a 180° hue rotation while inverting black and white, requested in #5 by @BrianPengT.
- Apply the dark theme to the toolbar as well, requested in #7 by @qinpegnsen.
- Remove the `Ctrl+P` print shortcut from the viewer, requested in #6 by @nachocab.
- Zoom the document only with `Ctrl+=` / `Ctrl+-` / `Ctrl+0`, requested in #3 by @MakSac.
- Auto-hide the toolbar until it is hovered (#3).
- Fix the settings namespace and the dark mode toggle command.

## 0.0.2

- Range slider for the inversion level.

## 0.0.1

- Initial release.
