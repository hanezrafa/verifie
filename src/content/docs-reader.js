/**
 * Google Docs Content Reader
 * Robustly extracts real-time content from Google Docs DOM.
 *
 * Google Docs renders text in several possible ways:
 *  a) .kix-lineview spans (accessibility / DOM layer)
 *  b) canvas glyphs with a hidden a11y text layer
 *  c) text inside the docs-texteventtarget-iframe
 *
 * This reader tries all strategies.
 * Idempotent — safe to load multiple times.
 */
(function (global) {
  'use strict';

  if (global.GoogleDocsReader) return;

  class GoogleDocsReader {
    constructor() {
      this.titleSelectors = [
        '#docs-title-input',
        '.docs-title-input',
        'input[aria-label="Document title"]',
        '[aria-label="Document title"]',
        '.kix-document-title'
      ];
    }

    getTitle() {
      for (const sel of this.titleSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const t = (el.value || el.textContent || '').trim();
          if (t) return t;
        }
      }
      return (document.title || '').replace(/\s*-\s*Google Docs\s*$/, '').trim() || 'Untitled Document';
    }

    getDocumentId() {
      const m = window.location.href.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return m ? m[1] : null;
    }

    // ---------------------------------------------------------------
    // Accessibility "hidden text" layer — the most reliable source
    // ---------------------------------------------------------------
    getA11yText() {
      // Google Docs exposes text via these containers
      const containers = [
        '.kix-page-content-wrapper',
        '.kix-appview-editor',
        '#docs-editor'
      ];

      for (const sel of containers) {
        const root = document.querySelector(sel);
        if (!root) continue;

        // Collect text from line views / paragraph renderers inside
        const parts = [];
        const nodes = root.querySelectorAll('.kix-lineview, .kix-paragraphrenderer, [class*="paragraph"]');
        nodes.forEach(n => {
          const txt = (n.innerText || n.textContent || '').replace(/\u00A0/g, ' ');
          if (txt.trim()) parts.push(txt.replace(/\n+$/, ''));
        });

        if (parts.length > 0) return parts.join('\n');
      }
      return '';
    }

    // ---------------------------------------------------------------
    // Read text from the editor iframe (same-origin)
    // ---------------------------------------------------------------
    getIframeText() {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for (const frame of iframes) {
        try {
          const doc = frame.contentDocument;
          if (!doc) continue;
          const body = doc.body;
          if (!body) continue;
          const text = (body.innerText || body.textContent || '').trim();
          if (text.length > 0) return text;
        } catch (e) {
          // cross-origin — skip
        }
      }
      return '';
    }

    // ---------------------------------------------------------------
    // Broad fallbacks
    // ---------------------------------------------------------------
    getContentElement() {
      const selectors = [
        '.kix-page-content-wrapper',
        '.kix-page',
        '.kix-appview-editor',
        '.docs-editor-container',
        '[role="document"]'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    }

    getContainerText() {
      const el = this.getContentElement();
      if (!el) return '';
      return (el.innerText || el.textContent || '').replace(/\u00A0/g, ' ').trim();
    }

    // ---------------------------------------------------------------
    // Main text extraction — try every strategy, return the longest
    // ---------------------------------------------------------------
    getText() {
      const candidates = [
        this.getA11yText(),
        this.getIframeText(),
        this.getContainerText(),
        this.getBodyEditorText()
      ].filter(t => t && t.trim().length > 0);

      if (candidates.length === 0) return '';

      // Choose the longest meaningful candidate
      candidates.sort((a, b) => b.length - a.length);
      return this.normalize(candidates[0]);
    }

    getBodyEditorText() {
      // Look for any element that looks like the editor region
      const region = document.querySelector('.docs-editor') ||
                     document.querySelector('#docs-editor-container') ||
                     document.querySelector('.kix-appview');
      if (!region) return '';
      return (region.innerText || '').trim();
    }

    normalize(text) {
      return text
        .replace(/\u00A0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    getSnapshot() {
      const text = this.getText();
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const lines = text.split('\n').filter(l => l.trim().length > 0);

      return {
        text,
        title: this.getTitle(),
        documentId: this.getDocumentId(),
        url: window.location.href,
        wordCount: words.length,
        charCount: text.length,
        charCountNoSpaces: text.replace(/\s/g, '').length,
        paragraphCount: lines.length,
        sentenceCount: text.split(/[.!?]+/).filter(s => s.trim()).length,
        readingTimeMinutes: Math.max(1, Math.ceil(words.length / 200)),
        timestamp: Date.now(),
        hash: this.hashCode(text)
      };
    }

    hashCode(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h = h & h;
      }
      return h.toString(36);
    }

    isReady() {
      return !!this.getContentElement();
    }

    diagnose() {
      const strategies = {
        a11y: this.getA11yText().length,
        iframe: this.getIframeText().length,
        container: this.getContainerText().length,
        bodyEditor: this.getBodyEditorText().length
      };
      const counts = {
        lineview: document.querySelectorAll('.kix-lineview').length,
        paragraph: document.querySelectorAll('.kix-paragraphrenderer').length,
        pageContent: document.querySelectorAll('.kix-page-content-wrapper').length,
        appview: document.querySelectorAll('.kix-appview-editor').length,
        editorContainer: document.querySelectorAll('.docs-editor-container').length,
        roleDocument: document.querySelectorAll('[role="document"]').length,
        iframes: document.querySelectorAll('iframe').length,
        canvases: document.querySelectorAll('canvas').length
      };
      const text = this.getText();
      return { strategies, counts, textLength: text.length, textPreview: text.slice(0, 80) };
    }
  }

  global.GoogleDocsReader = GoogleDocsReader;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleDocsReader };
  }
})(typeof window !== 'undefined' ? window : self);
