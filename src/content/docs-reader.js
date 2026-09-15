/**
 * Google Docs Content Reader
 * Robustly extracts real-time content from Google Docs DOM
 * Idempotent — safe to load multiple times.
 */
(function (global) {
  'use strict';

  if (global.GoogleDocsReader) return; // already loaded

  class GoogleDocsReader {
    constructor() {
      this.selectors = {
        title: [
          '[aria-label="Document title"]',
          '.kix-document-title',
          'input[aria-label="Document title"]',
          '#docs-title-input'
        ],
        content: [
          '.kix-page-content-wrapper',
          '.kix-appview-editor',
          '[role="document"]',
          '.docs-texteventtarget-iframe'
        ],
        paragraphs: [
          '.kix-paragraphrenderer',
          '.kix-lineview',
          '[class*="paragraph"]'
        ]
      };
    }

    getTitle() {
      for (const sel of this.selectors.title) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.value || el.textContent || el.innerText;
          if (text && text.trim()) return text.trim();
        }
      }
      return (document.title || '').replace(' - Google Docs', '').trim() || 'Untitled Document';
    }

    getDocumentId() {
      const match = window.location.href.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    }

    getContentElement() {
      for (const sel of this.selectors.content) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    }

    getText() {
      const contentEl = this.getContentElement();
      if (contentEl) {
        const text = contentEl.innerText || contentEl.textContent || '';
        if (text.trim()) return this.normalizeText(text);
      }
      const paragraphs = this.getParagraphs();
      if (paragraphs.length > 0) return paragraphs.join('\n');
      return '';
    }

    getParagraphs() {
      const result = [];
      for (const sel of this.selectors.paragraphs) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.innerText || el.textContent || '';
            if (text.trim()) result.push(text.trim());
          });
          break;
        }
      }
      return result;
    }

    normalizeText(text) {
      return text
        .replace(/\u00A0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    getSnapshot() {
      const text = this.getText();
      const words = text.split(/\s+/).filter(w => w.length > 0);

      return {
        text,
        title: this.getTitle(),
        documentId: this.getDocumentId(),
        url: window.location.href,
        wordCount: words.length,
        charCount: text.length,
        charCountNoSpaces: text.replace(/\s/g, '').length,
        paragraphCount: text.split('\n').filter(l => l.trim()).length,
        sentenceCount: text.split(/[.!?]+/).filter(s => s.trim()).length,
        timestamp: Date.now(),
        readingTimeMinutes: Math.ceil(words.length / 200) || 1,
        hash: this.hashCode(text)
      };
    }

    hashCode(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    }

    isReady() {
      return !!this.getContentElement();
    }
  }

  global.GoogleDocsReader = GoogleDocsReader;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleDocsReader };
  }
})(typeof window !== 'undefined' ? window : self);
