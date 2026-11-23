"use strict";

(function () {
  var config = null;
  var defaults = null;
  var state = null;
  var currentInvert = 0;
  var currentTheme = 'dark';
  var lastDarkInvert = 100;
  var saveTimer = 0;
  var invertTimer = 0;
  var ready = false;
  var builtInThemes = ['dark', 'original', 'sepia', 'contrast'];

  // Builds the CSS `filter` string from a user theme's numeric fields:
  // hue (degrees), saturation / brightness / contrast (multipliers),
  // sepia / invert (0..1). Only fields set to a number are applied.
  function themeFilter(theme) {
    var parts = [];
    var hue = safeNumber(theme.hue, -1);
    if (hue >= 0) {
      parts.push('hue-rotate(' + hue + 'deg)');
    }
    var saturation = safeNumber(theme.saturation, -1);
    if (saturation >= 0) {
      parts.push('saturate(' + saturation + ')');
    }
    var brightness = safeNumber(theme.brightness, -1);
    if (brightness >= 0) {
      parts.push('brightness(' + brightness + ')');
    }
    var contrast = safeNumber(theme.contrast, -1);
    if (contrast >= 0) {
      parts.push('contrast(' + contrast + ')');
    }
    var sepia = safeNumber(theme.sepia, -1);
    if (sepia >= 0) {
      parts.push('sepia(' + sepia + ')');
    }
    var invert = safeNumber(theme.invert, -1);
    if (invert >= 0) {
      parts.push('invert(' + invert + ')');
    }
    return parts.join(' ');
  }
  // Theme presets: built-ins, then the user-defined themes from the
  // `darkpdf.themes` setting, then `custom` from customFilter/paperColor.
  function themePresets() {
    var presets = {
      dark: { filter: '', paper: '' },
      original: { filter: '', paper: '' },
      sepia: { filter: 'sepia(0.35)', paper: '#f4ecd8' },
      contrast: { filter: 'contrast(1.25) brightness(0.95)', paper: '' }
    };
    var userThemes = (defaults && defaults.themes) || [];
    for (var i = 0; i < userThemes.length; i++) {
      var theme = userThemes[i];
      if (theme && theme.name) {
        presets[theme.name] = {
          filter: themeFilter(theme),
          paper: String(theme.paperColor || '')
        };
      }
    }
    presets.custom = {
      filter: String((defaults && defaults.customFilter) || ''),
      paper: String((defaults && defaults.paperColor) || '')
    };
    return presets;
  }
  function themeCycleOrder() {
    var presets = themePresets();
    var order = [];
    for (var i = 0; i < builtInThemes.length; i++) {
      order.push(builtInThemes[i]);
    }
    for (var name in presets) {
      if (
        Object.prototype.hasOwnProperty.call(presets, name) &&
        order.indexOf(name) === -1
      ) {
        order.push(name);
      }
    }
    return order;
  }

  function loadConfig() {
    var elem = document.getElementById('pdf-preview-config');
    if (elem) {
      return JSON.parse(elem.getAttribute('data-config'));
    }
    throw new Error('Could not load configuration.');
  }
  function cursorTools(name) {
    if (name === 'hand') {
      return 1;
    }
    return 0;
  }
  function scrollMode(name) {
    switch (name) {
      case 'vertical':
        return 0;
      case 'horizontal':
        return 1;
      case 'wrapped':
        return 2;
      default:
        return -1;
    }
  }
  function spreadMode(name) {
    switch (name) {
      case 'none':
        return 0;
      case 'odd':
        return 1;
      case 'even':
        return 2;
      default:
        return -1;
    }
  }
  function post(message) {
    if (!post.api) {
      try {
        post.api = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
      } catch (error) {
        post.api = null;
      }
    }
    if (post.api) {
      post.api.postMessage(message);
    }
  }
  function safeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function applyTheme(name) {
    const presets = themePresets();
    const theme = presets[name] ? name : 'dark';
    currentTheme = theme;
    const preset = presets[theme];
    document.documentElement.style.setProperty('--darkpdf-extra-filter', preset.filter);
    document.body.classList.toggle('darkpdf-paper', !!preset.paper);
    if (preset.paper) {
      document.documentElement.style.setProperty('--darkpdf-paper', preset.paper);
    }
    document.body.dataset.darkpdfTheme = theme;
  }
  function reprocessPages() {
    if (!defaults.keepImageColor || !window.PDFViewerApplication) {
      return;
    }
    const pages = PDFViewerApplication.pdfViewer._pages || [];
    for (const page of pages) {
      if (page && page.canvas) {
        schedulePaint(page, false);
      }
    }
  }
  function reprocessCurrentPage() {
    if (!defaults.keepImageColor || !window.PDFViewerApplication) {
      return;
    }
    const viewer = PDFViewerApplication.pdfViewer;
    if (!viewer) {
      return;
    }
    const pageView = viewer.getPageView((viewer.currentPageNumber || 1) - 1);
    if (pageView) {
      schedulePaint(pageView, true);
    }
  }
  // keepImageColor mode paints pages in batches with a per-frame time
  // budget, so dragging the inversion slider does not block the main
  // thread when many rendered pages need a repaint.
  const paintFrameBudgetMs = 12;
  const paintQueue = [];
  let paintScheduled = false;
  function schedulePaint(pageView, front) {
    if (!pageView || !pageView.canvas || pageView._darkpdfQueued) {
      return;
    }
    pageView._darkpdfQueued = true;
    if (front) {
      paintQueue.unshift(pageView);
    } else {
      paintQueue.push(pageView);
    }
    drainPaintQueue();
  }
  function drainPaintQueue() {
    if (paintScheduled) {
      return;
    }
    paintScheduled = true;
    requestAnimationFrame(function () {
      paintScheduled = false;
      const start = performance.now();
      while (
        paintQueue.length &&
        performance.now() - start < paintFrameBudgetMs
      ) {
        const pageView = paintQueue.shift();
        pageView._darkpdfQueued = false;
        if (pageView.canvas) {
          paintSmartPage(pageView);
        }
      }
      if (paintQueue.length) {
        drainPaintQueue();
      }
    });
  }
  function setInvert(percent, immediate) {
    const value = Math.max(0, Math.min(100, Math.round(safeNumber(percent, 0))));
    currentInvert = value;
    if (value > 0) {
      lastDarkInvert = value;
    }
    document.documentElement.style.setProperty(
      '--darkpdf-invert',
      String(value / 100)
    );
    document.body.classList.toggle('darkpdf-dark', value > 0);
    const slider = document.getElementById('invert-slider');
    const label = document.getElementById('invert-value');
    if (slider) {
      slider.value = String(value);
    }
    if (label) {
      label.textContent = value + '%';
    }
    if (defaults && defaults.keepImageColor) {
      reprocessCurrentPage();
      reprocessPages();
      if (!immediate) {
        clearTimeout(invertTimer);
        invertTimer = setTimeout(reprocessPages, 150);
      }
    }
    saveState();
    return value;
  }
  function saveState(delay) {
    if (!ready) {
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      const viewer = PDFViewerApplication.pdfViewer;
      post({
        type: 'state',
        state: {
          invert: currentInvert,
          theme: currentTheme,
          scale: viewer.currentScaleValue ? String(viewer.currentScaleValue) : '',
          page: viewer.currentPageNumber || 1
        }
      });
    }, typeof delay === 'number' ? delay : 700);
  }
  // Inverts only the neutral (text/background) pixels on a separate canvas
  // layer, so coloured images keep their own colours.
  function paintSmartPage(pageView) {
    const canvas = pageView.canvas;
    const wrapper = pageView.div && pageView.div.querySelector('.canvasWrapper');
    if (!canvas || !canvas.width || !wrapper) {
      return;
    }
    let overlay = wrapper.querySelector('canvas.darkpdf-smart');
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.className = 'darkpdf-smart';
      wrapper.appendChild(overlay);
    }
    if (overlay.width !== canvas.width || overlay.height !== canvas.height) {
      overlay.width = canvas.width;
      overlay.height = canvas.height;
    }
    const context = overlay.getContext('2d');
    if (!context) {
      return;
    }
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.drawImage(canvas, 0, 0);
    let image;
    try {
      image = context.getImageData(0, 0, overlay.width, overlay.height);
    } catch (error) {
      return;
    }
    const data = image.data;
    const amount = currentInvert / 100;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min > 24) {
        continue;
      }
      data[i] = Math.round(r + (255 - 2 * r) * amount);
      data[i + 1] = Math.round(g + (255 - 2 * g) * amount);
      data[i + 2] = Math.round(b + (255 - 2 * b) * amount);
    }
    context.putImageData(image, 0, 0);
  }
  // Applies a preset and keeps the inversion consistent with it: the
  // original preset drops the inversion, others restore or keep it.
  function selectTheme(name) {
    applyTheme(name);
    if (currentTheme === 'original') {
      setInvert(0, true);
    } else if (currentInvert === 0) {
      setInvert(lastDarkInvert, true);
    } else {
      setInvert(currentInvert, true);
    }
    saveState();
  }
  // Cycles through the theme presets. The inversion level is kept unless
  // the preset needs it.
  function cycleTheme() {
    const order = themeCycleOrder();
    const index = order.indexOf(currentTheme);
    const next = order[(index + 1) % order.length];
    selectTheme(next);
  }
  function runAction(name, value) {
    const viewer = PDFViewerApplication.pdfViewer;
    if (!viewer.pdfDocument) {
      return;
    }
    const pages = viewer.pagesCount || 1;
    switch (name) {
      case 'next-page':
        viewer.currentPageNumber = Math.min(viewer.currentPageNumber + 1, pages);
        break;
      case 'previous-page':
        viewer.currentPageNumber = Math.max(viewer.currentPageNumber - 1, 1);
        break;
      case 'first-page':
        viewer.currentPageNumber = 1;
        break;
      case 'last-page':
        viewer.currentPageNumber = pages;
        break;
      case 'goto-page': {
        const page = Math.round(safeNumber(value, 1));
        viewer.currentPageNumber = Math.max(1, Math.min(page, pages));
        break;
      }
      default:
        return;
    }
    saveState(0);
  }
  function requestPageImage() {
    const viewer = PDFViewerApplication.pdfViewer;
    const pageView = viewer.getPageView(viewer.currentPageNumber - 1);
    if (!pageView || !pageView.canvas) {
      post({ type: 'page-image' });
      return;
    }
    try {
      post({ type: 'page-image', dataUrl: pageView.canvas.toDataURL('image/png') });
    } catch (error) {
      post({ type: 'page-image' });
    }
  }
  function copyPageText() {
    const viewer = PDFViewerApplication.pdfViewer;
    if (!viewer.pdfDocument) {
      return;
    }
    PDFViewerApplication.pdfDocument
      .getPage(viewer.currentPageNumber)
      .then(function (page) {
        return page.getTextContent();
      })
      .then(function (content) {
        const text = content.items
          .map(function (item) {
            return item.str;
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        post({ type: 'copy-text', text: text });
      })
      .catch(function () {
        post({ type: 'copy-text', text: '' });
      });
  }
  function printDocument() {
    document.body.classList.add('darkpdf-printing');
    setTimeout(function () {
      try {
        window.print();
      } finally {
        document.body.classList.remove('darkpdf-printing');
      }
    }, 50);
  }
  function applyRestoredState() {
    if (!state) {
      return;
    }
    const viewer = PDFViewerApplication.pdfViewer;
    if (state.scale) {
      try {
        viewer.currentScaleValue = state.scale;
      } catch (error) {
        /* ignore unknown scale */
      }
    }
    if (state.page >= 1 && state.page <= (viewer.pagesCount || 1)) {
      viewer.currentPageNumber = state.page;
    }
  }

  window.addEventListener('load', async function () {
    config = loadConfig();
    defaults = config.defaults;
    state = config.state;
    if (!defaults.keepImageColor) {
      document.body.classList.remove('darkpdf-smart-invert');
    } else {
      document.body.classList.add('darkpdf-smart-invert');
    }
    document.body.classList.toggle('darkpdf-autohide', !!defaults.autoHideToolbar);

    const configuredInvert = state
      ? safeNumber(state.invert, 0)
      : safeNumber(defaults.invert, 100);
    const initialTheme =
      state && themePresets()[state.theme] ? state.theme : defaults.theme;
    applyTheme(initialTheme);
    setInvert(
      initialTheme === 'original'
        ? 0
        : defaults.colorMode || state
        ? configuredInvert
        : 0,
      true
    );

    const invertSlider = document.getElementById('invert-slider');
    if (invertSlider) {
      invertSlider.addEventListener('input', function (event) {
        setInvert(Number(event.target.value));
      });
    }

    // Theme doorhanger menu: rebuilt on every open so the highlighted
    // entry always matches the current theme.
    const themeMenuToggle = document.getElementById('themeMenuToggle');
    const themeMenu = document.getElementById('themeMenu');
    const themeMenuContainer = document.getElementById(
      'themeMenuButtonContainer'
    );
    function setThemeMenuOpen(open) {
      if (!themeMenu || !themeMenuToggle) {
        return;
      }
      themeMenu.classList.toggle('hidden', !open);
      themeMenuToggle.classList.toggle('toggled', open);
      themeMenuToggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('darkpdf-theme-menu-open', open);
    }
    function closeThemeMenu() {
      setThemeMenuOpen(false);
    }
    if (themeMenuToggle && themeMenu && themeMenuContainer) {
      themeMenuToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        if (!themeMenu.classList.contains('hidden')) {
          closeThemeMenu();
          return;
        }
        themeMenuContainer.textContent = '';
        const order = themeCycleOrder();
        for (let i = 0; i < order.length; i++) {
          const name = order[i];
          const item = document.createElement('button');
          item.className =
            'secondaryToolbarButton' + (name === currentTheme ? ' toggled' : '');
          const label = document.createElement('span');
          label.textContent = name.charAt(0).toUpperCase() + name.slice(1);
          item.appendChild(label);
          item.addEventListener('click', function () {
            selectTheme(name);
            closeThemeMenu();
          });
          themeMenuContainer.appendChild(item);
        }
        const helpItem = document.createElement('button');
        helpItem.className = 'secondaryToolbarButton themeMenuHelp';
        const helpLabel = document.createElement('span');
        helpLabel.textContent = 'Help';
        helpItem.appendChild(helpLabel);
        helpItem.addEventListener('click', function () {
          post({ type: 'open-readme' });
          closeThemeMenu();
        });
        themeMenuContainer.appendChild(helpItem);
        setThemeMenuOpen(true);
      });
      document.addEventListener('click', function (event) {
        if (
          !themeMenu.classList.contains('hidden') &&
          !themeMenu.contains(event.target) &&
          !themeMenuToggle.contains(event.target)
        ) {
          closeThemeMenu();
        }
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          closeThemeMenu();
        }
      });
    }

    const lockButton = document.getElementById('toolbarLock');
    if (lockButton) {
      lockButton.addEventListener('click', function () {
        const locked = document.body.classList.toggle('darkpdf-locked');
        lockButton.classList.toggle('toggled', locked);
        lockButton.setAttribute('aria-pressed', String(locked));
        lockButton.title = locked
          ? 'Unlock the toolbar'
          : 'Lock the toolbar';
      });
    }

    window.addEventListener('message', async function (event) {
      const message = event.data || {};
      switch (message.type) {
        case 'toggle-theme':
        case 'toggle-dark-mode':
          cycleTheme();
          return;
        case 'set-theme':
          selectTheme(message.value);
          return;
        case 'set-invert':
          setInvert(message.value, true);
          return;
        case 'action':
          runAction(message.name, message.value);
          return;
        case 'copy-page-text':
          copyPageText();
          return;
        case 'export-page':
          requestPageImage();
          return;
        case 'print':
          printDocument();
          return;
        case 'zoom': {
          const viewer = PDFViewerApplication.pdfViewer;
          if (!viewer.pdfDocument) {
            return;
          }
          if (message.value === 'in') {
            viewer.currentScale = Math.min(viewer.currentScale * 1.1, 10);
          } else if (message.value === 'out') {
            viewer.currentScale = Math.max(viewer.currentScale / 1.1, 0.1);
          } else {
            viewer.currentScaleValue = defaults.scale;
          }
          saveState();
          return;
        }
        case 'reload':
          break;
        default:
          return;
      }

      // Prevents flickering of page when PDF is reloaded
      const oldResetView = PDFViewerApplication.pdfViewer._resetView;
      PDFViewerApplication.pdfViewer._resetView = function () {
        this._firstPageCapability = (0, pdfjsLib.createPromiseCapability)();
        this._onePageRenderedCapability = (0, pdfjsLib.createPromiseCapability)();
        this._pagesCapability = (0, pdfjsLib.createPromiseCapability)();

        this.viewer.textContent = '';
      };

      // Changing the fingerprint fools pdf.js into keeping scroll position
      const doc = await pdfjsLib.getDocument(loadOpts).promise;
      doc._pdfInfo.fingerprints = [config.path];
      PDFViewerApplication.load(doc);

      PDFViewerApplication.pdfViewer._resetView = oldResetView;
    });

    PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl);
    PDFViewerApplicationOptions.set(
      'standardFontDataUrl',
      config.standardFontDataUrl
    );
    PDFViewerApplicationOptions.set('fallbackFontFamily', config.fontFamily);
    const loadOpts = {
      url: config.path,
      useWorkerFetch: false,
      cMapUrl: config.cMapUrl,
      cMapPacked: true,
      standardFontDataUrl: config.standardFontDataUrl,
      fallbackFontFamily: config.fontFamily
    };
    PDFViewerApplication.initializedPromise.then(function () {
      PDFViewerApplication.eventBus.on('pagerendered', function (event) {
        if (defaults.keepImageColor && event && event.source) {
          schedulePaint(event.source, true);
        }
      });
      PDFViewerApplication.eventBus.on('pagechanging', function () {
        saveState();
      });
      PDFViewerApplication.eventBus.on('scalechanging', function () {
        saveState();
      });

      const optsOnLoad = function () {
        PDFViewerApplication.pdfCursorTools.switchTool(cursorTools(defaults.cursor));
        PDFViewerApplication.pdfViewer.currentScaleValue = defaults.scale;
        PDFViewerApplication.pdfViewer.scrollMode = scrollMode(defaults.scrollMode);
        PDFViewerApplication.pdfViewer.spreadMode = spreadMode(defaults.spreadMode);
        if (defaults.sidebar) {
          PDFViewerApplication.pdfSidebar.open();
        } else {
          PDFViewerApplication.pdfSidebar.close();
        }
        applyRestoredState();
        ready = true;
        saveState(0);
        PDFViewerApplication.eventBus.off('documentloaded', optsOnLoad);
      };
      PDFViewerApplication.eventBus.on('documentloaded', optsOnLoad);

      // load() cannot be called before pdf.js is initialized
      // open() makes sure pdf.js is initialized before load()
      PDFViewerApplication.open(config.path).then(async function () {
        const doc = await pdfjsLib.getDocument(loadOpts).promise;
        doc._pdfInfo.fingerprints = [config.path];
        PDFViewerApplication.load(doc);
      });
    });

    // VS Code keybindings do not reach the focused webview, so every
    // documented shortcut is handled here. Capture phase keeps Ctrl+G
    // ahead of PDF.js's "find again" binding.
    function focusPageNumber() {
      const input = document.getElementById('pageNumber');
      if (input) {
        input.focus();
        input.select();
      }
    }
    function isTypingTarget(target) {
      return !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
    }
    window.addEventListener('keydown', function (event) {
      const commandKey = event.ctrlKey || event.metaKey;
      const code = event.code || (event.key.length === 1 ? 'Key' + event.key.toUpperCase() : '');
      let handled = true;

      if (commandKey && event.shiftKey && code === 'KeyZ') {
        cycleTheme();
      } else if (commandKey && event.altKey && code === 'KeyC') {
        copyPageText();
      } else if (commandKey && !event.altKey && !event.shiftKey && code === 'KeyG') {
        focusPageNumber();
      } else if (event.altKey && !commandKey && !event.shiftKey) {
        if (event.key === 'PageDown') {
          runAction('next-page');
        } else if (event.key === 'PageUp') {
          runAction('previous-page');
        } else if (event.key === 'Home') {
          runAction('first-page');
        } else if (event.key === 'End') {
          runAction('last-page');
        } else {
          handled = false;
        }
      } else if (!commandKey && !event.altKey && !isTypingTarget(event.target)) {
        if (code === 'KeyN' && !event.shiftKey) {
          runAction('next-page');
        } else if (code === 'KeyP' && !event.shiftKey) {
          runAction('previous-page');
        } else if (code === 'KeyG') {
          runAction(event.shiftKey ? 'last-page' : 'first-page');
        } else if (code === 'KeyD' && !event.shiftKey) {
          cycleTheme();
        } else {
          handled = false;
        }
      } else {
        handled = false;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }, { once: true });

  // Surface the real error instead of a generic message, so failures can
  // be diagnosed from the text alone.
  window.onerror = function (message, source, lineno, colno, error) {
    var details = String(message || 'unknown error');
    if (error && error.stack) {
      details += '\n' + error.stack;
    } else if (source) {
      details += '\nat ' + source + ':' + lineno + ':' + colno;
    }
    var msg = document.createElement('body');
    msg.innerText =
      'An error occurred while loading the file. Please open it again.\n\n' +
      details;
    document.body = msg;
  };
}());
