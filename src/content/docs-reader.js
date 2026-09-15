/**
 * Google Docs Content Reader
 * Robustly extracts real-time content from Google Docs DOM.
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
          const text = (el.value || el.textContent || '').trim();
          if (text) return text;
        }
      }
      const t = (document.title || '').replace(/\s*-\s*Google Docs\s*$/, '').trim();
      return t || 'Untitled Document';
    }

    getDocumentId() {
      const m = window.location.href.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return m ? m[1] : null;
    }

    /**
     * Find the element that holds the document text.
     * Tries many selectors because Google Docs DOM varies.
     */
    getContentElement() {
      const selectors = [
        '.kix-page-content-wrapper',
        '.kix-page',
        '.kix-appview-editor',
        '.docs-editor-container',
        '[role="document"]',
        '.kix-canvas-tile-content'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          // Ensure it actually has text
          if ((el.innerText || el.textContent || '').trim().length > 0) return el;
        }
      }
      // Last resort: return first selector that exists even if empty
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    }

    /**
     * Extract text. Google Docs renders each line in .kix-lineview.
     * We join line contents in reading order.
     */
    getText() {
      // Strategy 1: paragraph/line renderers (most accurate)
      const lineText = this.getTextFromLines();
      if (lineText && lineText.trim().length > 0) return this.normalize(lineText);

      // Strategy 2: content wrapper innerText
      const el = this.getContentElement();
      if (el) {
        const text = el.innerText || '';
        if (text.trim().length > 0) return this.normalize(text);
      }

      return '';
    }

    getTextFromLines() {
      // Newer Docs use .kix-lineview; older use .kix-paragraphrenderer
      let lines = document.querySelectorAll('.kix-lineview');
      if (lines.length === 0) lines = document.querySelectorAll('.kix-paragraphrenderer');
      if (lines.length === 0) lines = document.querySelectorAll('[class*="lineview"]');
      if (lines.length === 0) return '';

      const out = [];
      lines.forEach(line => {
        const t = (line.innerText || line.textContent || '').replace(/\u00A0/g, ' ');
        if (t.length > 0) out.push(t.replace(/\n+$/, ''));
      });
      return out.join('\n');
    }

    normalize(text) {
      return text
        .replace(/\u00A0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
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

    /**
     * Diagnostic info — helps debug when detection fails
     */
    diagnose() {
      const counts = {
        lineview: document.querySelectorAll('.kix-lineview').length,
        paragraph: document.querySelectorAll('.kix-paragraphrenderer').length,
        pageContent: document.querySelectorAll('.kix-page-content-wrapper').length,
        page: document.querySelectorAll('.kix-page').length,
        editor: document.querySelectorAll('.kix-appview-editor').length,
        editorContainer: document.querySelectorAll('.docs-editor-container').length,
        roleDocument: document.querySelectorAll('[role="document"]').length,
        lineviewAny: document.querySelectorAll('[class*="lineview"]').length,
        frames: window.frames.length
      };
      const text = this.getText();
      return { counts, textLength: text.length, textPreview: text.slice(0, 80) };
    }
  }

  global.GoogleDocsReader = GoogleDocsReader;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleDocsReader };
  }
})(typeof window !== 'undefined' ? window : self);
